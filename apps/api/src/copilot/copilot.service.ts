import { CopilotRole, Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GrowthIntelligenceService } from '../growth-intelligence/growth-intelligence.service';
import { createLlmAdapter, LlmMessage } from './llm-adapter';

interface CreateConversationInput {
  organizationId: string;
  title?: string;
}

interface ChatInput {
  conversationId: string;
  organizationId: string;
  content: string;
}

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly billingAccessService: BillingAccessService,
    private readonly growthIntelligenceService: GrowthIntelligenceService,
  ) {}

  async createConversation(input: CreateConversationInput) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'ai.full');

    const conversation = await this.prisma.copilotConversation.create({
      data: {
        organizationId: input.organizationId,
        title: input.title?.trim() || 'Growth Copilot Session',
      },
    });

    return this.getConversation(conversation.id, input.organizationId);
  }

  async getConversation(conversationId: string, organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'ai.full');

    const conversation = await this.prisma.copilotConversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return conversation;
  }

  async chat(input: ChatInput) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'ai.full');

    const conversation = await this.prisma.copilotConversation.findFirst({
      where: {
        id: input.conversationId,
        organizationId: input.organizationId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 12,
          select: {
            role: true,
            content: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const executiveSummary = await this.analyticsService.getExecutiveSummary({
      organizationId: input.organizationId,
    });

    const recentRecommendations = await this.prisma.recommendation.findMany({
      where: {
        organizationId: input.organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3,
      select: {
        id: true,
        recommendation: true,
        status: true,
        priority: true,
        confidenceScore: true,
        traceId: true,
      },
    });

    const strategicContext = await this.growthIntelligenceService.getStrategicContext(
      input.organizationId,
    );

    const contextSnapshot = {
      executiveSummary,
      recentRecommendations,
      strategicContext,
      generatedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    const userMessage = await this.prisma.copilotMessage.create({
      data: {
        conversationId: input.conversationId,
        role: CopilotRole.USER,
        content: input.content,
        contextSnapshot,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    const adapter = createLlmAdapter();
    const llmMessages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'You are Revenew Growth Copilot. Respond with reliable, actionable guidance using this structure: Situation, Risks, Action Plan (3-5 numbered actions), Evidence (metric/recommendation references), and Fallback if confidence is low.',
      },
      {
        role: 'system',
        content: `Executive summary context: ${JSON.stringify(executiveSummary)}`,
      },
      {
        role: 'system',
        content: `Recent recommendations context: ${JSON.stringify(recentRecommendations)}`,
      },
      {
        role: 'system',
        content: `Growth intelligence graph context: ${JSON.stringify(strategicContext)}`,
      },
      ...conversation.messages.map((message) => ({
        role: (message.role === CopilotRole.USER ? 'user' : 'assistant') as 'user' | 'assistant',
        content: message.content,
      })),
      {
        role: 'user',
        content: input.content,
      },
    ];

    let assistantContent: string;
    try {
      assistantContent = await adapter.generate({ messages: llmMessages });
    } catch (error) {
      assistantContent = [
        'Situation: AI provider request failed, so fallback guidance is returned.',
        'Risks: Response may be less contextual than normal model output.',
        'Action Plan:\n1. Verify COPILOT_PROVIDER and API credentials.\n2. Re-run this request after provider health check.\n3. Execute top recommendation from the latest executive summary.',
        `Evidence: Top recommendation: ${executiveSummary.topRecommendation}`,
        `Fallback: ${error instanceof Error ? error.message : 'Unknown provider error'}`,
      ].join('\n\n');
    }

    if (!assistantContent.includes('Action Plan')) {
      assistantContent = [
        'Situation: Request processed with available context.',
        assistantContent,
        'Action Plan:\n1. Prioritize the highest-impact recommendation.\n2. Validate against current confidence score.\n3. Track outcome in recommendation status updates.',
      ].join('\n\n');
    }

    const assistantMessage = await this.prisma.copilotMessage.create({
      data: {
        conversationId: input.conversationId,
        role: CopilotRole.ASSISTANT,
        content: assistantContent,
        contextSnapshot,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });

    return {
      conversationId: input.conversationId,
      messages: [userMessage, assistantMessage],
    };
  }
}

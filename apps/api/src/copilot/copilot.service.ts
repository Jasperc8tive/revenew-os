import { CopilotRole, Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
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

    const contextSnapshot = {
      executiveSummary,
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
          'You are Revenew Growth Copilot. Give practical, execution-ready growth advice based on provided analytics.',
      },
      {
        role: 'system',
        content: `Executive summary context: ${JSON.stringify(executiveSummary)}`,
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

    const assistantContent = await adapter.generate({ messages: llmMessages });

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

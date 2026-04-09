import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { CopilotRole } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import * as LlmAdapterModule from './llm-adapter';

describe('CopilotService', () => {
  let service: CopilotService;
  let generateFn: ReturnType<typeof jest.fn>;
  let adapterSpy: ReturnType<typeof jest.spyOn>;

  const mockConversation = {
    id: 'conv-1',
    organizationId: 'org-1',
    title: 'Test chat',
    messages: [],
  };

  const mockSummary = {
    organizationId: 'org-1',
    range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    kpis: {
      totalRevenue: 100000,
      revenueGrowthRate: 0.05,
      churnRate: 0.02,
      ltvToCacRatio: 5,
      activeCustomers: 50,
    },
    topRecommendation: 'Expand marketing spend',
    confidence: { score: 0.85 },
    suppression: null,
    dataQuality: { status: 'healthy', recentAnomalies: [], summary: null },
  };

  const prismaMock = {
    copilotConversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    copilotMessage: {
      create: jest.fn(),
    },
    recommendation: {
      findMany: jest.fn(),
    },
  };

  const analyticsMock = {
    getExecutiveSummary: jest.fn(),
  };

  const billingAccessMock = {
    assertFeatureAccess: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    generateFn = jest.fn();
    adapterSpy = jest
      .spyOn(LlmAdapterModule, 'createLlmAdapter')
      .mockReturnValue({ generate: generateFn });

    billingAccessMock.assertFeatureAccess.mockImplementation(async () => undefined);
    analyticsMock.getExecutiveSummary.mockImplementation(async () => ({ ...mockSummary }));
    prismaMock.recommendation.findMany.mockImplementation(async () => []);
    prismaMock.copilotConversation.findFirst.mockImplementation(async () => ({ ...mockConversation }));
    prismaMock.copilotMessage.create
      .mockImplementationOnce(async () => ({
        id: 'msg-user-1',
        role: CopilotRole.USER,
        content: 'What should I focus on?',
        createdAt: new Date(),
      }))
      .mockImplementationOnce(async () => ({
        id: 'msg-assistant-1',
        role: CopilotRole.ASSISTANT,
        content: 'Action Plan: 1. Do X',
        createdAt: new Date(),
      }));

    generateFn.mockImplementation(async () =>
      'Situation: stable growth.\n\nRisks: none.\n\nAction Plan:\n1. Move fast.\n\nEvidence: metrics.\n\nFallback: monitor.',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: BillingAccessService, useValue: billingAccessMock },
      ],
    }).compile();

    service = module.get<CopilotService>(CopilotService);
  });

  afterEach(() => {
    adapterSpy.mockRestore();
  });

  const chatInput = {
    conversationId: 'conv-1',
    organizationId: 'org-1',
    content: 'What should I focus on?',
  };

  describe('chat()', () => {
    it('returns both user and assistant messages', async () => {
      const result = await service.chat(chatInput);

      expect(result.conversationId).toBe('conv-1');
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe(CopilotRole.USER);
      expect(result.messages[1].role).toBe(CopilotRole.ASSISTANT);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      prismaMock.copilotConversation.findFirst.mockImplementation(async () => null);

      await expect(service.chat(chatInput)).rejects.toThrow(NotFoundException);
    });

    it('asserts ai.full billing access', async () => {
      await service.chat(chatInput);

      expect(billingAccessMock.assertFeatureAccess).toHaveBeenCalledWith('org-1', 'ai.full');
    });

    it('includes recent recommendations context in the LLM messages', async () => {
      prismaMock.recommendation.findMany.mockImplementation(async () => [
        { id: 'rec-1', recommendation: 'Scale ads', status: 'PENDING', priority: 1, confidenceScore: 0.8, traceId: 'trace-1' },
      ]);

      await service.chat(chatInput);

      const llmCallArg = (generateFn.mock.calls[0] as [{ messages: Array<{ role: string; content: string }> }])[0];
      const systemMessages = llmCallArg.messages.filter((m) => m.role === 'system');
      const recContextMsg = systemMessages.find((m) => m.content.includes('rec-1'));
      expect(recContextMsg).toBeDefined();
    });

    describe('fallback path (adapter throws)', () => {
      beforeEach(() => {
        generateFn.mockImplementation(async () => {
          throw new Error('Provider timeout');
        });
      });

      it('persists a fallback assistant message that includes "Action Plan"', async () => {
        await service.chat(chatInput);

        const assistantCreateArg = (
          prismaMock.copilotMessage.create.mock.calls[1] as [{ data: { content: string } }]
        )[0];
        expect(assistantCreateArg.data.content).toContain('Action Plan');
      });

      it('includes the error message in the fallback content', async () => {
        await service.chat(chatInput);

        const assistantCreateArg = (
          prismaMock.copilotMessage.create.mock.calls[1] as [{ data: { content: string } }]
        )[0];
        expect(assistantCreateArg.data.content).toContain('Provider timeout');
      });

      it('includes the top recommendation in the fallback evidence', async () => {
        await service.chat(chatInput);

        const assistantCreateArg = (
          prismaMock.copilotMessage.create.mock.calls[1] as [{ data: { content: string } }]
        )[0];
        expect(assistantCreateArg.data.content).toContain('Expand marketing spend');
      });
    });

    describe('Action Plan enforcement', () => {
      it('injects Action Plan when adapter returns response without one', async () => {
        generateFn.mockImplementation(async () =>
          'Situation: growing fast. Risks: churn rising slightly. Evidence: see KPIs.',
        );

        await service.chat(chatInput);

        const assistantCreateArg = (
          prismaMock.copilotMessage.create.mock.calls[1] as [{ data: { content: string } }]
        )[0];
        expect(assistantCreateArg.data.content).toContain('Action Plan');
      });

      it('does not append a second Action Plan when one already exists', async () => {
        const completeResponse =
          'Situation: on track.\n\nRisks: none.\n\nAction Plan:\n1. Continue.\n\nEvidence: metrics.\n\nFallback: n/a.';
        generateFn.mockImplementation(async () => completeResponse);

        await service.chat(chatInput);

        const assistantCreateArg = (
          prismaMock.copilotMessage.create.mock.calls[1] as [{ data: { content: string } }]
        )[0];
        const actionPlanOccurrences = (assistantCreateArg.data.content.match(/Action Plan/g) ?? []).length;
        expect(actionPlanOccurrences).toBe(1);
      });
    });
  });
});

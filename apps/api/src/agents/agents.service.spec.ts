import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AgentType, ExecutionStatus } from '@prisma/client';
import { AgentsService } from './agents.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

describe('AgentsService', () => {
  let service: AgentsService;

  const mockExecutionLog = {
    id: 'exec-1',
    organizationId: 'org-1',
    agentType: AgentType.RETENTION,
    status: ExecutionStatus.RUNNING,
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
  };

  const mockSummary = {
    organizationId: 'org-1',
    range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    kpis: {
      totalRevenue: 500000,
      revenueGrowthRate: 0.1,
      churnRate: 0.03,
      ltvToCacRatio: 4,
      activeCustomers: 100,
    },
    topRecommendation: 'Focus on retention',
    confidence: { score: 0.8 },
    suppression: null,
    dataQuality: { status: 'healthy', recentAnomalies: [], summary: null },
  };

  const prismaMock = {
    agentExecutionLog: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const billingAccessMock = {
    assertFeatureAccess: jest.fn(),
  };

  const analyticsMock = {
    getExecutiveSummary: jest.fn(),
  };

  const recommendationsMock = {
    persistAuditableRecommendation: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    billingAccessMock.assertFeatureAccess.mockImplementation(async () => undefined);
    prismaMock.agentExecutionLog.create.mockImplementation(async () => ({ ...mockExecutionLog }));
    prismaMock.agentExecutionLog.update.mockImplementation(async () => ({
      ...mockExecutionLog,
      status: ExecutionStatus.SUCCESS,
    }));
    analyticsMock.getExecutiveSummary.mockImplementation(async () => ({ ...mockSummary }));
    recommendationsMock.persistAuditableRecommendation.mockImplementation(async () => ({
      recommendationId: 'rec-1',
      traceId: 'trace-abc',
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: BillingAccessService, useValue: billingAccessMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: RecommendationsService, useValue: recommendationsMock },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  describe('listRuns()', () => {
    it('asserts ai.full billing access before listing', async () => {
      prismaMock.agentExecutionLog.findMany.mockImplementation(async () => [mockExecutionLog]);

      await service.listRuns({ organizationId: 'org-1' });

      expect(billingAccessMock.assertFeatureAccess).toHaveBeenCalledWith('org-1', 'ai.full');
    });

    it('returns execution logs for the organization', async () => {
      prismaMock.agentExecutionLog.findMany.mockImplementation(async () => [mockExecutionLog]);

      const results = await service.listRuns({ organizationId: 'org-1' });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('exec-1');
    });

    it('passes status filter when provided', async () => {
      prismaMock.agentExecutionLog.findMany.mockImplementation(async () => []);

      await service.listRuns({ organizationId: 'org-1', status: ExecutionStatus.FAILED });

      expect(prismaMock.agentExecutionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ExecutionStatus.FAILED }),
        }),
      );
    });

    it('omits status filter when not provided', async () => {
      prismaMock.agentExecutionLog.findMany.mockImplementation(async () => []);

      await service.listRuns({ organizationId: 'org-1' });

      const callArg = prismaMock.agentExecutionLog.findMany.mock.calls[0][0] as {
        where: { status?: ExecutionStatus };
      };
      expect(callArg.where.status).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('asserts ai.full billing access before executing', async () => {
      await service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION });

      expect(billingAccessMock.assertFeatureAccess).toHaveBeenCalledWith('org-1', 'ai.full');
    });

    it('creates execution log with RUNNING status at start', async () => {
      await service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION });

      expect(prismaMock.agentExecutionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            agentType: AgentType.RETENTION,
            status: ExecutionStatus.RUNNING,
          }),
        }),
      );
    });

    it('returns SUCCESS output with recommendation on first attempt', async () => {
      const result = await service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION });

      expect(result.output.status).toBe(ExecutionStatus.SUCCESS);
      expect(result.output.attempts).toBe(1);
      expect(result.output.recommendationId).toBe('rec-1');
      expect(result.output.traceId).toBe('trace-abc');
    });

    it('updates execution log to SUCCESS on completion', async () => {
      await service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION });

      expect(prismaMock.agentExecutionLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ExecutionStatus.SUCCESS }),
        }),
      );
    });

    it('fetches executive summary with the organization id', async () => {
      await service.run({ organizationId: 'org-1', agentType: AgentType.GROWTH });

      expect(analyticsMock.getExecutiveSummary).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });

    it('retries and succeeds on second attempt', async () => {
      analyticsMock.getExecutiveSummary
        .mockImplementationOnce(async () => {
          throw new Error('Transient analytics error');
        })
        .mockImplementation(async () => ({ ...mockSummary }));

      const result = await service.run({
        organizationId: 'org-1',
        agentType: AgentType.RETENTION,
        maxRetries: 3,
      });

      expect(result.output.status).toBe(ExecutionStatus.SUCCESS);
      expect(result.output.attempts).toBe(2);
    });

    it('marks execution as FAILED and rethrows after all retries exhausted', async () => {
      const err = new Error('Persistent analytics failure');
      analyticsMock.getExecutiveSummary.mockImplementation(async () => {
        throw err;
      });

      await expect(
        service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION, maxRetries: 2 }),
      ).rejects.toThrow('Persistent analytics failure');

      expect(prismaMock.agentExecutionLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ExecutionStatus.FAILED,
            errorMessage: 'Persistent analytics failure',
          }),
        }),
      );
    });

    it('caps maxRetries at 5 even when higher value is given', async () => {
      analyticsMock.getExecutiveSummary.mockImplementation(async () => {
        throw new Error('Always fails');
      });

      await expect(
        service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION, maxRetries: 99 }),
      ).rejects.toThrow();

      expect(analyticsMock.getExecutiveSummary).toHaveBeenCalledTimes(5);
    });

    it('uses minimum of 1 retry even when 0 is given', async () => {
      analyticsMock.getExecutiveSummary.mockImplementation(async () => {
        throw new Error('Fail');
      });

      await expect(
        service.run({ organizationId: 'org-1', agentType: AgentType.RETENTION, maxRetries: 0 }),
      ).rejects.toThrow();

      expect(analyticsMock.getExecutiveSummary).toHaveBeenCalledTimes(1);
    });

    it('passes agentType and organizationId through to the output', async () => {
      const result = await service.run({ organizationId: 'org-1', agentType: AgentType.FORECASTING });

      expect(result.input.organizationId).toBe('org-1');
      expect(result.input.agentType).toBe(AgentType.FORECASTING);
    });
  });
});

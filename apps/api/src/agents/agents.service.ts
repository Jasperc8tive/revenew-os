import { Injectable } from '@nestjs/common';
import { AgentType, ExecutionStatus, ImpactLevel } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';

interface RunAgentInput {
  organizationId: string;
  agentType: AgentType;
  maxRetries?: number;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
    private readonly analyticsService: AnalyticsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async listRuns(input: { organizationId: string; status?: ExecutionStatus; limit?: number }) {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'ai.full');

    return this.prisma.agentExecutionLog.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async run(input: RunAgentInput) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'ai.full');

    const maxRetries = Math.min(Math.max(input.maxRetries ?? 2, 1), 5);
    const execution = await this.prisma.agentExecutionLog.create({
      data: {
        organizationId: input.organizationId,
        agentType: input.agentType,
        status: ExecutionStatus.RUNNING,
      },
    });

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const summary = await this.analyticsService.getExecutiveSummary({
          organizationId: input.organizationId,
        });

        const recommendation = this.buildRecommendation(input.agentType, summary);
        const traceId = [
          input.organizationId,
          input.agentType,
          summary.range.startDate,
          summary.range.endDate,
          recommendation,
        ].join(':');

        const persisted = await this.recommendationsService.persistAuditableRecommendation({
          organizationId: input.organizationId,
          insight: `Agent ${input.agentType} analyzed executive summary`,
          recommendation,
          impactLevel: recommendation.includes('urgent') ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
          confidenceScore: summary.confidence?.score ?? 0.5,
          dataPoints: summary.kpis.activeCustomers ?? 0,
          dataWindow: summary.range,
          evidence: {
            source: 'agent_orchestrator',
            agentType: input.agentType,
            executiveSummary: summary,
          },
          explanation: {
            what: `Agent ${input.agentType} produced an action recommendation`,
            why: summary.topRecommendation,
            action: recommendation,
          },
          traceId,
        });

        await this.prisma.agentExecutionLog.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.SUCCESS,
            completedAt: new Date(),
          },
        });

        return {
          input: {
            organizationId: input.organizationId,
            agentType: input.agentType,
            maxRetries,
          },
          output: {
            executionId: execution.id,
            status: ExecutionStatus.SUCCESS,
            attempts: attempt,
            recommendationId: persisted.recommendationId,
            traceId: persisted.traceId,
            summary: {
              topRecommendation: summary.topRecommendation,
              confidenceScore: summary.confidence?.score ?? null,
              suppression: summary.suppression ?? null,
            },
          },
        };
      } catch (error) {
        lastError = error;
      }
    }

    await this.prisma.agentExecutionLog.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.FAILED,
        completedAt: new Date(),
        errorMessage:
          lastError instanceof Error
            ? lastError.message
            : 'Agent execution failed after retries',
      },
    });

    throw lastError instanceof Error
      ? lastError
      : new Error('Agent execution failed after retries');
  }

  private buildRecommendation(
    agentType: AgentType,
    summary: Awaited<ReturnType<AnalyticsService['getExecutiveSummary']>>,
  ) {
    if (agentType === AgentType.RETENTION) {
      return summary.kpis.churnRate > 0.05
        ? 'Launch an urgent churn-recovery flow: segment at-risk users and trigger win-back outreach this week.'
        : 'Strengthen retention with proactive lifecycle messaging for high-LTV customers.';
    }

    if (agentType === AgentType.FORECASTING) {
      return summary.kpis.revenueGrowthRate < 0
        ? 'Build a downside forecast scenario and freeze low-efficiency spend until growth recovers.'
        : 'Expand spend gradually in top channels and monitor confidence trends weekly.';
    }

    if (agentType === AgentType.ACQUISITION) {
      return summary.kpis.ltvToCacRatio < 3
        ? 'Rebalance acquisition budget toward channels with stronger payback and tighten CAC guardrails.'
        : 'Scale acquisition in best-performing channels while preserving CAC discipline.';
    }

    if (agentType === AgentType.PIPELINE) {
      return 'Improve pipeline velocity by enforcing stage SLAs and weekly deal hygiene reviews.';
    }

    if (agentType === AgentType.PRICING) {
      return 'Run pricing sensitivity tests on top customer cohorts and track conversion impact before broad rollout.';
    }

    if (agentType === AgentType.MARKETING) {
      return 'Prioritize campaigns with proven conversion efficiency and pause low-signal experiments.';
    }

    return summary.kpis.revenueGrowthRate < 0
      ? 'Issue urgent growth recovery plan focused on CAC reduction and retention uplift.'
      : 'Execute the top recommendation and track impact through weekly verified metrics snapshots.';
  }
}

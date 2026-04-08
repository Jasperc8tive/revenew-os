// Recommendations service - serves AI-generated recommendations
import { Injectable } from '@nestjs/common';
import { AgentType, ExecutionStatus, ImpactLevel, Prisma, RecommendationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface RecommendationGuardrailPolicy {
	minDataPoints: number;
	minConfidenceScore: number;
	requireHealthyIntegrations: boolean;
}

export interface RecommendationGenerationInput {
	dataPoints: number;
	confidenceScore: number;
	integrationsHealthy: boolean;
}

export interface RecommendationGuardrailDecision {
	allowed: boolean;
	reason?:
		| 'insufficient_data_points'
		| 'low_confidence'
		| 'integration_health_degraded';
}

export const DEFAULT_RECOMMENDATION_GUARDRAILS: RecommendationGuardrailPolicy = {
	minDataPoints: 30,
	minConfidenceScore: 0.6,
	requireHealthyIntegrations: true,
};

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

	evaluateGuardrails(
		input: RecommendationGenerationInput,
		policy: RecommendationGuardrailPolicy = DEFAULT_RECOMMENDATION_GUARDRAILS,
	): RecommendationGuardrailDecision {
		if (input.dataPoints < policy.minDataPoints) {
			return {
				allowed: false,
				reason: 'insufficient_data_points',
			};
		}

		if (input.confidenceScore < policy.minConfidenceScore) {
			return {
				allowed: false,
				reason: 'low_confidence',
			};
		}

		if (policy.requireHealthyIntegrations && !input.integrationsHealthy) {
			return {
				allowed: false,
				reason: 'integration_health_degraded',
			};
		}

		return {
			allowed: true,
		};
	}

	async persistAuditableRecommendation(input: {
		organizationId: string;
		insight: string;
		recommendation: string;
		impactLevel: ImpactLevel;
		confidenceScore: number;
		dataPoints: number;
		dataWindow: { startDate: string; endDate: string };
		evidence: unknown;
		explanation: { what: string; why: string; action: string };
		suppressionReason?: string;
		traceId: string;
	}) {
		const existing = await this.prisma.recommendation.findFirst({
			where: {
				organizationId: input.organizationId,
				traceId: input.traceId,
			},
			select: { id: true },
		});

		if (existing) {
			return { persisted: false, recommendationId: existing.id, traceId: input.traceId };
		}

		const execution = await this.prisma.agentExecutionLog.create({
			data: {
				organizationId: input.organizationId,
				agentType: AgentType.GROWTH,
				status: ExecutionStatus.RUNNING,
			},
		});

		try {
			const insight = await this.prisma.agentInsight.create({
				data: {
					organizationId: input.organizationId,
					agentType: AgentType.GROWTH,
					insight: input.insight,
					impactLevel: input.impactLevel,
					confidenceScore: new Prisma.Decimal(input.confidenceScore),
					dataPoints: input.dataPoints,
					dataWindowStart: new Date(input.dataWindow.startDate),
					dataWindowEnd: new Date(input.dataWindow.endDate),
					evidence: input.evidence as Prisma.InputJsonValue,
					explanationWhat: input.explanation.what,
					explanationWhy: input.explanation.why,
					explanationAction: input.explanation.action,
					suppressionReason: input.suppressionReason,
					traceId: input.traceId,
				},
			});

			const recommendation = await this.prisma.recommendation.create({
				data: {
					organizationId: input.organizationId,
					insightId: insight.id,
					recommendation: input.recommendation,
					expectedImpact: input.impactLevel,
					confidenceScore: new Prisma.Decimal(input.confidenceScore),
					evidence: input.evidence as Prisma.InputJsonValue,
					rationale: input.explanation.why,
					assumptions: {
						dataPoints: input.dataPoints,
						suppressionReason: input.suppressionReason ?? null,
					} as Prisma.InputJsonValue,
					priority: input.impactLevel === ImpactLevel.CRITICAL ? 1 : input.impactLevel === ImpactLevel.HIGH ? 2 : input.impactLevel === ImpactLevel.MEDIUM ? 3 : 4,
					traceId: input.traceId,
					status: RecommendationStatus.PENDING,
				},
			});

			await this.prisma.agentExecutionLog.update({
				where: { id: execution.id },
				data: {
					status: ExecutionStatus.SUCCESS,
					completedAt: new Date(),
				},
			});

			return { persisted: true, recommendationId: recommendation.id, traceId: input.traceId };
		} catch (error) {
			await this.prisma.agentExecutionLog.update({
				where: { id: execution.id },
				data: {
					status: ExecutionStatus.FAILED,
					completedAt: new Date(),
					errorMessage: error instanceof Error ? error.message : 'Recommendation persistence failed',
				},
			});

			throw error;
		}
	}
}

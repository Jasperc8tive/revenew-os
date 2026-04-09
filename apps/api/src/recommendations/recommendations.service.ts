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

	async listRecommendations(input: {
		organizationId: string;
		status?: RecommendationStatus;
		limit?: number;
	}) {
		const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

		return this.prisma.recommendation.findMany({
			where: {
				organizationId: input.organizationId,
				...(input.status ? { status: input.status } : {}),
			},
			include: {
				insight: {
					select: {
						id: true,
						insight: true,
						impactLevel: true,
						confidenceScore: true,
						createdAt: true,
					},
				},
			},
			orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
			take: limit,
		});
	}

	async transitionRecommendationStatus(input: {
		recommendationId: string;
		organizationId: string;
		status: RecommendationStatus;
		impactSummary?: string;
	}) {
		const recommendation = await this.prisma.recommendation.findFirst({
			where: {
				id: input.recommendationId,
				organizationId: input.organizationId,
			},
			select: {
				id: true,
				assumptions: true,
			},
		});

		if (!recommendation) {
			return null;
		}

		const existingAssumptions =
			recommendation.assumptions &&
			typeof recommendation.assumptions === 'object' &&
			!Array.isArray(recommendation.assumptions)
				? (recommendation.assumptions as Record<string, unknown>)
				: {};

		const currentHistory = Array.isArray(existingAssumptions.statusHistory)
			? existingAssumptions.statusHistory
			: [];

		const statusHistory = [
			...currentHistory,
			{
				status: input.status,
				updatedAt: new Date().toISOString(),
				impactSummary: input.impactSummary ?? null,
			},
		];

		return this.prisma.recommendation.update({
			where: { id: input.recommendationId },
			data: {
				status: input.status,
				assumptions: {
					...existingAssumptions,
					statusHistory,
					latestImpactSummary: input.impactSummary ?? existingAssumptions.latestImpactSummary ?? null,
				} as Prisma.InputJsonValue,
			},
		});
	}

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
		const dedupeTrace = input.traceId || [input.organizationId, input.recommendation, input.dataWindow.startDate, input.dataWindow.endDate].join(':');

		const existing = await this.prisma.recommendation.findFirst({
			where: {
				organizationId: input.organizationId,
				traceId: dedupeTrace,
			},
			select: { id: true },
		});

		if (existing) {
			return { persisted: false, recommendationId: existing.id, traceId: dedupeTrace };
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
					traceId: dedupeTrace,
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
					traceId: dedupeTrace,
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

			return { persisted: true, recommendationId: recommendation.id, traceId: dedupeTrace };
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

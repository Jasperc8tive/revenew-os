import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  Experiment,
  ExperimentVariant,
  ExperimentResult,
  ExperimentStatus,
  AlertMetric,
  ImpactLevel,
  Prisma,
} from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import {
  CreateExperimentInput,
  UpdateExperimentInput,
  AddVariantInput,
  RecordResultInput,
  ExperimentWithVariants,
} from './experiments.types';

@Injectable()
export class ExperimentsService {
  constructor(
    private prisma: PrismaService,
    private billingAccessService: BillingAccessService,
    private recommendationsService: RecommendationsService,
  ) {}

  /** Create a new growth experiment with hypothesis */
  async createExperiment(
    organizationId: string,
    input: CreateExperimentInput,
  ): Promise<Experiment> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    if (!input.title?.trim()) {
      throw new BadRequestException('Experiment title is required');
    }
    if (!input.hypothesis?.trim()) {
      throw new BadRequestException('Hypothesis is required');
    }

    return this.prisma.experiment.create({
      data: {
        organizationId,
        title: input.title,
        hypothesis: input.hypothesis,
        targetMetric: input.targetMetric ?? AlertMetric.REVENUE,
        status: ExperimentStatus.DRAFT,
      },
    });
  }

  /** Get experiment by ID with variants */
  async getExperiment(
    experimentId: string,
    organizationId: string,
  ): Promise<ExperimentWithVariants> {
    const experiment = await this.prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { variants: { include: { results: true } } },
    });

    if (!experiment) {
      throw new NotFoundException('Experiment not found');
    }

    if (experiment.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Not authorized to view this experiment',
      );
    }

    return experiment as ExperimentWithVariants;
  }

  /** List all experiments for organization */
  async listExperiments(
    organizationId: string,
    filters?: {
      status?: ExperimentStatus;
      metric?: AlertMetric;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ experiments: Experiment[]; total: number }> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const where: Prisma.ExperimentWhereInput = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.metric) where.targetMetric = filters.metric;

    const [experiments, total] = await Promise.all([
      this.prisma.experiment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 20,
        skip: filters?.offset ?? 0,
      }),
      this.prisma.experiment.count({ where }),
    ]);

    return { experiments, total };
  }

  /** Launch experiment from DRAFT to RUNNING */
  async launchExperiment(
    experimentId: string,
    organizationId: string,
  ): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot launch experiment with status ${experiment.status}`,
      );
    }

    const variants = experiment.variants;
    if (!variants.length) {
      throw new BadRequestException(
        'Cannot launch experiment without variants',
      );
    }

    const controlCount = variants.filter((v: ExperimentVariant) => v.isControl).length;
    if (controlCount !== 1) {
      throw new BadRequestException(
        'Experiment must have exactly one control variant',
      );
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: ExperimentStatus.RUNNING,
        startDate: new Date(),
      },
    });
  }

  /** End experiment from RUNNING to COMPLETED */
  async completeExperiment(
    experimentId: string,
    organizationId: string,
  ): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot complete experiment with status ${experiment.status}`,
      );
    }

    const completed = await this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: ExperimentStatus.COMPLETED,
        endDate: new Date(),
      },
    });

    const attribution = await this.getAttributionSummary(experimentId, organizationId);
    if (attribution.winner && attribution.winner.upliftPercent > 5) {
      await this.recommendationsService.persistAuditableRecommendation({
        organizationId,
        insight: `Experiment ${experiment.title} produced a measurable uplift`,
        recommendation: `Operationalize winning variant ${attribution.winner.name} and feed pricing/offer strategy updates.`,
        impactLevel: attribution.winner.upliftPercent > 15 ? ImpactLevel.HIGH : ImpactLevel.MEDIUM,
        confidenceScore: attribution.confidenceScore,
        dataPoints: attribution.winner.sampleSize,
        dataWindow: {
          startDate: completed.startDate?.toISOString() ?? new Date().toISOString(),
          endDate: completed.endDate?.toISOString() ?? new Date().toISOString(),
        },
        evidence: {
          experimentId,
          attribution,
        },
        explanation: {
          what: 'Experiment variant delivered uplift against control',
          why: `Winning uplift ${attribution.winner.upliftPercent.toFixed(2)}%`,
          action: 'Apply winning variant in production and monitor KPI drift',
        },
        traceId: `${organizationId}:experiment:${experimentId}:winner:${attribution.winner.id}`,
      });
    }

    return completed;
  }

  async assignVariant(
    experimentId: string,
    organizationId: string,
    identityKey: string,
  ): Promise<{ variantId: string; variantName: string; bucket: number }> {
    const experiment = await this.getExperiment(experimentId, organizationId);
    if (experiment.variants.length === 0) {
      throw new BadRequestException('No variants available for assignment.');
    }

    const variants = [...experiment.variants].sort((a, b) => a.id.localeCompare(b.id));
    const bucket = this.hashIdentity(identityKey) % variants.length;
    const variant = variants[bucket];

    return {
      variantId: variant.id,
      variantName: variant.name,
      bucket,
    };
  }

  async getAttributionSummary(experimentId: string, organizationId: string) {
    const stats = await this.getExperimentStats(experimentId, organizationId);
    const winner = stats.variants
      .filter((variant) => !variant.isControl && typeof variant.upliftPercent === 'number')
      .sort((a, b) => (b.upliftPercent ?? 0) - (a.upliftPercent ?? 0))[0];

    const confidenceScore = winner
      ? Number(
          Math.min((winner.sampleSize / 500) * 0.7 + Math.min((winner.upliftPercent ?? 0) / 20, 1) * 0.3, 1).toFixed(4),
        )
      : 0.4;

    return {
      experimentId,
      confidenceScore,
      winner: winner
        ? {
            id: winner.id,
            name: winner.name,
            upliftPercent: winner.upliftPercent ?? 0,
            sampleSize: winner.sampleSize,
          }
        : null,
      attributionQuality: winner && winner.sampleSize >= 200 ? 'high' : winner ? 'medium' : 'low',
      variants: stats.variants,
    };
  }

  /** Add a variant to experiment */
  async addVariant(
    experimentId: string,
    organizationId: string,
    input: AddVariantInput,
  ): Promise<ExperimentVariant> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot add variants to non-draft experiments',
      );
    }

    if (!input.name?.trim()) {
      throw new BadRequestException('Variant name is required');
    }

    // Check if control already exists if adding control
    if (input.isControl) {
      const existingControl = experiment.variants.find((v: ExperimentVariant) => v.isControl);
      if (existingControl) {
        throw new BadRequestException(
          'Experiment already has a control variant',
        );
      }
    }

    return this.prisma.experimentVariant.create({
      data: {
        experimentId,
        name: input.name,
        description: input.description || null,
        isControl: input.isControl || false,
      },
    });
  }

  /** Record metric result for a variant in a time period */
  async recordResult(
    experimentId: string,
    organizationId: string,
    input: RecordResultInput,
  ): Promise<ExperimentResult> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status !== ExperimentStatus.RUNNING) {
      throw new BadRequestException(
        'Can only record results for running experiments',
      );
    }

    const variant = experiment.variants.find((v: ExperimentVariant) => v.id === input.variantId);
    if (!variant) {
      throw new NotFoundException('Variant not found in this experiment');
    }

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    if (periodStart >= periodEnd) {
      throw new BadRequestException('Period start must be before period end');
    }

    try {
      return await this.prisma.experimentResult.upsert({
        where: {
          variantId_periodStart_periodEnd: {
            variantId: input.variantId,
            periodStart: periodStart,
            periodEnd: periodEnd,
          },
        },
        create: {
          variantId: input.variantId,
          periodStart,
          periodEnd,
          metricValue: input.metricValue,
          sampleSize: input.sampleSize || 0,
        },
        update: {
          metricValue: input.metricValue,
          sampleSize: input.sampleSize || 0,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException(
          'Result already exists for this variant and period',
        );
      }
      throw err;
    }
  }

  /** Calculate uplift statistics for experiment variants */
  async getExperimentStats(
    experimentId: string,
    organizationId: string,
  ): Promise<{
    variants: Array<{
      id: string;
      name: string;
      isControl: boolean;
      avgMetricValue: number;
      sampleSize: number;
      upliftPercent?: number;
      resultsCount: number;
    }>;
  }> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    const variants: Array<{
      id: string;
      name: string;
      isControl: boolean;
      avgMetricValue: number;
      sampleSize: number;
      upliftPercent?: number;
      resultsCount: number;
    }> = experiment.variants.map((variant: ExperimentVariant & { results: ExperimentResult[] }) => {
      const results = variant.results as ExperimentResult[];
      const avgMetricValue =
        results.length > 0
          ? results.reduce((sum, r) => sum + Number(r.metricValue), 0) /
            results.length
          : 0;

      const totalSampleSize = results.reduce((sum, r) => sum + r.sampleSize, 0);

      return {
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        avgMetricValue,
        sampleSize: totalSampleSize,
        resultsCount: results.length,
      };
    });

    // Calculate uplift vs control
    const control = variants.find((v) => v.isControl);
    if (control?.avgMetricValue) {
      variants.forEach((v) => {
        if (!v.isControl) {
          v.upliftPercent =
            ((v.avgMetricValue - control.avgMetricValue) /
              control.avgMetricValue) *
            100;
        }
      });
    }

    return { variants };
  }

  /** Update experiment details */
  async updateExperiment(
    experimentId: string,
    organizationId: string,
    input: UpdateExperimentInput,
  ): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status !== ExperimentStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot update non-draft experiments',
      );
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        title: input.title ?? experiment.title,
        hypothesis: input.hypothesis ?? experiment.hypothesis,
        targetMetric: input.targetMetric ?? experiment.targetMetric,
      },
    });
  }

  /** Pause experiment */
  async archiveExperiment(
    experimentId: string,
    organizationId: string,
  ): Promise<Experiment> {
    const experiment = await this.getExperiment(experimentId, organizationId);

    if (experiment.status === ExperimentStatus.PAUSED) {
      throw new BadRequestException('Experiment is already paused');
    }

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: { status: ExperimentStatus.PAUSED },
    });
  }

  private hashIdentity(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }

    return Math.abs(hash);
  }
}

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
  Prisma,
} from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
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

    return this.prisma.experiment.update({
      where: { id: experimentId },
      data: {
        status: ExperimentStatus.COMPLETED,
        endDate: new Date(),
      },
    });
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
}

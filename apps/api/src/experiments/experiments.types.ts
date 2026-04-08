import { AlertMetric, Experiment, ExperimentResult, ExperimentVariant } from '@prisma/client';

export interface CreateExperimentInput {
  title: string;
  hypothesis: string;
  targetMetric?: AlertMetric;
}

export interface UpdateExperimentInput {
  title?: string;
  hypothesis?: string;
  targetMetric?: AlertMetric;
}

export interface AddVariantInput {
  name: string;
  description?: string;
  isControl?: boolean;
}

export interface RecordResultInput {
  variantId: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  metricValue: number | string;
  sampleSize?: number;
}

export interface ExperimentWithVariants extends Experiment {
  variants: Array<ExperimentVariant & { results: ExperimentResult[] }>;
}

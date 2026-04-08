import { CompetitorSignalType, Industry } from '@prisma/client';

export interface TrendBucket {
  date: string;
  total: number;
  byType: Partial<Record<CompetitorSignalType, number>>;
}

export interface CompetitorComparisonEntry {
  id: string;
  name: string;
  signalCounts: Partial<Record<CompetitorSignalType, number>>;
  total: number;
}

export interface CompetitiveAlertEvalRule {
  signalType: CompetitorSignalType;
  windowDays: number;
  minCount: number;
  competitorId?: string;
}

export interface CreateCompetitorInput {
  name: string;
  website?: string;
  industry?: Industry;
  notes?: string;
}

export interface CreateCompetitorSignalInput {
  competitorId: string;
  signalType: CompetitorSignalType;
  value: string;
  unit?: string;
  source?: string;
  date: string | Date;
  notes?: string;
}

export interface ListCompetitorSignalsFilters {
  competitorId?: string;
  signalType?: CompetitorSignalType;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

import { IntegrationProvider, IntegrationStatus, IntegrationSyncStatus } from '@prisma/client';

export type NormalizedRecordType =
  | 'marketingMetric'
  | 'revenueEvent'
  | 'customerEvent'
  | 'salesPipelineEvent';

export interface NormalizedMarketingMetric {
  recordType: 'marketingMetric';
  campaignName: string;
  channelName: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  date: string;
}

export interface NormalizedRevenueEvent {
  recordType: 'revenueEvent';
  customerExternalId?: string;
  amount: number;
  currency: string;
  eventType: string;
  timestamp: string;
}

export interface NormalizedCustomerEvent {
  recordType: 'customerEvent';
  customerExternalId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface NormalizedSalesPipelineEvent {
  recordType: 'salesPipelineEvent';
  pipelineName: string;
  stageName: string;
  value: number;
  probability: number;
  closeDate?: string;
}

export type NormalizedRecord =
  | NormalizedMarketingMetric
  | NormalizedRevenueEvent
  | NormalizedCustomerEvent
  | NormalizedSalesPipelineEvent;

export interface NormalizedRecordValidationIssue {
  index: number;
  recordType: NormalizedRecordType;
  reason: string;
}

export interface NormalizedRecordValidationSummary {
  total: number;
  accepted: number;
  rejected: number;
  issues: NormalizedRecordValidationIssue[];
}

export interface ConnectorSyncResult {
  provider: IntegrationProvider;
  status: IntegrationSyncStatus;
  records: NormalizedRecord[];
  syncedAt: string;
  health: 'healthy' | 'degraded' | 'error';
  errorMessage?: string;
}

export interface IntegrationHealth {
  status: 'healthy' | 'degraded' | 'error';
  message: string;
  lastSyncAt?: string;
}

export interface IntegrationConnectionPayload {
  organizationId: string;
  provider: IntegrationProvider;
  credentials: {
    accessToken: string;
    refreshToken?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface IntegrationSummary {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: IntegrationSyncStatus;
  health: IntegrationHealth;
}

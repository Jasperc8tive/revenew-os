import {
  NormalizedCustomerEvent,
  NormalizedMarketingMetric,
  NormalizedRevenueEvent,
  NormalizedSalesPipelineEvent,
} from '../../integrations/types/integration.types';

export const normalizeMarketingMetric = (
  overrides: Partial<NormalizedMarketingMetric> = {},
): NormalizedMarketingMetric => ({
  recordType: 'marketingMetric',
  campaignName: overrides.campaignName ?? 'Imported Campaign',
  channelName: overrides.channelName ?? 'Imported Channel',
  impressions: overrides.impressions ?? 0,
  clicks: overrides.clicks ?? 0,
  cost: overrides.cost ?? 0,
  conversions: overrides.conversions ?? 0,
  date: overrides.date ?? new Date().toISOString(),
});

export const normalizeRevenueEvent = (
  overrides: Partial<NormalizedRevenueEvent> = {},
): NormalizedRevenueEvent => ({
  recordType: 'revenueEvent',
  customerExternalId: overrides.customerExternalId,
  amount: overrides.amount ?? 0,
  currency: overrides.currency ?? 'NGN',
  eventType: overrides.eventType ?? 'ONE_TIME_PURCHASE',
  timestamp: overrides.timestamp ?? new Date().toISOString(),
});

export const normalizeCustomerEvent = (
  overrides: Partial<NormalizedCustomerEvent> = {},
): NormalizedCustomerEvent => ({
  recordType: 'customerEvent',
  customerExternalId: overrides.customerExternalId ?? 'external-customer',
  eventType: overrides.eventType ?? 'CUSTOM',
  metadata: overrides.metadata,
  timestamp: overrides.timestamp ?? new Date().toISOString(),
});

export const normalizeSalesPipelineEvent = (
  overrides: Partial<NormalizedSalesPipelineEvent> = {},
): NormalizedSalesPipelineEvent => ({
  recordType: 'salesPipelineEvent',
  pipelineName: overrides.pipelineName ?? 'Imported Pipeline',
  stageName: overrides.stageName ?? 'QUALIFIED',
  value: overrides.value ?? 0,
  probability: overrides.probability ?? 0,
  closeDate: overrides.closeDate,
});

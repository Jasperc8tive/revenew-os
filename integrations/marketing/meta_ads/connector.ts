import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeMarketingMetric } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class MetaAdsConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.META_ADS, 'marketing');
  }

  protected async ingest() {
    const adAccountId = process.env.META_ADS_ACCOUNT_ID;
    if (!adAccountId) {
      throw new Error('META_ADS_ACCOUNT_ID is required for Meta Ads sync.');
    }

    const response = await this.authenticatedGet<{
      data?: Array<{
        campaign_name?: string;
        impressions?: string;
        clicks?: string;
        spend?: string;
        actions?: Array<{ action_type?: string; value?: string }>;
        date_start?: string;
      }>;
    }>(`https://graph.facebook.com/v19.0/act_${adAccountId}/insights`, {
      level: 'campaign',
      limit: 50,
      fields: 'campaign_name,impressions,clicks,spend,actions,date_start',
    });

    return (response.data ?? []).map((insight) => {
      const conversion = (insight.actions ?? []).find((action) => action.action_type === 'offsite_conversion');

      return normalizeMarketingMetric({
        campaignName: insight.campaign_name ?? 'Meta Campaign',
        channelName: 'Meta Ads',
        impressions: Number(insight.impressions ?? 0),
        clicks: Number(insight.clicks ?? 0),
        cost: Number(insight.spend ?? 0),
        conversions: Number(conversion?.value ?? 0),
        date: insight.date_start ?? new Date().toISOString(),
      });
    });
  }
}

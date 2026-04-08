import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeMarketingMetric } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class TikTokAdsConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.TIKTOK_ADS, 'marketing');
  }

  protected async ingest() {
    const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID;
    if (!advertiserId) {
      throw new Error('TIKTOK_ADS_ADVERTISER_ID is required for TikTok Ads sync.');
    }

    const response = await this.httpClient.get<{
      data?: {
        list?: Array<{
          campaign_name?: string;
          stat_cost?: string;
          stat_impressions?: string;
          stat_clicks?: string;
          stat_conversions?: string;
          stat_time_day?: string;
        }>;
      };
    }>('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/', {
      params: {
        advertiser_id: advertiserId,
        dimensions: 'campaign_id',
        metrics: 'campaign_name,stat_cost,stat_impressions,stat_clicks,stat_conversions,stat_time_day',
      },
      headers: this.buildBearerHeaders(),
    });

    return (response.data.data?.list ?? []).map((item) =>
      normalizeMarketingMetric({
        campaignName: item.campaign_name ?? 'TikTok Campaign',
        channelName: 'TikTok Ads',
        impressions: Number(item.stat_impressions ?? 0),
        clicks: Number(item.stat_clicks ?? 0),
        cost: Number(item.stat_cost ?? 0),
        conversions: Number(item.stat_conversions ?? 0),
        date: item.stat_time_day ?? new Date().toISOString(),
      }),
    );
  }
}

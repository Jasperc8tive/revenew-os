import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeMarketingMetric } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class LinkedInAdsConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.LINKEDIN_ADS, 'marketing');
  }

  protected async ingest() {
    const accountId = process.env.LINKEDIN_ADS_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('LINKEDIN_ADS_ACCOUNT_ID is required for LinkedIn Ads sync.');
    }

    const response = await this.httpClient.get<{
      elements?: Array<{
        campaign?: string;
        impressions?: number;
        clicks?: number;
        costInLocalCurrency?: number;
        dateRange?: { start?: { day?: number; month?: number; year?: number } };
      }>;
    }>('https://api.linkedin.com/rest/adAnalytics', {
      params: {
        q: 'analytics',
        pivot: 'CAMPAIGN',
        dateRange: 'LAST_30_DAYS',
        accounts: `List(urn:li:sponsoredAccount:${accountId})`,
      },
      headers: {
        ...this.buildBearerHeaders(),
        'LinkedIn-Version': '202405',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    return (response.data.elements ?? []).map((item) => {
      const day = item.dateRange?.start?.day ?? 1;
      const month = item.dateRange?.start?.month ?? 1;
      const year = item.dateRange?.start?.year ?? new Date().getFullYear();

      return normalizeMarketingMetric({
        campaignName: item.campaign ?? 'LinkedIn Campaign',
        channelName: 'LinkedIn Ads',
        impressions: item.impressions ?? 0,
        clicks: item.clicks ?? 0,
        cost: item.costInLocalCurrency ?? 0,
        conversions: 0,
        date: new Date(year, month - 1, day).toISOString(),
      });
    });
  }
}

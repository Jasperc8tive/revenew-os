import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeMarketingMetric } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class GoogleAdsConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.GOOGLE_ADS, 'marketing');
  }

  protected async ingest() {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!customerId || !developerToken) {
      throw new Error('GOOGLE_ADS_CUSTOMER_ID and GOOGLE_ADS_DEVELOPER_TOKEN are required.');
    }

    const response = await this.httpClient.post<
      Array<{
        results?: Array<{
          campaign?: { name?: string };
          metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number };
          segments?: { date?: string };
        }>;
      }>
    >(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
      {
        query:
          'SELECT campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, segments.date FROM campaign ORDER BY segments.date DESC LIMIT 50',
      },
      {
        headers: {
          ...this.buildBearerHeaders(),
          'developer-token': developerToken,
        },
      },
    );

    const rows = response.data.flatMap((chunk) => chunk.results ?? []);

    return rows.map((row) =>
      normalizeMarketingMetric({
        campaignName: row.campaign?.name ?? 'Google Ads Campaign',
        channelName: 'Google Ads',
        impressions: Number(row.metrics?.impressions ?? 0),
        clicks: Number(row.metrics?.clicks ?? 0),
        cost: Number(row.metrics?.costMicros ?? 0) / 1_000_000,
        conversions: Number(row.metrics?.conversions ?? 0),
        date: row.segments?.date ?? new Date().toISOString(),
      }),
    );
  }
}

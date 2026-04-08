import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class GoogleAnalyticsConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.GOOGLE_ANALYTICS, 'analytics');
  }

  protected async ingest() {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      throw new Error('GA4_PROPERTY_ID is required for Google Analytics sync.');
    }

    const response = await this.httpClient.post<{
      rows?: Array<{ dimensionValues?: Array<{ value?: string }> }>;
    }>(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        limit: 50,
      },
      {
        headers: this.buildBearerHeaders(),
      },
    );

    return (response.data.rows ?? []).map((row, index) =>
      normalizeCustomerEvent({
        customerExternalId: `ga-user-${index + 1}`,
        eventType: (row.dimensionValues?.[0]?.value ?? 'CUSTOM').toUpperCase(),
        metadata: { source: 'google-analytics' },
      }),
    );
  }
}

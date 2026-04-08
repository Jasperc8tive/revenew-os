import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class AmplitudeConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.AMPLITUDE, 'analytics');
  }

  protected async ingest() {
    const response = await this.httpClient.get<{
      data?: { seriesLabels?: string[] };
    }>('https://amplitude.com/api/2/events/segmentation', {
      params: {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
        m: JSON.stringify([{ event_type: '_all' }]),
      },
      headers: this.buildBearerHeaders(),
    });

    return (response.data.data?.seriesLabels ?? []).map((eventType, index) =>
      normalizeCustomerEvent({
        customerExternalId: `amplitude-user-${index + 1}`,
        eventType: eventType.toUpperCase(),
        metadata: { source: 'amplitude' },
      }),
    );
  }
}

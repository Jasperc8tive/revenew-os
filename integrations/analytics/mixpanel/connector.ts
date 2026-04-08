import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class MixpanelConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.MIXPANEL, 'analytics');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<Array<{ event?: string; properties?: { distinct_id?: string } }>>(
      'https://data.mixpanel.com/api/2.0/export',
      {
        from_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        to_date: new Date().toISOString().slice(0, 10),
        limit: 50,
      },
    );

    return (response ?? []).map((event, index) =>
      normalizeCustomerEvent({
        customerExternalId: event.properties?.distinct_id ?? `mixpanel-user-${index + 1}`,
        eventType: (event.event ?? 'CUSTOM').toUpperCase(),
        metadata: { source: 'mixpanel' },
      }),
    );
  }
}

import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class PostHogConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.POSTHOG, 'analytics');
  }

  protected async ingest() {
    const projectId = process.env.POSTHOG_PROJECT_ID;
    if (!projectId) {
      throw new Error('POSTHOG_PROJECT_ID is required for PostHog sync.');
    }

    const response = await this.authenticatedGet<{
      results?: Array<{ event?: string; distinct_id?: string }>;
    }>(`https://app.posthog.com/api/projects/${projectId}/events/`, { limit: 50 });

    return (response.results ?? []).map((event, index) =>
      normalizeCustomerEvent({
        customerExternalId: event.distinct_id ?? `posthog-user-${index + 1}`,
        eventType: (event.event ?? 'CUSTOM').toUpperCase(),
        metadata: { source: 'posthog' },
      }),
    );
  }
}

import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeRevenueEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class StripeConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.STRIPE, 'payments');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      data?: Array<{ amount_received?: number; currency?: string; customer?: string; created?: number }>;
    }>('https://api.stripe.com/v1/payment_intents', { limit: 50 });

    return (response.data ?? [])
      .filter((intent) => (intent.amount_received ?? 0) > 0)
      .map((intent) =>
        normalizeRevenueEvent({
          customerExternalId: intent.customer,
          amount: (intent.amount_received ?? 0) / 100,
          currency: intent.currency?.toUpperCase() ?? 'USD',
          eventType: 'ONE_TIME_PURCHASE',
          timestamp: intent.created
            ? new Date(intent.created * 1000).toISOString()
            : new Date().toISOString(),
        }),
      );
  }
}

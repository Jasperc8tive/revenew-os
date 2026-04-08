import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeRevenueEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class FlutterwaveConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.FLUTTERWAVE, 'payments');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      data?: Array<{ amount?: number; currency?: string; customer?: { email?: string }; created_at?: string }>;
    }>('https://api.flutterwave.com/v3/transactions', { status: 'successful' });

    return (response.data ?? []).map((transaction) =>
      normalizeRevenueEvent({
        customerExternalId: transaction.customer?.email,
        amount: transaction.amount ?? 0,
        currency: transaction.currency ?? 'NGN',
        eventType: 'ONE_TIME_PURCHASE',
        timestamp: transaction.created_at ?? new Date().toISOString(),
      }),
    );
  }
}

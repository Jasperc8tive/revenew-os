import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeRevenueEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class PaystackConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.PAYSTACK, 'payments');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      data?: Array<{ amount?: number; currency?: string; customer?: { email?: string }; paid_at?: string }>;
    }>('https://api.paystack.co/transaction', { perPage: 50 });

    return (response.data ?? []).map((transaction) =>
      normalizeRevenueEvent({
        customerExternalId: transaction.customer?.email,
        amount: (transaction.amount ?? 0) / 100,
        currency: transaction.currency ?? 'NGN',
        eventType: 'ONE_TIME_PURCHASE',
        timestamp: transaction.paid_at ?? new Date().toISOString(),
      }),
    );
  }
}

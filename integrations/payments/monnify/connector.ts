import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeRevenueEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class MonnifyConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.MONNIFY, 'payments');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      responseBody?: {
        content?: Array<{
          amount?: number;
          currencyCode?: string;
          customerEmail?: string;
          paidOn?: string;
        }>;
      };
    }>('https://api.monnify.com/api/v1/transactions/search', { size: 50 });

    return (response.responseBody?.content ?? []).map((transaction) =>
      normalizeRevenueEvent({
        customerExternalId: transaction.customerEmail,
        amount: transaction.amount ?? 0,
        currency: transaction.currencyCode ?? 'NGN',
        eventType: 'ONE_TIME_PURCHASE',
        timestamp: transaction.paidOn ?? new Date().toISOString(),
      }),
    );
  }
}

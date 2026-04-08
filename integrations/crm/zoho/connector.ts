import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class ZohoConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.ZOHO, 'crm');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      data?: Array<{
        Deal_Name?: string;
        Stage?: string;
        Amount?: number;
        Probability?: number;
        Closing_Date?: string;
      }>;
    }>('https://www.zohoapis.com/crm/v2/Deals', { per_page: 50 });

    return (response.data ?? []).map((deal) =>
      normalizeSalesPipelineEvent({
        pipelineName: deal.Deal_Name ?? 'Zoho Pipeline',
        stageName: (deal.Stage ?? 'QUALIFIED').toUpperCase(),
        value: deal.Amount ?? 0,
        probability: deal.Probability ?? 50,
        closeDate: deal.Closing_Date,
      }),
    );
  }
}

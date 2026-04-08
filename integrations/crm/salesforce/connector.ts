import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class SalesforceConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.SALESFORCE, 'crm');
  }

  protected async ingest() {
    const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
    if (!instanceUrl) {
      throw new Error('SALESFORCE_INSTANCE_URL is required for Salesforce sync.');
    }

    const query =
      'SELECT Amount, StageName, Probability, CloseDate, PipelineName FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 50';
    const response = await this.authenticatedGet<{
      records?: Array<{
        Amount?: number;
        StageName?: string;
        Probability?: number;
        CloseDate?: string;
        PipelineName?: string;
      }>;
    }>(`${instanceUrl}/services/data/v60.0/query`, { q: query });

    return (response.records ?? []).map((deal) =>
      normalizeSalesPipelineEvent({
        pipelineName: deal.PipelineName ?? 'Salesforce Pipeline',
        stageName: (deal.StageName ?? 'QUALIFIED').toUpperCase(),
        value: deal.Amount ?? 0,
        probability: deal.Probability ?? 50,
        closeDate: deal.CloseDate,
      }),
    );
  }
}

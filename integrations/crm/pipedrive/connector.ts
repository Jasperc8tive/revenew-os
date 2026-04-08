import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class PipedriveConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.PIPEDRIVE, 'crm');
  }

  protected async ingest() {
    const companyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;
    if (!companyDomain) {
      throw new Error('PIPEDRIVE_COMPANY_DOMAIN is required for Pipedrive sync.');
    }

    const response = await this.authenticatedGet<{
      data?: Array<{ title?: string; value?: number; status?: string; expected_close_date?: string }>;
    }>(`https://${companyDomain}.pipedrive.com/api/v1/deals`, { limit: 50 });

    return (response.data ?? []).map((deal) =>
      normalizeSalesPipelineEvent({
        pipelineName: 'Pipedrive Pipeline',
        stageName: (deal.status ?? 'QUALIFIED').toUpperCase(),
        value: deal.value ?? 0,
        probability: deal.status === 'won' ? 100 : 50,
        closeDate: deal.expected_close_date,
      }),
    );
  }
}

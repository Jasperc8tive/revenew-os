import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class HubSpotConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.HUBSPOT, 'crm');
  }

  protected async ingest() {
    const response = await this.authenticatedGet<{
      results?: Array<{
        properties?: { pipeline?: string; dealstage?: string; amount?: string; closedate?: string };
      }>;
    }>('https://api.hubapi.com/crm/v3/objects/deals', {
      limit: 50,
      properties: 'pipeline,dealstage,amount,closedate',
    });

    return (response.results ?? []).map((deal) =>
      normalizeSalesPipelineEvent({
        pipelineName: deal.properties?.pipeline ?? 'HubSpot Pipeline',
        stageName: (deal.properties?.dealstage ?? 'QUALIFIED').toUpperCase(),
        value: Number(deal.properties?.amount ?? 0),
        probability: 50,
        closeDate: deal.properties?.closedate,
      }),
    );
  }
}

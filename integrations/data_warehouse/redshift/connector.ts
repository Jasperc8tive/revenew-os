import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class RedshiftConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.REDSHIFT, 'data-warehouse');
  }

  protected async ingest() {
    const apiBaseUrl = process.env.REDSHIFT_API_BASE_URL;
    if (!apiBaseUrl) {
      throw new Error('REDSHIFT_API_BASE_URL is required for Redshift sync.');
    }

    const response = await this.authenticatedGet<{
      records?: Array<{
        pipeline_name?: string;
        stage_name?: string;
        value?: number;
        probability?: number;
      }>;
    }>(`${apiBaseUrl}/pipeline-facts`, { limit: 50 });

    return (response.records ?? []).map((row) =>
      normalizeSalesPipelineEvent({
        pipelineName: row.pipeline_name ?? 'Redshift Pipeline',
        stageName: (row.stage_name ?? 'QUALIFIED').toUpperCase(),
        value: row.value ?? 0,
        probability: row.probability ?? 50,
      }),
    );
  }
}

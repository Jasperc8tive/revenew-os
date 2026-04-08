import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class BigQueryConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.BIGQUERY, 'data-warehouse');
  }

  protected async ingest() {
    const projectId = process.env.BIGQUERY_PROJECT_ID;
    if (!projectId) {
      throw new Error('BIGQUERY_PROJECT_ID is required for BigQuery sync.');
    }

    const response = await this.httpClient.post<{
      rows?: Array<{ f?: Array<{ v?: string }> }>;
    }>(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
      {
        query:
          'SELECT pipeline_name, stage_name, value, probability FROM revenue_pipeline_facts ORDER BY updated_at DESC LIMIT 50',
        useLegacySql: false,
      },
      {
        headers: this.buildBearerHeaders(),
      },
    );

    return (response.data.rows ?? []).map((row) =>
      normalizeSalesPipelineEvent({
        pipelineName: row.f?.[0]?.v ?? 'BigQuery Pipeline',
        stageName: (row.f?.[1]?.v ?? 'QUALIFIED').toUpperCase(),
        value: Number(row.f?.[2]?.v ?? 0),
        probability: Number(row.f?.[3]?.v ?? 50),
      }),
    );
  }
}

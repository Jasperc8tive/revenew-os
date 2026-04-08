import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class DatabricksConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.DATABRICKS, 'data-warehouse');
  }

  protected async ingest() {
    const workspaceUrl = process.env.DATABRICKS_WORKSPACE_URL;
    if (!workspaceUrl) {
      throw new Error('DATABRICKS_WORKSPACE_URL is required for Databricks sync.');
    }

    const response = await this.httpClient.post<{
      result?: {
        data_array?: Array<Array<string | number>>;
      };
    }>(
      `${workspaceUrl}/api/2.0/sql/statements`,
      {
        statement:
          'SELECT pipeline_name, stage_name, value, probability FROM revenue_pipeline_facts ORDER BY updated_at DESC LIMIT 50',
        warehouse_id: process.env.DATABRICKS_WAREHOUSE_ID,
      },
      {
        headers: this.buildBearerHeaders(),
      },
    );

    return (response.data.result?.data_array ?? []).map((row) =>
      normalizeSalesPipelineEvent({
        pipelineName: String(row[0] ?? 'Databricks Pipeline'),
        stageName: String(row[1] ?? 'QUALIFIED').toUpperCase(),
        value: Number(row[2] ?? 0),
        probability: Number(row[3] ?? 50),
      }),
    );
  }
}

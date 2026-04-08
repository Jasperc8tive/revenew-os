import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeSalesPipelineEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class SnowflakeConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.SNOWFLAKE, 'data-warehouse');
  }

  protected async ingest() {
    const account = process.env.SNOWFLAKE_ACCOUNT;
    if (!account) {
      throw new Error('SNOWFLAKE_ACCOUNT is required for Snowflake sync.');
    }

    const response = await this.httpClient.post<{
      data?: Array<{ PIPELINE_NAME?: string; STAGE_NAME?: string; VALUE?: number; PROBABILITY?: number }>;
    }>(
      `https://${account}.snowflakecomputing.com/api/v2/statements`,
      {
        statement:
          'SELECT PIPELINE_NAME, STAGE_NAME, VALUE, PROBABILITY FROM REVENUE_PIPELINE_FACTS ORDER BY UPDATED_AT DESC LIMIT 50',
      },
      {
        headers: this.buildBearerHeaders(),
      },
    );

    return (response.data.data ?? []).map((row) =>
      normalizeSalesPipelineEvent({
        pipelineName: row.PIPELINE_NAME ?? 'Snowflake Pipeline',
        stageName: (row.STAGE_NAME ?? 'QUALIFIED').toUpperCase(),
        value: row.VALUE ?? 0,
        probability: row.PROBABILITY ?? 50,
      }),
    );
  }
}

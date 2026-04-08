import { Injectable } from '@nestjs/common';
import { ConnectorSyncResult, IntegrationHealth } from '../types/integration.types';

@Injectable()
export class IntegrationMonitoringService {
  evaluateHealth(lastResult?: ConnectorSyncResult): IntegrationHealth {
    if (!lastResult) {
      return {
        status: 'degraded',
        message: 'No sync has been executed yet.',
      };
    }

    if (lastResult.status === 'FAILED') {
      return {
        status: 'error',
        message: lastResult.errorMessage ?? 'Last sync failed.',
        lastSyncAt: lastResult.syncedAt,
      };
    }

    if (lastResult.status === 'PARTIAL') {
      return {
        status: 'degraded',
        message: 'Last sync completed with partial data.',
        lastSyncAt: lastResult.syncedAt,
      };
    }

    return {
      status: 'healthy',
      message: 'Integration is healthy.',
      lastSyncAt: lastResult.syncedAt,
    };
  }
}

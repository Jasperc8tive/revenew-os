import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../base/base-integration.connector';

@Injectable()
export class ConnectorRegistry {
  private readonly connectors = new Map<IntegrationProvider, BaseIntegrationConnector>();

  register(connector: BaseIntegrationConnector): void {
    this.connectors.set(connector.getProvider(), connector);
  }

  get(provider: IntegrationProvider): BaseIntegrationConnector | undefined {
    return this.connectors.get(provider);
  }

  getAll(): BaseIntegrationConnector[] {
    return Array.from(this.connectors.values());
  }
}

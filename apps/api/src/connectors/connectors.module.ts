import { Module } from '@nestjs/common';
import { ConnectorRegistry } from './registry/connector-registry';
import { ConnectorsService } from './connectors.service';

@Module({
  providers: [ConnectorRegistry, ConnectorsService],
  exports: [ConnectorRegistry, ConnectorsService],
})
export class ConnectorsModule {}

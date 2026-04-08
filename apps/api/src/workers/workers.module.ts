import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectorsModule } from '../connectors/connectors.module';
import { DataQualityModule } from '../data-quality/data-quality.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { INTEGRATION_SYNC_QUEUE } from '../integrations/constants';
import { IntegrationSyncProcessor } from './processors/integration-sync.processor';

@Module({
	imports: [
		ConfigModule,
		ConnectorsModule,
		DataQualityModule,
		IntegrationsModule,
		BullModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				connection: {
					host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
					port: configService.get<number>('REDIS_PORT', 6379),
					lazyConnect: true,
				},
			}),
		}),
		BullModule.registerQueue({
			name: INTEGRATION_SYNC_QUEUE,
		}),
	],
	providers: [IntegrationSyncProcessor],
	exports: [BullModule],
})
export class WorkersModule {}

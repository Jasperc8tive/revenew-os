import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingModule } from '../billing/billing.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { IntegrationSyncScheduler } from '../scheduler/scheduler.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationCryptoService } from './services/integration-crypto.service';
import { IntegrationMonitoringService } from './services/integration-monitoring.service';

@Module({
	imports: [
		ConfigModule,
		BillingModule,
		ConnectorsModule,
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
			name: 'integration-sync',
		}),
	],
	controllers: [IntegrationsController],
	providers: [
		IntegrationsService,
		IntegrationCryptoService,
		IntegrationMonitoringService,
		IntegrationSyncScheduler,
	],
	exports: [IntegrationsService, IntegrationMonitoringService, IntegrationCryptoService],
})
export class IntegrationsModule {}

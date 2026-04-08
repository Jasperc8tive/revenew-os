import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingModule } from '../billing/billing.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { IntegrationCryptoService } from '../integrations/services/integration-crypto.service';
import { NotificationsController } from './notifications.controller';
import { AlertEvaluationScheduler } from './alert-evaluation.scheduler';
import { AlertRulesService } from './alert-rules.service';
import { NotificationsService } from './notifications.service';

@Module({
	imports: [AnalyticsModule, BillingModule, ConnectorsModule],
	controllers: [NotificationsController],
	providers: [AlertRulesService, NotificationsService, IntegrationCryptoService, AlertEvaluationScheduler],
	exports: [AlertRulesService, NotificationsService],
})
export class NotificationsModule {}

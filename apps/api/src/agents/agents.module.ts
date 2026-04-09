import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingModule } from '../billing/billing.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
	imports: [BillingModule, AnalyticsModule, RecommendationsModule],
	controllers: [AgentsController],
	providers: [AgentsService],
	exports: [AgentsService],
})
export class AgentsModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DataQualityModule } from '../data-quality/data-quality.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { AnalyticsAggregationService } from './analytics.aggregation.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ConfidenceScoringService } from './confidence-scoring.service';
import { VerifiedMetricsService } from './verified-metrics.service';

@Module({
	imports: [BillingModule, DataQualityModule, RecommendationsModule],
	controllers: [AnalyticsController],
	providers: [AnalyticsService, AnalyticsAggregationService, ConfidenceScoringService, VerifiedMetricsService],
	exports: [AnalyticsService],
})
export class AnalyticsModule {}

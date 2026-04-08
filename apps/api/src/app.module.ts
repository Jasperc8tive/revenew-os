import { Module } from '@nestjs/common';
import { AnalyticsModule } from './analytics/analytics.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import { PrismaModule } from './common/prisma/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WorkersModule } from './workers/workers.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BenchmarkingModule } from './benchmarking/benchmarking.module';
import { ForecastingModule } from './forecasting/forecasting.module';
import { CopilotModule } from './copilot/copilot.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { CompetitiveModule } from './competitive/competitive.module';
import { AuthModule } from './auth/auth.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { DataQualityModule } from './data-quality/data-quality.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '..', '.env'),
    }),
    AnalyticsModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    IntegrationsModule,
    WorkersModule,
    BillingModule,
    NotificationsModule,
    BenchmarkingModule,
    ForecastingModule,
    CopilotModule,
    ExperimentsModule,
    CompetitiveModule,
    AuthModule,
    RecommendationsModule,
    DataQualityModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}


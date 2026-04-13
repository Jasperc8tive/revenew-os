import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AnalyticsModule } from './analytics/analytics.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { resolve } from 'path';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtGuard } from './common/guards/jwt.guard';
import { validateEnv } from './config/env.validation';
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
import { OperationsModule } from './operations/operations.module';
import { AgentsModule } from './agents/agents.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';
import { GrowthIntelligenceModule } from './growth-intelligence/growth-intelligence.module';
import { GovernanceModule } from './governance/governance.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '..', '.env'),
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
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
    OperationsModule,
    AgentsModule,
    OnboardingModule,
    AdminModule,
    ReportsModule,
    GrowthIntelligenceModule,
    GovernanceModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}


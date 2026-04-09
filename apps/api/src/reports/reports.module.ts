import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { OperationsModule } from '../operations/operations.module';
import { ReportsController } from './reports.controller';
import { ReportsScheduler } from './reports.scheduler';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AnalyticsModule,
    BillingModule,
    NotificationsModule,
    OnboardingModule,
    OperationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsScheduler],
  exports: [ReportsService],
})
export class ReportsModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [BillingModule, OnboardingModule],
  controllers: [OperationsController],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}

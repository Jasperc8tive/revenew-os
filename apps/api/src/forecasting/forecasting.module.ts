import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { ForecastingController } from './forecasting.controller';
import { ForecastingService } from './forecasting.service';

@Module({
  imports: [BillingModule],
  controllers: [ForecastingController],
  providers: [ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { DataQualityController } from './data-quality.controller';
import { DataQualityService } from './data-quality.service';

@Module({
  imports: [BillingModule],
  controllers: [DataQualityController],
  providers: [DataQualityService],
  exports: [DataQualityService],
})
export class DataQualityModule {}

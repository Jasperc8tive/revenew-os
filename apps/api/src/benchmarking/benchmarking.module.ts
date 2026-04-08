import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { BenchmarkAggregationService } from './benchmark-aggregation.service';
import { BenchmarkingController } from './benchmarking.controller';
import { BenchmarkingService } from './benchmarking.service';

@Module({
  imports: [BillingModule],
  controllers: [BenchmarkingController],
  providers: [BenchmarkingService, BenchmarkAggregationService],
  exports: [BenchmarkingService, BenchmarkAggregationService],
})
export class BenchmarkingModule {}

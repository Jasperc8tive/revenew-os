import { Module } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { BillingModule } from '../billing/billing.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [BillingModule, RecommendationsModule],
  providers: [ExperimentsService],
  controllers: [ExperimentsController],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}

import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { GrowthIntelligenceController } from './growth-intelligence.controller';
import { GrowthIntelligenceService } from './growth-intelligence.service';

@Module({
  imports: [BillingModule],
  controllers: [GrowthIntelligenceController],
  providers: [GrowthIntelligenceService],
  exports: [GrowthIntelligenceService],
})
export class GrowthIntelligenceModule {}

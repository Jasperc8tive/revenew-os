import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CompetitiveController } from './competitive.controller';
import { CompetitiveService } from './competitive.service';

@Module({
  imports: [BillingModule],
  controllers: [CompetitiveController],
  providers: [CompetitiveService],
  exports: [CompetitiveService],
})
export class CompetitiveModule {}

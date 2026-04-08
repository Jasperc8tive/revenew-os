import { Module } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [ExperimentsService],
  controllers: [ExperimentsController],
  exports: [ExperimentsService],
})
export class ExperimentsModule {}

import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BillingAccessService } from '../billing/billing-access.service';
import { DataQualityService } from './data-quality.service';
import { ListDataQualityEventsDto } from './dto/list-data-quality-events.dto';
import { ScanAnomaliesDto } from './dto/scan-anomalies.dto';

@Controller('data-quality')
@UseGuards(JwtGuard)
export class DataQualityController {
  constructor(
    private readonly dataQualityService: DataQualityService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  @Get('events')
  async listEvents(@Query() query: ListDataQualityEventsDto) {
    await this.billingAccessService.assertFeatureAccess(query.organizationId, 'analytics.basic');
    return this.dataQualityService.listEvents(query);
  }

  @Get('summary')
  async getSummary(@Query('organizationId') organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    return this.dataQualityService.getSummary(organizationId);
  }

  @Post('anomalies/scan')
  async scanAnomalies(@Query() query: ScanAnomaliesDto) {
    await this.billingAccessService.assertFeatureAccess(query.organizationId, 'analytics.full');
    return this.dataQualityService.scanAndStoreAnomalies(
      query.organizationId,
      query.lookbackDays,
    );
  }
}

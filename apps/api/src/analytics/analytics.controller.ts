import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { VerifiedMetricWindow } from '@prisma/client';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BillingAccessService } from '../billing/billing-access.service';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  @Get('overview')
  async getOverview(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    return this.analyticsService.getOverview({ organizationId, startDate, endDate });
  }

  @Get('executive-summary')
  async getExecutiveSummary(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    return this.analyticsService.getExecutiveSummary({ organizationId, startDate, endDate });
  }

  @Get('verified-metrics')
  async getVerifiedMetrics(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('windowType') windowType?: VerifiedMetricWindow,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    return this.analyticsService.getVerifiedMetrics({ organizationId, startDate, endDate, windowType });
  }

  @Get('cac')
  async getCac(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('channel') channel?: string,
    @Query('campaign') campaign?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');
    return this.analyticsService.getCAC({
      organizationId,
      startDate,
      endDate,
      channel,
      campaign,
    });
  }

  @Get('ltv')
  async getLtv(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');
    return this.analyticsService.getLTV({ organizationId, startDate, endDate });
  }

  @Get('churn')
  async getChurn(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');
    return this.analyticsService.getChurn({ organizationId, startDate, endDate });
  }

  @Get('revenue')
  async getRevenue(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    return this.analyticsService.getRevenue({ organizationId, startDate, endDate });
  }

  @Get('pipeline')
  async getPipeline(
    @Query('organizationId') organizationId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');
    return this.analyticsService.getPipeline({ organizationId, startDate, endDate });
  }
}

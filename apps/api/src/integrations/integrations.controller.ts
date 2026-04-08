import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BillingAccessService } from '../billing/billing-access.service';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { SyncIntegrationDto } from './dto/sync-integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  @Post('connect')
  async connect(@Body() body: ConnectIntegrationDto) {
    await this.billingAccessService.assertFeatureAccess(body.organizationId, 'integrations.connect');
    return this.integrationsService.connect(body);
  }

  @Get()
  async list(@Query('organizationId') organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'integrations.list');
    return this.integrationsService.list(organizationId);
  }

  @Delete(':id')
  async disconnect(@Param('id') integrationId: string, @Query('organizationId') organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'integrations.list');
    return this.integrationsService.disconnect(organizationId, integrationId);
  }

  @Post(':id/sync')
  async sync(@Param('id') integrationId: string, @Body() body: SyncIntegrationDto) {
    await this.billingAccessService.assertFeatureAccess(body.organizationId, 'integrations.list');
    return this.integrationsService.enqueueSync(body.organizationId, integrationId, body.initiatedBy);
  }
}

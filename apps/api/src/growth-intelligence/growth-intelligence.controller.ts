import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GrowthIntelligenceService } from './growth-intelligence.service';

@UseGuards(JwtGuard)
@Controller('growth-intelligence')
export class GrowthIntelligenceController {
  constructor(private readonly growthIntelligenceService: GrowthIntelligenceService) {}

  @Get('graph')
  graph(@Query('organizationId') organizationId: string) {
    return this.growthIntelligenceService.buildGraph(organizationId);
  }

  @Get('context')
  context(@Query('organizationId') organizationId: string) {
    return this.growthIntelligenceService.getStrategicContext(organizationId);
  }
}

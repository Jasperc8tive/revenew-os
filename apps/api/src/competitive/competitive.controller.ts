import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { CompetitorSignalType, Industry } from '@prisma/client';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CompetitiveService } from './competitive.service';
import { CompetitiveAlertEvalRule, CreateCompetitorInput, CreateCompetitorSignalInput } from './competitive.types';

@Controller('competitive')
@UseGuards(JwtGuard)
export class CompetitiveController {
  constructor(private readonly competitiveService: CompetitiveService) {}

  @Post('competitors')
  createCompetitor(@Body() input: CreateCompetitorInput & { organizationId: string }) {
    const { organizationId, ...payload } = input;
    return this.competitiveService.createCompetitor(organizationId, payload);
  }

  @Get('competitors')
  listCompetitors(@Query('organizationId') organizationId: string) {
    return this.competitiveService.listCompetitors(organizationId);
  }

  @Post('signals')
  createSignal(@Body() input: CreateCompetitorSignalInput & { organizationId: string }) {
    const { organizationId, ...payload } = input;
    return this.competitiveService.createSignal(organizationId, payload);
  }

  @Get('signals')
  listSignals(
    @Query('organizationId') organizationId: string,
    @Query('competitorId') competitorId?: string,
    @Query('signalType') signalType?: CompetitorSignalType,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.competitiveService.listSignals(organizationId, {
      competitorId,
      signalType,
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('overview')
  getOverview(@Query('organizationId') organizationId: string) {
    return this.competitiveService.getOverview(organizationId);
  }

  @Get('enums')
  getEnums() {
    return {
      signalTypes: Object.values(CompetitorSignalType),
      industries: Object.values(Industry),
    };
  }

  @Get('trend')
  getSignalTrend(
    @Query('organizationId') organizationId: string,
    @Query('days') days?: string,
    @Query('competitorId') competitorId?: string,
    @Query('signalType') signalType?: CompetitorSignalType,
  ) {
    return this.competitiveService.getSignalTrend(
      organizationId,
      days ? parseInt(days, 10) : 30,
      competitorId,
      signalType,
    );
  }

  @Get('comparison')
  getCompetitorComparison(
    @Query('organizationId') organizationId: string,
    @Query('days') days?: string,
  ) {
    return this.competitiveService.getCompetitorComparison(
      organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('actionable-deltas')
  actionableDeltas(
    @Query('organizationId') organizationId: string,
    @Query('days') days?: string,
  ) {
    return this.competitiveService.getActionableDeltas(
      organizationId,
      days ? parseInt(days, 10) : 14,
    );
  }

  @Post('brief')
  @HttpCode(200)
  generateWeeklyBrief(@Body('organizationId') organizationId: string) {
    return this.competitiveService.generateWeeklyBrief(organizationId);
  }

  @Post('alerts/evaluate')
  @HttpCode(200)
  evaluateAlerts(
    @Body('organizationId') organizationId: string,
    @Body('rules') rules: CompetitiveAlertEvalRule[],
  ) {
    return this.competitiveService.evaluateAlerts(organizationId, rules ?? []);
  }
}

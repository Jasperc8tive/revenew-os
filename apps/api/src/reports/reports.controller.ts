import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import {
  CreateReportScheduleDto,
  ExportReportDto,
  GenerateReportDto,
  ReportQueryDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@UseGuards(JwtGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('templates')
  listTemplates(@Query() query: ReportQueryDto) {
    return this.reportsService.listTemplates(query.organizationId);
  }

  @Get('runs')
  listRuns(@Req() req: Request, @Query() query: ReportQueryDto) {
    return this.reportsService.listRuns({
      organizationId: query.organizationId,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }

  @Post('generate')
  generate(@Req() req: Request, @Body() body: GenerateReportDto) {
    return this.reportsService.generateReport({
      organizationId: body.organizationId,
      template: body.template,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }

  @Get('runs/:id/export')
  exportRun(
    @Req() req: Request,
    @Param('id') runId: string,
    @Query() query: ExportReportDto,
  ) {
    return this.reportsService.exportRun({
      organizationId: query.organizationId,
      runId,
      format: query.format,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }

  @Post('schedules')
  createSchedule(@Req() req: Request, @Body() body: CreateReportScheduleDto) {
    return this.reportsService.createSchedule({
      organizationId: body.organizationId,
      template: body.template,
      cronExpression: body.cronExpression,
      channels: body.channels,
      maxRunsPerDay: body.maxRunsPerDay,
      actorUserId: (req as Request & { user?: { id?: string } }).user?.id,
    });
  }

  @Get('schedules')
  listSchedules(@Req() req: Request, @Query() query: ReportQueryDto) {
    return this.reportsService.listSchedules(
      query.organizationId,
      (req as Request & { user?: { id?: string } }).user?.id,
    );
  }
}

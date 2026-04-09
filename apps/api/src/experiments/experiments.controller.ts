import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ExperimentsService } from './experiments.service';
import {
  CreateExperimentInput,
  UpdateExperimentInput,
  AddVariantInput,
  RecordResultInput,
} from './experiments.types';
import { ExperimentStatus, AlertMetric } from '@prisma/client';

@Controller('experiments')
@UseGuards(JwtGuard)
export class ExperimentsController {
  constructor(private experimentsService: ExperimentsService) {}

  /** Create new experiment */
  @Post()
  async createExperiment(@Body() input: CreateExperimentInput & { organizationId: string }) {
    const { organizationId, ...payload } = input;
    return this.experimentsService.createExperiment(organizationId, payload);
  }

  /** List experiments for organization */
  @Get()
  async listExperiments(
    @Query('organizationId') organizationId: string,
    @Query('status') status?: ExperimentStatus,
    @Query('metric') metric?: AlertMetric,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.experimentsService.listExperiments(organizationId, {
      status,
      metric,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /** Get experiment details with variants */
  @Get(':experimentId')
  async getExperiment(
    @Query('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.getExperiment(experimentId, organizationId);
  }

  /** Launch experiment (DRAFT → RUNNING) */
  @Post(':experimentId/launch')
  @HttpCode(200)
  async launchExperiment(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.launchExperiment(
      experimentId,
      organizationId,
    );
  }

  /** Complete experiment (RUNNING → COMPLETED) */
  @Post(':experimentId/complete')
  @HttpCode(200)
  async completeExperiment(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.completeExperiment(
      experimentId,
      organizationId,
    );
  }

  /** Archive experiment */
  @Post(':experimentId/archive')
  @HttpCode(200)
  async archiveExperiment(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.archiveExperiment(
      experimentId,
      organizationId,
    );
  }

  /** Update experiment (only in DRAFT) */
  @Put(':experimentId')
  async updateExperiment(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
    @Body() input: UpdateExperimentInput & { organizationId?: string },
  ) {
    return this.experimentsService.updateExperiment(
      experimentId,
      organizationId,
      {
        title: input.title,
        hypothesis: input.hypothesis,
        targetMetric: input.targetMetric,
      },
    );
  }

  /** Add variant to experiment */
  @Post(':experimentId/variants')
  async addVariant(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
    @Body() input: AddVariantInput & { organizationId?: string },
  ) {
    return this.experimentsService.addVariant(
      experimentId,
      organizationId,
      {
        name: input.name,
        description: input.description,
        isControl: input.isControl,
      },
    );
  }

  /** Record result for a variant */
  @Post(':experimentId/results')
  async recordResult(
    @Body('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
    @Body() input: RecordResultInput & { organizationId?: string },
  ) {
    return this.experimentsService.recordResult(
      experimentId,
      organizationId,
      {
        variantId: input.variantId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        metricValue: input.metricValue,
        sampleSize: input.sampleSize,
      },
    );
  }

  /** Get experiment statistics (uplift calculations) */
  @Get(':experimentId/stats')
  async getExperimentStats(
    @Query('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.getExperimentStats(
      experimentId,
      organizationId,
    );
  }

  @Get(':experimentId/assignment')
  async assignVariant(
    @Query('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
    @Query('identityKey') identityKey: string,
  ) {
    return this.experimentsService.assignVariant(experimentId, organizationId, identityKey);
  }

  @Get(':experimentId/attribution')
  async attribution(
    @Query('organizationId') organizationId: string,
    @Param('experimentId') experimentId: string,
  ) {
    return this.experimentsService.getAttributionSummary(experimentId, organizationId);
  }
}

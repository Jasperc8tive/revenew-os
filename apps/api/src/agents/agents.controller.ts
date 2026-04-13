import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AgentType } from '@prisma/client';
import { JwtGuard } from '../common/guards/jwt.guard';
import { AgentsService } from './agents.service';
import { ListAgentRunsDto } from './dto/list-agent-runs.dto';
import { RunAgentDto } from './dto/run-agent.dto';

@UseGuards(JwtGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('run')
  async run(
    @Body() body: Partial<RunAgentDto>,
    @Query('organization_id') organizationIdFromQuery?: string,
    @Query('agent_type') agentTypeFromQuery?: string,
    @Query('max_retries') maxRetriesFromQuery?: string,
  ) {
    const organizationId = body.organizationId ?? organizationIdFromQuery;
    const agentTypeRaw = body.agentType ?? this.parseAgentType(agentTypeFromQuery);

    if (!organizationId || !agentTypeRaw) {
      throw new Error('organizationId and agentType are required');
    }

    const maxRetries =
      body.maxRetries ??
      (maxRetriesFromQuery ? Math.max(1, Number(maxRetriesFromQuery)) : undefined);

    return this.agentsService.run({
      organizationId,
      agentType: agentTypeRaw,
      maxRetries,
    });
  }

  @Get('runs')
  async listRuns(@Query() query: ListAgentRunsDto) {
    return this.agentsService.listRuns({
      organizationId: query.organizationId,
      status: query.status,
      limit: query.limit,
    });
  }

  private parseAgentType(value?: string): AgentType | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    const mapping: Record<string, AgentType> = {
      MARKETING: AgentType.MARKETING,
      ACQUISITION: AgentType.ACQUISITION,
      PIPELINE: AgentType.PIPELINE,
      FORECASTING: AgentType.FORECASTING,
      PRICING: AgentType.PRICING,
      RETENTION: AgentType.RETENTION,
      GROWTH: AgentType.GROWTH,
    };

    return mapping[normalized];
  }
}

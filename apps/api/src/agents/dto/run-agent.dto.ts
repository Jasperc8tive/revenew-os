import { AgentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RunAgentDto {
  @IsString()
  organizationId!: string;

  @IsEnum(AgentType)
  agentType!: AgentType;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  maxRetries?: number;
}

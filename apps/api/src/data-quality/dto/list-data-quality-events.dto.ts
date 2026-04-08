import { DataQualityEventType, DataQualitySeverity } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDataQualityEventsDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsEnum(DataQualityEventType)
  eventType?: DataQualityEventType;

  @IsOptional()
  @IsEnum(DataQualitySeverity)
  severity?: DataQualitySeverity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

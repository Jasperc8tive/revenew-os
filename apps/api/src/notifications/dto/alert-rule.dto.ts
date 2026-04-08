import { AlertMetric, AlertOperator } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAlertRuleDto {
  @IsString()
  organizationId!: string;

  @IsString()
  name!: string;

  @IsEnum(AlertMetric)
  metric!: AlertMetric;

  @IsEnum(AlertOperator)
  operator!: AlertOperator;

  @Type(() => Number)
  @IsNumber()
  threshold!: number;

  @IsArray()
  @IsString({ each: true })
  channels!: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListAlertRulesQueryDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class ListAlertEventsQueryDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class DeleteAlertRuleQueryDto {
  @IsString()
  organizationId!: string;
}

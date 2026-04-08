import { AlertMetric } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class BenchmarkQueryDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @IsEnum(AlertMetric)
  metric?: AlertMetric;

  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  endDate?: Date;
}

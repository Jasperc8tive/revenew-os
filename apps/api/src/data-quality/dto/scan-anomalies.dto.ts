import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ScanAnomaliesDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(120)
  lookbackDays?: number;
}

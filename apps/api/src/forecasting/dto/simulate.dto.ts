import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class SimulateDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  marketingSpendDeltaPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricingDeltaPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  churnDeltaPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  conversionRateDeltaPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  averageOrderValueDeltaPct?: number;
}

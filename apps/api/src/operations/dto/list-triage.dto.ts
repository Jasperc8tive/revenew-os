import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ListTriageDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  slaMinutes?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unresolvedOnly?: boolean;
}

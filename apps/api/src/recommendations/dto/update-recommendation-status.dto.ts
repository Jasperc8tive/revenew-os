import { RecommendationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateRecommendationStatusDto {
  @IsString()
  organizationId!: string;

  @IsEnum(RecommendationStatus)
  status!: RecommendationStatus;

  @IsOptional()
  @IsString()
  impactSummary?: string;
}

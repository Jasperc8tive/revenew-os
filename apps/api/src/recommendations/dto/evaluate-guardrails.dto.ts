import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class EvaluateRecommendationGuardrailsDto {
  @IsNumber()
  @Min(0)
  dataPoints!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceScore!: number;

  @IsBoolean()
  integrationsHealthy!: boolean;
}

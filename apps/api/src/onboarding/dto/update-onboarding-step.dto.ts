import { IsBoolean } from 'class-validator';

export class UpdateOnboardingStepDto {
  @IsBoolean()
  completed!: boolean;
}

import { IsString } from 'class-validator';

export class OnboardingQueryDto {
  @IsString()
  organizationId!: string;
}

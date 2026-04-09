import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
const ROLLOUT_STAGES = ['planned', 'canary', 'expanded', 'full', 'rolled_back'] as const;

export class GovernanceOrgQueryDto {
  @IsString()
  organizationId!: string;
}

export class UpsertWeeklyReviewDto {
  @IsString()
  organizationId!: string;

  @IsString()
  phase!: string;

  @IsString()
  workstream!: string;

  @IsString()
  evidence!: string;

  @IsOptional()
  @IsString()
  blocker?: string;
}

export class CreateRiskDto {
  @IsString()
  organizationId!: string;

  @IsString()
  title!: string;

  @IsIn(RISK_LEVELS)
  level!: (typeof RISK_LEVELS)[number];

  @IsString()
  owner!: string;

  @IsString()
  mitigation!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateQualityGateDto {
  @IsString()
  organizationId!: string;

  @IsString()
  feature!: string;

  @IsBoolean()
  testsPassed!: boolean;

  @IsBoolean()
  observabilityReady!: boolean;

  @IsBoolean()
  rollbackReady!: boolean;
}

export class CreateReleaseRolloutDto {
  @IsString()
  organizationId!: string;

  @IsString()
  feature!: string;

  @IsIn(ROLLOUT_STAGES)
  stage!: (typeof ROLLOUT_STAGES)[number];

  @IsBoolean()
  canaryValidated!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

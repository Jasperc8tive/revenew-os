import { BillingInterval, PlanTier } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpgradeDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsEnum(PlanTier)
  targetTier!: PlanTier;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @IsOptional()
  @IsString()
  paymentProvider?: 'paystack' | 'flutterwave' | 'stripe';
}

import { BillingInterval, PlanTier } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsEnum(PlanTier)
  tier!: PlanTier;

  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @IsOptional()
  @IsString()
  paymentProvider?: 'paystack' | 'flutterwave' | 'stripe';

  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}

import { IsObject, IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @IsString()
  provider!: 'paystack' | 'flutterwave' | 'stripe';

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  signature?: string;
}

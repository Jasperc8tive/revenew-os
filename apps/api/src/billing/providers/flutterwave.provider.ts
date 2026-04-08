import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import {
  CreateSubscriptionInput,
  PaymentProviderAdapter,
  ProviderSubscriptionResponse,
  ProviderVerificationResponse,
  ProviderWebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class FlutterwaveProvider implements PaymentProviderAdapter {
  readonly name = 'flutterwave' as const;

  constructor(private readonly configService: ConfigService) {}

  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResponse> {
    return {
      provider: this.name,
      reference: input.reference,
      checkoutUrl: `https://flutterwave.com/pay/${input.reference}`,
      status: 'pending',
      raw: { amount: input.amount, currency: input.currency, organizationId: input.organizationId },
    };
  }

  async verifyPayment(reference: string): Promise<ProviderVerificationResponse> {
    return {
      provider: this.name,
      reference,
      status: reference.includes('fail') ? 'failed' : 'success',
      paidAt: new Date(),
      raw: { source: 'sandbox' },
    };
  }

  processWebhook(payload: Record<string, unknown>): ProviderWebhookEvent | null {
    const event = String(payload.event ?? payload.status ?? '');
    const data = (payload.data as Record<string, unknown>) ?? {};
    const reference = String(data.tx_ref ?? data.flw_ref ?? payload.reference ?? '');

    if (!reference) return null;

    if (event === 'charge.completed' || event === 'successful') {
      return { provider: this.name, eventType: 'payment.success', reference, metadata: data, raw: payload };
    }
    if (event === 'failed') {
      return { provider: this.name, eventType: 'payment.failed', reference, metadata: data, raw: payload };
    }

    return null;
  }

  verifySignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('FLUTTERWAVE_WEBHOOK_SECRET', 'flutterwave-dev-secret');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return expected === signature;
  }
}

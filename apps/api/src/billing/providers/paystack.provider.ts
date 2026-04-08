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
export class PaystackProvider implements PaymentProviderAdapter {
  readonly name = 'paystack' as const;

  constructor(private readonly configService: ConfigService) {}

  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResponse> {
    return {
      provider: this.name,
      reference: input.reference,
      checkoutUrl: `https://sandbox.paystack.com/pay/${input.reference}`,
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
    const event = String(payload.event ?? '');
    const data = (payload.data as Record<string, unknown>) ?? {};
    const reference = String(data.reference ?? payload.reference ?? '');

    if (!reference) return null;

    if (event === 'charge.success') {
      return { provider: this.name, eventType: 'payment.success', reference, metadata: data, raw: payload };
    }
    if (event === 'charge.failed') {
      return { provider: this.name, eventType: 'payment.failed', reference, metadata: data, raw: payload };
    }
    if (event === 'subscription.create' || event === 'subscription.not_renew') {
      return {
        provider: this.name,
        eventType: event === 'subscription.create' ? 'subscription.renewed' : 'subscription.canceled',
        reference,
        metadata: data,
        raw: payload,
      };
    }

    return null;
  }

  verifySignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('PAYSTACK_WEBHOOK_SECRET', 'paystack-dev-secret');
    const expected = createHmac('sha512', secret).update(payload).digest('hex');
    return expected === signature;
  }
}

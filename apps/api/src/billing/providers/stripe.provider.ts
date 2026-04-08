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
export class StripeProvider implements PaymentProviderAdapter {
  readonly name = 'stripe' as const;

  constructor(private readonly configService: ConfigService) {}

  async createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResponse> {
    return {
      provider: this.name,
      reference: input.reference,
      checkoutUrl: `https://checkout.stripe.com/pay/${input.reference}`,
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
    const event = String(payload.type ?? '');
    const data = ((payload.data as Record<string, unknown>)?.object as Record<string, unknown>) ?? {};
    const metadata = (data.metadata as Record<string, unknown> | undefined) ?? undefined;
    const reference = String(metadata?.reference ?? data.id ?? payload.reference ?? '');

    if (!reference) return null;

    if (event === 'invoice.payment_succeeded' || event === 'payment_intent.succeeded') {
      return { provider: this.name, eventType: 'payment.success', reference, metadata: data, raw: payload };
    }
    if (event === 'invoice.payment_failed' || event === 'payment_intent.payment_failed') {
      return { provider: this.name, eventType: 'payment.failed', reference, metadata: data, raw: payload };
    }
    if (event === 'customer.subscription.updated') {
      return { provider: this.name, eventType: 'subscription.renewed', reference, metadata: data, raw: payload };
    }
    if (event === 'customer.subscription.deleted') {
      return { provider: this.name, eventType: 'subscription.canceled', reference, metadata: data, raw: payload };
    }

    return null;
  }

  verifySignature(payload: string, signature: string): boolean {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', 'stripe-dev-secret');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    return expected === signature;
  }
}

export type PaymentProviderName = 'paystack' | 'flutterwave' | 'stripe';

export interface CreateSubscriptionInput {
  organizationId: string;
  amount: number;
  currency: 'NGN' | 'USD';
  email?: string;
  reference: string;
}

export interface ProviderSubscriptionResponse {
  provider: PaymentProviderName;
  reference: string;
  checkoutUrl: string;
  status: 'pending' | 'success' | 'failed';
  raw?: Record<string, unknown>;
}

export interface ProviderVerificationResponse {
  provider: PaymentProviderName;
  reference: string;
  status: 'success' | 'failed' | 'pending';
  paidAt?: Date;
  raw?: Record<string, unknown>;
}

export interface ProviderWebhookEvent {
  provider: PaymentProviderName;
  eventType: 'payment.success' | 'payment.failed' | 'subscription.renewed' | 'subscription.canceled';
  reference: string;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;
  createSubscription(input: CreateSubscriptionInput): Promise<ProviderSubscriptionResponse>;
  verifyPayment(reference: string): Promise<ProviderVerificationResponse>;
  processWebhook(payload: Record<string, unknown>): ProviderWebhookEvent | null;
  verifySignature(payload: string, signature: string): boolean;
}

export const BILLING_PLAN_PRICES = {
  Starter: {
    monthly: 75000,
    yearly: 900000,
  },
  Growth: {
    monthly: 350000,
    yearly: 4200000,
  },
  Enterprise: {
    monthly: 1500000,
    yearly: 18000000,
  },
} as const;

export const STARTER_INTEGRATION_LIMIT = 2;

export const WEBHOOK_SIGNATURE_HEADERS = {
  paystack: 'x-paystack-signature',
  flutterwave: 'verif-hash',
  stripe: 'stripe-signature',
} as const;

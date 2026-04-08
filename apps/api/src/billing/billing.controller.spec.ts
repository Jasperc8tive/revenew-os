import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { BillingController } from './billing.controller';
import { BillingWebhooksController } from './billing.webhooks.controller';
import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { BillingInterval, PlanTier } from '@prisma/client';

describe('BillingController (e2e)', () => {
  let app: INestApplication;

  const billingServiceMock = {
    getPlans: jest.fn(),
    resolveOrganizationId: jest.fn(),
    normalizeBillingInterval: jest.fn(),
    getInvoices: jest.fn(),
    formatNaira: jest.fn(),
  };

  const subscriptionServiceMock = {
    getCurrentSubscription: jest.fn(),
    createSubscription: jest.fn(),
    changePlan: jest.fn(),
    cancelSubscription: jest.fn(),
    renewSubscription: jest.fn(),
  };

  const paymentServiceMock = {
    verifyPayment: jest.fn(),
    processWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    billingServiceMock.resolveOrganizationId.mockImplementation(
      async (...args: unknown[]) => (args[1] as string | undefined) ?? 'org-session',
    );
    billingServiceMock.normalizeBillingInterval.mockImplementation(
      (...args: unknown[]) => (args[0] as BillingInterval | undefined) ?? BillingInterval.MONTHLY,
    );
    billingServiceMock.formatNaira.mockImplementation((...args: unknown[]) => `NGN ${String(args[0])}`);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BillingController, BillingWebhooksController],
      providers: [
        {
          provide: BillingService,
          useValue: billingServiceMock,
        },
        {
          provide: SubscriptionService,
          useValue: subscriptionServiceMock,
        },
        {
          provide: PaymentService,
          useValue: paymentServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /billing/plans should return available plans', async () => {
    billingServiceMock.getPlans.mockImplementation(async () => [
      { id: 'plan-1', tier: PlanTier.Starter, display: { monthly: 'NGN 15000/month', yearly: 'NGN 150000/year' } },
    ]);

    const response = await request(app.getHttpServer()).get('/billing/plans').expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].tier).toBe(PlanTier.Starter);
  });

  it('POST /billing/subscribe should create a subscription', async () => {
    subscriptionServiceMock.createSubscription.mockImplementation(async () => ({
      subscription: { id: 'sub-1' },
      invoice: { id: 'inv-1' },
      payment: { id: 'pay-1' },
    }));

    const response = await request(app.getHttpServer())
      .post('/billing/subscribe')
      .send({ organizationId: 'org-1', tier: PlanTier.Growth, billingInterval: BillingInterval.MONTHLY })
      .expect(201);

    expect(response.body).toMatchObject({
      subscription: { id: 'sub-1' },
      invoice: { id: 'inv-1' },
      payment: { id: 'pay-1' },
    });
  });

  it('POST /billing/upgrade should change plan', async () => {
    subscriptionServiceMock.changePlan.mockImplementation(async () => ({
      subscription: { id: 'sub-1', plan: { tier: PlanTier.Enterprise } },
      invoice: { id: 'inv-upgrade' },
      payment: { id: 'pay-upgrade' },
    }));

    const response = await request(app.getHttpServer())
      .post('/billing/upgrade')
      .send({ organizationId: 'org-1', targetTier: PlanTier.Enterprise, billingInterval: BillingInterval.YEARLY })
      .expect(201);

    expect(response.body.subscription.plan.tier).toBe(PlanTier.Enterprise);
  });

  it('POST /billing/cancel should cancel subscription', async () => {
    subscriptionServiceMock.cancelSubscription.mockImplementation(async () => ({
      subscription: { id: 'sub-1', status: 'CANCELED' },
      reason: 'No longer needed',
    }));

    const response = await request(app.getHttpServer())
      .post('/billing/cancel')
      .send({ organizationId: 'org-1', reason: 'No longer needed' })
      .expect(201);

    expect(response.body).toMatchObject({
      subscription: { id: 'sub-1', status: 'CANCELED' },
      reason: 'No longer needed',
    });
  });

  it('GET /billing/invoices should return invoice history', async () => {
    billingServiceMock.getInvoices.mockImplementation(async () => [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-202604-0001',
        amount: 45000,
        status: 'PAID',
        dueDate: '2026-04-10T00:00:00.000Z',
        issuedAt: '2026-04-01T00:00:00.000Z',
        paidAt: '2026-04-02T00:00:00.000Z',
        organization: { name: 'Acme' },
        subscription: { billingInterval: 'MONTHLY', plan: { name: 'Growth' } },
      },
    ]);

    const response = await request(app.getHttpServer()).get('/billing/invoices?organizationId=org-1').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      invoiceNumber: 'INV-202604-0001',
      plan: 'Growth',
      amountDisplay: 'NGN 45000',
    });
  });

  it('POST /webhooks/billing/:provider should pass signature to payment service', async () => {
    paymentServiceMock.processWebhook.mockImplementation(async () => ({ processed: true, eventType: 'payment.success' }));

    await request(app.getHttpServer())
      .post('/webhooks/billing/paystack')
      .set('x-paystack-signature', 'valid-signature')
      .send({ event: 'charge.success', data: { reference: 'pay_001' } })
      .expect(200);

    expect(paymentServiceMock.processWebhook).toHaveBeenCalledWith(
      'paystack',
      { event: 'charge.success', data: { reference: 'pay_001' } },
      'valid-signature',
    );
  });

  it('POST /billing/webhooks/:provider should support billing scoped webhook endpoint', async () => {
    paymentServiceMock.processWebhook.mockImplementation(async () => ({ processed: true, eventType: 'payment.success' }));

    await request(app.getHttpServer())
      .post('/billing/webhooks/flutterwave')
      .set('verif-hash', 'fw-signature')
      .send({ event: 'charge.completed', data: { tx_ref: 'pay_002' } })
      .expect(200);

    expect(paymentServiceMock.processWebhook).toHaveBeenCalledWith(
      'flutterwave',
      { event: 'charge.completed', data: { tx_ref: 'pay_002' } },
      'fw-signature',
    );
  });
});

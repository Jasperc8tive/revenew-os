import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PaymentStatus } from '@prisma/client';
import { PaymentService } from './payment.service';

describe('PaymentService idempotency', () => {
  const invoiceServiceMock = {
    markInvoicePaid: jest.fn(),
  };

  const paystackProviderMock = {
    name: 'paystack' as const,
    createSubscription: jest.fn(),
    verifyPayment: jest.fn(),
    processWebhook: jest.fn(),
    verifySignature: jest.fn(),
  };

  const flutterwaveProviderMock = {
    name: 'flutterwave' as const,
    createSubscription: jest.fn(),
    verifyPayment: jest.fn(),
    processWebhook: jest.fn(),
    verifySignature: jest.fn(),
  };

  const stripeProviderMock = {
    name: 'stripe' as const,
    createSubscription: jest.fn(),
    verifyPayment: jest.fn(),
    processWebhook: jest.fn(),
    verifySignature: jest.fn(),
  };

  const prismaMock = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    subscription: {
      updateMany: jest.fn(),
    },
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PaymentService(
      prismaMock as never,
      invoiceServiceMock as never,
      paystackProviderMock as never,
      flutterwaveProviderMock as never,
      stripeProviderMock as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes a valid webhook once and returns idempotent response on replay', async () => {
    paystackProviderMock.verifySignature.mockReturnValue(true);
    paystackProviderMock.processWebhook.mockReturnValue({
      provider: 'paystack',
      eventType: 'payment.success',
      reference: 'pay_ref_100',
    });
    prismaMock.webhookEvent.findUnique
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => ({
        provider: 'paystack',
        eventId: 'evt-100',
        status: 'PROCESSED',
      }));
    prismaMock.webhookEvent.create.mockImplementation(async () => ({ id: 'wh-1' }));
    prismaMock.webhookEvent.update.mockImplementation(async () => ({ id: 'wh-1', status: 'PROCESSED' }));

    const verifySpy = jest.spyOn(service, 'verifyPayment').mockResolvedValue({
      id: 'payment-1',
      status: PaymentStatus.SUCCESS,
      invoiceId: 'inv-1',
    } as never);

    const payload = { id: 'evt-100', event: 'charge.success', data: { reference: 'pay_ref_100' } };

    const first = await service.processWebhook('paystack', payload, 'valid-signature');
    const replay = await service.processWebhook('paystack', payload, 'valid-signature');

    expect(first).toMatchObject({ processed: true, idempotent: false, eventId: 'evt-100' });
    expect(replay).toMatchObject({ processed: true, idempotent: true, eventId: 'evt-100' });
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('rejects webhook with invalid signature', async () => {
    paystackProviderMock.verifySignature.mockReturnValue(false);

    await expect(
      service.processWebhook('paystack', { event: 'charge.success', data: { reference: 'pay_ref_100' } }, 'bad-signature'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

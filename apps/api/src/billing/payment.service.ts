import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { PaystackProvider } from './providers/paystack.provider';
import { PaymentProviderAdapter, PaymentProviderName } from './providers/payment-provider.interface';
import { StripeProvider } from './providers/stripe.provider';
import { InvoiceService } from './invoice.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly paystackProvider: PaystackProvider,
    private readonly flutterwaveProvider: FlutterwaveProvider,
    private readonly stripeProvider: StripeProvider,
  ) {}

  async createPayment(params: {
    organizationId: string;
    amount: number;
    subscriptionId?: string;
    invoiceId?: string;
    provider?: PaymentProviderName;
    billingEmail?: string;
  }) {
    const provider = params.provider ?? 'paystack';
    const reference = `pay_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: params.organizationId,
        subscriptionId: params.subscriptionId,
        invoiceId: params.invoiceId,
        amount: new Prisma.Decimal(params.amount),
        reference,
        status: PaymentStatus.PENDING,
      },
    });

    const providerResponse = await this.getProvider(provider).createSubscription({
      organizationId: params.organizationId,
      amount: params.amount,
      currency: 'NGN',
      email: params.billingEmail,
      reference,
    });

    return {
      payment,
      provider: providerResponse,
    };
  }

  async verifyPayment(provider: PaymentProviderName, reference: string) {
    const verification = await this.getProvider(provider).verifyPayment(reference);
    const payment = await this.prisma.payment.findUnique({ where: { reference: verification.reference } });

    if (!payment) {
      throw new BadRequestException('Payment reference not found');
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }

    if (verification.status === 'success') {
      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: verification.paidAt ?? new Date(),
        },
      });

      if (updatedPayment.invoiceId) {
        await this.invoiceService.markInvoicePaid(updatedPayment.invoiceId);
      }

      if (updatedPayment.subscriptionId) {
        await this.prisma.subscription.updateMany({
          where: { id: updatedPayment.subscriptionId },
          data: {
            status: 'ACTIVE',
          },
        });
      }

      return updatedPayment;
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: verification.status === 'failed' ? PaymentStatus.FAILED : PaymentStatus.PENDING,
      },
    });

    if (updatedPayment.subscriptionId && verification.status === 'failed') {
      await this.prisma.subscription.updateMany({
        where: { id: updatedPayment.subscriptionId },
        data: {
          status: 'PAST_DUE',
        },
      });
    }

    return updatedPayment;
  }

  async processWebhook(provider: PaymentProviderName, payload: Record<string, unknown>, signature: string) {
    const providerAdapter = this.getProvider(provider);
    const serializedPayload = JSON.stringify(payload);

    if (!providerAdapter.verifySignature(serializedPayload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = providerAdapter.processWebhook(payload);

    if (!event) {
      return { processed: false, reason: 'Unsupported event' };
    }

    const eventId = this.resolveEventId(provider, payload, event.reference, event.eventType, serializedPayload);

    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existingEvent?.status === 'PROCESSED') {
      return {
        processed: true,
        idempotent: true,
        eventId,
        eventType: event.eventType,
        reference: event.reference,
      };
    }

    if (!existingEvent) {
      await this.prisma.webhookEvent.create({
        data: {
          provider,
          eventId,
          eventType: event.eventType,
          reference: event.reference,
          status: 'PROCESSING',
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.webhookEvent.update({
        where: {
          provider_eventId: {
            provider,
            eventId,
          },
        },
        data: {
          status: 'PROCESSING',
          payload: payload as Prisma.InputJsonValue,
        },
      });
    }

    try {
      if (event.eventType === 'payment.success' || event.eventType === 'payment.failed') {
        await this.verifyPayment(provider, event.reference);
      }

      if (event.eventType === 'subscription.canceled') {
        await this.prisma.subscription.updateMany({
          where: {
            payments: {
              some: {
                reference: event.reference,
              },
            },
          },
          data: {
            status: 'CANCELED',
            endDate: new Date(),
          },
        });
      }

      await this.prisma.webhookEvent.update({
        where: {
          provider_eventId: {
            provider,
            eventId,
          },
        },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: {
          provider_eventId: {
            provider,
            eventId,
          },
        },
        data: {
          status: 'FAILED',
        },
      });

      throw error;
    }

    return {
      processed: true,
      idempotent: false,
      eventId,
      eventType: event.eventType,
      reference: event.reference,
    };
  }

  private resolveEventId(
    provider: PaymentProviderName,
    payload: Record<string, unknown>,
    reference: string,
    eventType: string,
    serializedPayload: string,
  ) {
    const explicitEventId = payload.id ?? payload.event_id ?? payload.webhook_id;
    if (typeof explicitEventId === 'string' && explicitEventId.trim()) {
      return explicitEventId.trim();
    }

    const payloadHash = createHash('sha256').update(serializedPayload).digest('hex').slice(0, 20);
    return `${provider}:${eventType}:${reference}:${payloadHash}`;
  }

  private getProvider(provider: PaymentProviderName): PaymentProviderAdapter {
    if (provider === 'paystack') return this.paystackProvider;
    if (provider === 'flutterwave') return this.flutterwaveProvider;
    return this.stripeProvider;
  }
}

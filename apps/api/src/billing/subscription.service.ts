import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BillingInterval,
  PlanTier,
  Prisma,
  RevenueEventType,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PaymentProviderName } from './providers/payment-provider.interface';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly paymentService: PaymentService,
  ) {}

  async getCurrentSubscription(organizationId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIAL],
        },
      },
      include: {
        plan: true,
        invoices: {
          orderBy: { issuedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubscription(params: {
    organizationId: string;
    tier: PlanTier;
    billingInterval: BillingInterval;
    paymentProvider?: PaymentProviderName;
    billingEmail?: string;
  }) {
    const existing = await this.getCurrentSubscription(params.organizationId);

    if (existing) {
      throw new BadRequestException('Organization already has an active subscription');
    }

    const plan = await this.prisma.plan.findUnique({ where: { tier: params.tier } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const startDate = new Date();
    const endDate = this.computeEndDate(startDate, params.billingInterval);
    const amount = this.getPlanAmount(plan.priceMonthly, plan.priceYearly, params.billingInterval);

    const subscription = await this.prisma.subscription.create({
      data: {
        organizationId: params.organizationId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingInterval: params.billingInterval,
        startDate,
        endDate,
      },
      include: { plan: true },
    });

    const invoice = await this.invoiceService.createInvoiceForSubscription({
      organizationId: params.organizationId,
      subscription,
      amount,
      dueDate: startDate,
    });

    const payment = await this.paymentService.createPayment({
      organizationId: params.organizationId,
      amount,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      provider: params.paymentProvider,
      billingEmail: params.billingEmail,
    });

    await this.createRevenueEvent(params.organizationId, subscription.id, invoice.id, amount, RevenueEventType.SUBSCRIPTION_STARTED);

    return { subscription, invoice, payment };
  }

  async renewSubscription(organizationId: string) {
    const current = await this.getCurrentSubscription(organizationId);
    if (!current) {
      throw new NotFoundException('No active subscription found');
    }

    const amount = this.getPlanAmount(
      current.plan.priceMonthly,
      current.plan.priceYearly,
      current.billingInterval,
    );

    const nextStart = current.endDate ?? new Date();
    const nextEnd = this.computeEndDate(nextStart, current.billingInterval);

    const updated = await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        endDate: nextEnd,
      },
      include: { plan: true },
    });

    const invoice = await this.invoiceService.createInvoiceForSubscription({
      organizationId,
      subscription: updated,
      amount,
      dueDate: nextStart,
    });

    await this.createRevenueEvent(organizationId, updated.id, invoice.id, amount, RevenueEventType.SUBSCRIPTION_RENEWED);

    return { subscription: updated, invoice };
  }

  async changePlan(params: {
    organizationId: string;
    targetTier: PlanTier;
    billingInterval?: BillingInterval;
    paymentProvider?: PaymentProviderName;
  }) {
    const current = await this.getCurrentSubscription(params.organizationId);
    if (!current) {
      throw new NotFoundException('No active subscription found');
    }

    const targetPlan = await this.prisma.plan.findUnique({ where: { tier: params.targetTier } });
    if (!targetPlan) {
      throw new NotFoundException('Target plan not found');
    }

    const nextInterval = params.billingInterval ?? current.billingInterval;
    const currentAmount = this.getPlanAmount(current.plan.priceMonthly, current.plan.priceYearly, current.billingInterval);
    const targetAmount = this.getPlanAmount(targetPlan.priceMonthly, targetPlan.priceYearly, nextInterval);

    const updated = await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        planId: targetPlan.id,
        billingInterval: nextInterval,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
    });

    const delta = Math.max(0, targetAmount - currentAmount);
    let invoice = null;
    let payment = null;

    if (delta > 0) {
      invoice = await this.invoiceService.createInvoiceForSubscription({
        organizationId: params.organizationId,
        subscription: updated,
        amount: delta,
        dueDate: new Date(),
      });

      payment = await this.paymentService.createPayment({
        organizationId: params.organizationId,
        amount: delta,
        subscriptionId: updated.id,
        invoiceId: invoice.id,
        provider: params.paymentProvider,
      });
    }

    await this.createRevenueEvent(
      params.organizationId,
      updated.id,
      invoice?.id,
      Math.abs(targetAmount - currentAmount),
      targetAmount >= currentAmount ? RevenueEventType.UPGRADE : RevenueEventType.DOWNGRADE,
    );

    return { subscription: updated, invoice, payment };
  }

  async cancelSubscription(organizationId: string, reason?: string) {
    const current = await this.getCurrentSubscription(organizationId);
    if (!current) {
      throw new NotFoundException('No active subscription found');
    }

    const canceled = await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        endDate: new Date(),
      },
      include: { plan: true },
    });

    await this.prisma.revenueEvent.create({
      data: {
        organizationId,
        subscriptionId: canceled.id,
        amount: new Prisma.Decimal(0),
        eventType: RevenueEventType.REFUND,
        currency: 'NGN',
      },
    });

    return { subscription: canceled, reason: reason ?? null };
  }

  private async createRevenueEvent(
    organizationId: string,
    subscriptionId: string,
    invoiceId: string | undefined,
    amount: number,
    eventType: RevenueEventType,
  ) {
    await this.prisma.revenueEvent.create({
      data: {
        organizationId,
        subscriptionId,
        invoiceId,
        amount: new Prisma.Decimal(amount),
        eventType,
        currency: 'NGN',
      },
    });
  }

  private computeEndDate(startDate: Date, interval: BillingInterval) {
    const endDate = new Date(startDate);
    if (interval === BillingInterval.YEARLY) {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }

  private getPlanAmount(monthly: Prisma.Decimal, yearly: Prisma.Decimal | null, interval: BillingInterval) {
    if (interval === BillingInterval.YEARLY) {
      return Number(yearly ?? monthly.mul(12));
    }
    return Number(monthly);
  }
}

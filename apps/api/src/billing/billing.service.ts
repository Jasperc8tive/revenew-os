import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { BillingInterval, CurrencyCode, PlanTier } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BILLING_PLAN_PRICES } from './billing.constants';
import { InvoiceService } from './invoice.service';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async onModuleInit() {
    await this.seedPlans();
  }

  async seedPlans() {
    const plans: Array<{ tier: PlanTier; name: string; monthly: number; yearly: number }> = [
      { tier: PlanTier.Starter, name: 'Starter', monthly: BILLING_PLAN_PRICES.Starter.monthly, yearly: BILLING_PLAN_PRICES.Starter.yearly },
      { tier: PlanTier.Growth, name: 'Growth', monthly: BILLING_PLAN_PRICES.Growth.monthly, yearly: BILLING_PLAN_PRICES.Growth.yearly },
      { tier: PlanTier.Enterprise, name: 'Enterprise', monthly: BILLING_PLAN_PRICES.Enterprise.monthly, yearly: BILLING_PLAN_PRICES.Enterprise.yearly },
    ];

    await Promise.all(
      plans.map((plan) =>
        this.prisma.plan.upsert({
          where: { tier: plan.tier },
          update: {
            name: plan.name,
            priceMonthly: plan.monthly,
            priceYearly: plan.yearly,
            currency: CurrencyCode.NGN,
          },
          create: {
            name: plan.name,
            tier: plan.tier,
            priceMonthly: plan.monthly,
            priceYearly: plan.yearly,
            currency: CurrencyCode.NGN,
          },
        }),
      ),
    );
  }

  async resolveOrganizationId(userId?: string, fallbackOrganizationId?: string) {
    if (fallbackOrganizationId) {
      return fallbackOrganizationId;
    }

    if (!userId) {
      throw new UnauthorizedException('Unable to resolve organization context');
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new UnauthorizedException('No organization membership found for user');
    }

    return membership.organizationId;
  }

  async getPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((plan) => ({
      ...plan,
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: plan.priceYearly ? Number(plan.priceYearly) : null,
      display: {
        monthly: this.formatNaira(Number(plan.priceMonthly), '/month'),
        yearly: this.formatNaira(plan.priceYearly ? Number(plan.priceYearly) : Number(plan.priceMonthly) * 12, '/year'),
      },
      features: this.getPlanFeatures(plan.tier),
    }));
  }

  getCurrentSubscription(organizationId: string) {
    return this.subscriptionService.getCurrentSubscription(organizationId);
  }

  getInvoices(organizationId: string) {
    return this.invoiceService.listInvoices(organizationId);
  }

  getPlanFeatures(tier: PlanTier) {
    if (tier === PlanTier.Starter) {
      return ['basic analytics', 'limited integrations', 'standard AI insights'];
    }
    if (tier === PlanTier.Growth) {
      return ['advanced analytics', 'unlimited integrations', 'full AI insights'];
    }
    return ['custom integrations', 'priority AI insights', 'advanced forecasting'];
  }

  formatNaira(amount: number, suffix = '') {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);

    return `${formatted}${suffix}`;
  }

  normalizeBillingInterval(interval?: BillingInterval) {
    return interval ?? BillingInterval.MONTHLY;
  }
}

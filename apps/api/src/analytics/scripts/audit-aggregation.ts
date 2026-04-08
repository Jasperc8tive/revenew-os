import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Industry } from '@prisma/client';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { AnalyticsModule } from '../analytics.module';
import { AnalyticsAggregationService } from '../analytics.aggregation.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '..', '..', '.env'),
    }),
    PrismaModule,
    AnalyticsModule,
  ],
})
class AnalyticsAuditModule {}

interface PeriodAnchors {
  dailyDate: Date;
  weeklyStart: Date;
  monthlyStart: Date;
}

interface ExpectedMetrics {
  cac: number;
  ltv: number;
  revenue: number;
  churn: number;
}

function resolvePeriodAnchors(reference: Date): PeriodAnchors {
  const dailyDate = new Date(reference);
  dailyDate.setUTCHours(0, 0, 0, 0);

  const weeklyStart = new Date(reference);
  const weekday = weeklyStart.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - delta);
  weeklyStart.setUTCHours(0, 0, 0, 0);

  const monthlyStart = new Date(reference);
  monthlyStart.setUTCDate(1);
  monthlyStart.setUTCHours(0, 0, 0, 0);

  return { dailyDate, weeklyStart, monthlyStart };
}

function assertClose(actual: number, expected: number, label: string, tolerance = 0.01): void {
  const delta = Math.abs(actual - expected);
  if (delta > tolerance) {
    throw new Error(`${label} mismatch. expected=${expected}, actual=${actual}, delta=${delta}`);
  }
}

async function runSmokeAudit(
  prisma: PrismaService,
  aggregationService: AnalyticsAggregationService,
  organizationId: string,
): Promise<void> {
  await aggregationService.aggregateForPeriod('daily');
  await aggregationService.aggregateForPeriod('weekly');
  await aggregationService.aggregateForPeriod('monthly');

  const [daily, weekly, monthly] = await Promise.all([
    prisma.dailyMetrics.findFirst({ where: { organizationId } }),
    prisma.weeklyMetrics.findFirst({ where: { organizationId } }),
    prisma.monthlyMetrics.findFirst({ where: { organizationId } }),
  ]);

  if (!daily) {
    throw new Error('Daily metrics write verification failed');
  }

  if (!weekly) {
    throw new Error('Weekly metrics write verification failed');
  }

  if (!monthly) {
    throw new Error('Monthly metrics write verification failed');
  }

  console.log('Analytics aggregation smoke audit passed.');
  console.log(
    JSON.stringify(
      {
        organizationId,
        dailyMetricsId: daily.id,
        weeklyMetricsId: weekly.id,
        monthlyMetricsId: monthly.id,
      },
      null,
      2,
    ),
  );
}

async function seedRichAuditFixtures(
  prisma: PrismaService,
  organizationId: string,
  anchors: PeriodAnchors,
): Promise<ExpectedMetrics> {
  const channel = await prisma.marketingChannel.create({
    data: {
      organizationId,
      name: `Audit Channel ${randomUUID().slice(0, 6)}`,
      type: 'PAID_SEARCH',
    },
  });

  const campaign = await prisma.marketingCampaign.create({
    data: {
      organizationId,
      channelId: channel.id,
      name: `Audit Campaign ${randomUUID().slice(0, 6)}`,
      status: 'ACTIVE',
      startDate: anchors.monthlyStart,
    },
  });

  await prisma.marketingMetric.create({
    data: {
      organizationId,
      campaignId: campaign.id,
      impressions: 10000,
      clicks: 600,
      conversions: 3,
      cost: 150000,
      date: anchors.dailyDate,
    },
  });

  const legacyFirstSeen = new Date(anchors.monthlyStart);
  legacyFirstSeen.setUTCDate(legacyFirstSeen.getUTCDate() - 20);
  const todayAtNoon = new Date(anchors.dailyDate);
  todayAtNoon.setUTCHours(12, 0, 0, 0);

  const [legacyCustomer, customerA, customerB] = await Promise.all([
    prisma.customer.create({
      data: {
        organizationId,
        email: `legacy-${randomUUID().slice(0, 8)}@audit.local`,
        firstSeen: legacyFirstSeen,
        acquisitionChannel: 'Referral',
      },
    }),
    prisma.customer.create({
      data: {
        organizationId,
        email: `a-${randomUUID().slice(0, 8)}@audit.local`,
        firstSeen: todayAtNoon,
        acquisitionChannel: channel.name,
      },
    }),
    prisma.customer.create({
      data: {
        organizationId,
        email: `b-${randomUUID().slice(0, 8)}@audit.local`,
        firstSeen: todayAtNoon,
        acquisitionChannel: channel.name,
      },
    }),
    prisma.customer.create({
      data: {
        organizationId,
        email: `c-${randomUUID().slice(0, 8)}@audit.local`,
        firstSeen: todayAtNoon,
        acquisitionChannel: channel.name,
      },
    }),
  ]);

  const existingPlan = await prisma.plan.findUnique({
    where: {
      tier: 'Growth',
    },
  });

  const plan =
    existingPlan ??
    (await prisma.plan.create({
      data: {
        name: `Audit Plan ${randomUUID().slice(0, 6)}`,
        tier: 'Growth',
        priceMonthly: 10000,
        priceYearly: 100000,
        currency: 'NGN',
      },
    }));

  const subStartA = new Date(anchors.monthlyStart);
  subStartA.setUTCDate(subStartA.getUTCDate() - 90);
  const subEndA = new Date(anchors.monthlyStart);
  subEndA.setUTCDate(subEndA.getUTCDate() - 30);

  const subStartB = new Date(anchors.monthlyStart);
  subStartB.setUTCDate(subStartB.getUTCDate() - 150);
  const subEndB = new Date(anchors.monthlyStart);
  subEndB.setUTCDate(subEndB.getUTCDate() - 30);

  await prisma.subscription.create({
    data: {
      organizationId,
      planId: plan.id,
      status: 'ACTIVE',
      billingInterval: 'MONTHLY',
      startDate: subStartA,
      endDate: subEndA,
    },
  });

  await prisma.subscription.create({
    data: {
      organizationId,
      planId: plan.id,
      status: 'CANCELED',
      billingInterval: 'MONTHLY',
      startDate: subStartB,
      endDate: todayAtNoon,
    },
  });

  await prisma.revenueEvent.createMany({
    data: [
      {
        organizationId,
        customerId: customerA.id,
        amount: 60000,
        currency: 'NGN',
        eventType: 'SUBSCRIPTION_STARTED',
        timestamp: todayAtNoon,
      },
      {
        organizationId,
        customerId: customerB.id,
        amount: 30000,
        currency: 'NGN',
        eventType: 'SUBSCRIPTION_RENEWED',
        timestamp: todayAtNoon,
      },
    ],
  });

  await prisma.customerEvent.createMany({
    data: [
      {
        organizationId,
        customerId: customerA.id,
        eventType: 'SIGNUP',
        timestamp: todayAtNoon,
      },
      {
        organizationId,
        customerId: customerB.id,
        eventType: 'SIGNUP',
        timestamp: todayAtNoon,
      },
      {
        organizationId,
        customerId: customerA.id,
        eventType: 'PURCHASE',
        timestamp: todayAtNoon,
      },
      {
        organizationId,
        customerId: customerB.id,
        eventType: 'PURCHASE',
        timestamp: todayAtNoon,
      },
    ],
  });

  await prisma.customerEvent.create({
    data: {
      organizationId,
      customerId: legacyCustomer.id,
      eventType: 'PURCHASE',
      timestamp: legacyFirstSeen,
    },
  });

  const lifetimeMonths = [subEndA, todayAtNoon].map((end, index) => {
    const start = index === 0 ? subStartA : subStartB;
    return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  });

  const averageLifetimeMonths =
    lifetimeMonths.reduce((sum, months) => sum + months, 0) / lifetimeMonths.length;
  const averageRevenuePerCustomer = 90000 / 2;

  return {
    cac: 50000,
    ltv: averageRevenuePerCustomer * averageLifetimeMonths,
    revenue: 90000,
    churn: 1,
  };
}

async function runRichAudit(
  prisma: PrismaService,
  aggregationService: AnalyticsAggregationService,
  organizationId: string,
): Promise<void> {
  const anchors = resolvePeriodAnchors(new Date());
  const expected = await seedRichAuditFixtures(prisma, organizationId, anchors);

  await aggregationService.aggregateForPeriod('daily');
  await aggregationService.aggregateForPeriod('weekly');
  await aggregationService.aggregateForPeriod('monthly');

  const [daily, weekly, monthly] = await Promise.all([
    prisma.dailyMetrics.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date: anchors.dailyDate,
        },
      },
    }),
    prisma.weeklyMetrics.findUnique({
      where: {
        organizationId_weekStart: {
          organizationId,
          weekStart: anchors.weeklyStart,
        },
      },
    }),
    prisma.monthlyMetrics.findUnique({
      where: {
        organizationId_monthStart: {
          organizationId,
          monthStart: anchors.monthlyStart,
        },
      },
    }),
  ]);

  if (!daily || !weekly || !monthly) {
    throw new Error('Rich audit could not locate one or more rolled-up metric rows');
  }

  const checks = [
    { label: 'daily.cac', actual: Number(daily.cac), expected: expected.cac },
    { label: 'daily.ltv', actual: Number(daily.ltv), expected: expected.ltv },
    { label: 'daily.revenue', actual: Number(daily.revenue), expected: expected.revenue },
    { label: 'daily.churn', actual: Number(daily.churn), expected: expected.churn },
    { label: 'weekly.cac', actual: Number(weekly.cac), expected: expected.cac },
    { label: 'weekly.ltv', actual: Number(weekly.ltv), expected: expected.ltv },
    { label: 'weekly.revenue', actual: Number(weekly.revenue), expected: expected.revenue },
    { label: 'weekly.churn', actual: Number(weekly.churn), expected: expected.churn },
    { label: 'monthly.cac', actual: Number(monthly.cac), expected: expected.cac },
    { label: 'monthly.ltv', actual: Number(monthly.ltv), expected: expected.ltv },
    { label: 'monthly.revenue', actual: Number(monthly.revenue), expected: expected.revenue },
    { label: 'monthly.churn', actual: Number(monthly.churn), expected: expected.churn },
  ];

  for (const check of checks) {
    assertClose(check.actual, check.expected, check.label);
  }

  console.log('Analytics aggregation rich audit passed with numeric validation.');
  console.log(
    JSON.stringify(
      {
        organizationId,
        expected,
        actual: {
          daily: {
            cac: Number(daily.cac),
            ltv: Number(daily.ltv),
            revenue: Number(daily.revenue),
            churn: Number(daily.churn),
          },
          weekly: {
            cac: Number(weekly.cac),
            ltv: Number(weekly.ltv),
            revenue: Number(weekly.revenue),
            churn: Number(weekly.churn),
          },
          monthly: {
            cac: Number(monthly.cac),
            ltv: Number(monthly.ltv),
            revenue: Number(monthly.revenue),
            churn: Number(monthly.churn),
          },
        },
      },
      null,
      2,
    ),
  );
}

async function seedStressAuditFixtures(
  prisma: PrismaService,
  organizationId: string,
  anchors: PeriodAnchors,
): Promise<ExpectedMetrics & { customerCount: number; subscriptionCount: number; revenueEventCount: number }> {
  const channel = await prisma.marketingChannel.create({
    data: {
      organizationId,
      name: `Stress Channel ${randomUUID().slice(0, 6)}`,
      type: 'PAID_SEARCH',
    },
  });

  const campaignIds: string[] = [];
  for (let index = 0; index < 5; index += 1) {
    const campaign = await prisma.marketingCampaign.create({
      data: {
        organizationId,
        channelId: channel.id,
        name: `Stress Campaign ${index + 1} ${randomUUID().slice(0, 4)}`,
        status: 'ACTIVE',
        startDate: anchors.monthlyStart,
      },
    });
    campaignIds.push(campaign.id);
  }

  const marketingRows = campaignIds.map((campaignId) => ({
    organizationId,
    campaignId,
    impressions: 100000,
    clicks: 5000,
    conversions: 20,
    cost: 100000,
    date: anchors.dailyDate,
  }));
  await prisma.marketingMetric.createMany({ data: marketingRows });

  const legacyDate = new Date(anchors.monthlyStart);
  legacyDate.setUTCDate(legacyDate.getUTCDate() - 10);
  const dailyNoon = new Date(anchors.dailyDate);
  dailyNoon.setUTCHours(12, 0, 0, 0);

  const legacyCustomers = Array.from({ length: 40 }, (_, index) => ({
    organizationId,
    email: `stress-legacy-${index}-${randomUUID().slice(0, 6)}@audit.local`,
    firstSeen: legacyDate,
    acquisitionChannel: 'Legacy',
  }));

  const newCustomers = Array.from({ length: 100 }, (_, index) => ({
    organizationId,
    email: `stress-new-${index}-${randomUUID().slice(0, 6)}@audit.local`,
    firstSeen: dailyNoon,
    acquisitionChannel: channel.name,
  }));

  await prisma.customer.createMany({
    data: [...legacyCustomers, ...newCustomers],
  });

  const customers = await prisma.customer.findMany({
    where: { organizationId },
    select: { id: true, firstSeen: true },
    orderBy: { firstSeen: 'asc' },
  });

  const existingPlan = await prisma.plan.findUnique({
    where: {
      tier: 'Growth',
    },
  });

  const plan =
    existingPlan ??
    (await prisma.plan.create({
      data: {
        name: `Stress Plan ${randomUUID().slice(0, 6)}`,
        tier: 'Growth',
        priceMonthly: 10000,
        priceYearly: 100000,
        currency: 'NGN',
      },
    }));

  const longStart = new Date(anchors.monthlyStart);
  longStart.setUTCDate(longStart.getUTCDate() - 120);
  const longEnd = new Date(anchors.monthlyStart);
  longEnd.setUTCDate(longEnd.getUTCDate() - 30);

  const churnStart = new Date(anchors.monthlyStart);
  churnStart.setUTCDate(churnStart.getUTCDate() - 120);

  const baseSubscriptionRows = Array.from({ length: 80 }, () => ({
    organizationId,
    planId: plan.id,
    status: 'ACTIVE' as const,
    billingInterval: 'MONTHLY' as const,
    startDate: longStart,
    endDate: longEnd,
  }));

  const churnSubscriptionRows = Array.from({ length: 20 }, () => ({
    organizationId,
    planId: plan.id,
    status: 'CANCELED' as const,
    billingInterval: 'MONTHLY' as const,
    startDate: churnStart,
    endDate: dailyNoon,
  }));

  await prisma.subscription.createMany({
    data: [...baseSubscriptionRows, ...churnSubscriptionRows],
  });

  const revenueCustomers = customers.slice(40, 120);
  const revenueRows = revenueCustomers.map((customer, index) => ({
    organizationId,
    customerId: customer.id,
    amount: 10000 + (index % 5) * 2000,
    currency: 'NGN' as const,
    eventType: index % 2 === 0 ? 'SUBSCRIPTION_STARTED' as const : 'SUBSCRIPTION_RENEWED' as const,
    timestamp: dailyNoon,
  }));
  await prisma.revenueEvent.createMany({ data: revenueRows });

  const eventRows = revenueCustomers.flatMap((customer) => [
    {
      organizationId,
      customerId: customer.id,
      eventType: 'SIGNUP' as const,
      timestamp: dailyNoon,
    },
    {
      organizationId,
      customerId: customer.id,
      eventType: 'PURCHASE' as const,
      timestamp: dailyNoon,
    },
  ]);
  await prisma.customerEvent.createMany({ data: eventRows });

  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId },
    select: { startDate: true, endDate: true },
  });

  const lifetimeMonths = subscriptions.map((subscription) => {
    const end = subscription.endDate as Date;
    return Math.max(0, (end.getTime() - subscription.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  });
  const averageLifetimeMonths =
    lifetimeMonths.reduce((sum, months) => sum + months, 0) / Math.max(1, lifetimeMonths.length);

  const totalRevenue = revenueRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const customerWithRevenueCount = new Set(revenueRows.map((row) => row.customerId)).size;
  const averageRevenuePerCustomer =
    customerWithRevenueCount === 0 ? 0 : totalRevenue / customerWithRevenueCount;

  const customersAtStart = customers.filter((customer) => customer.firstSeen < anchors.monthlyStart).length;
  const customersLost = churnSubscriptionRows.length;

  return {
    cac: marketingRows.reduce((sum, row) => sum + Number(row.cost), 0) / newCustomers.length,
    ltv: averageRevenuePerCustomer * averageLifetimeMonths,
    revenue: totalRevenue,
    churn: customersAtStart === 0 ? 0 : Math.min(customersAtStart, customersLost) / customersAtStart,
    customerCount: customers.length,
    subscriptionCount: subscriptions.length,
    revenueEventCount: revenueRows.length,
  };
}

async function runStressAudit(
  prisma: PrismaService,
  aggregationService: AnalyticsAggregationService,
  organizationId: string,
): Promise<void> {
  const anchors = resolvePeriodAnchors(new Date());
  const expected = await seedStressAuditFixtures(prisma, organizationId, anchors);

  await aggregationService.aggregateForPeriod('daily');
  await aggregationService.aggregateForPeriod('weekly');
  await aggregationService.aggregateForPeriod('monthly');

  const [daily, weekly, monthly] = await Promise.all([
    prisma.dailyMetrics.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date: anchors.dailyDate,
        },
      },
    }),
    prisma.weeklyMetrics.findUnique({
      where: {
        organizationId_weekStart: {
          organizationId,
          weekStart: anchors.weeklyStart,
        },
      },
    }),
    prisma.monthlyMetrics.findUnique({
      where: {
        organizationId_monthStart: {
          organizationId,
          monthStart: anchors.monthlyStart,
        },
      },
    }),
  ]);

  if (!daily || !weekly || !monthly) {
    throw new Error('Stress audit could not locate one or more rolled-up metric rows');
  }

  const checks = [
    { label: 'daily.cac', actual: Number(daily.cac), expected: expected.cac },
    { label: 'daily.ltv', actual: Number(daily.ltv), expected: expected.ltv },
    { label: 'daily.revenue', actual: Number(daily.revenue), expected: expected.revenue },
    { label: 'daily.churn', actual: Number(daily.churn), expected: expected.churn },
    { label: 'weekly.cac', actual: Number(weekly.cac), expected: expected.cac },
    { label: 'weekly.ltv', actual: Number(weekly.ltv), expected: expected.ltv },
    { label: 'weekly.revenue', actual: Number(weekly.revenue), expected: expected.revenue },
    { label: 'weekly.churn', actual: Number(weekly.churn), expected: expected.churn },
    { label: 'monthly.cac', actual: Number(monthly.cac), expected: expected.cac },
    { label: 'monthly.ltv', actual: Number(monthly.ltv), expected: expected.ltv },
    { label: 'monthly.revenue', actual: Number(monthly.revenue), expected: expected.revenue },
    { label: 'monthly.churn', actual: Number(monthly.churn), expected: expected.churn },
  ];

  for (const check of checks) {
    assertClose(check.actual, check.expected, check.label);
  }

  console.log('Analytics aggregation stress audit passed with numeric validation.');
  console.log(
    JSON.stringify(
      {
        organizationId,
        volume: {
          customers: expected.customerCount,
          subscriptions: expected.subscriptionCount,
          revenueEvents: expected.revenueEventCount,
        },
        expected: {
          cac: expected.cac,
          ltv: expected.ltv,
          revenue: expected.revenue,
          churn: expected.churn,
        },
        actual: {
          daily: {
            cac: Number(daily.cac),
            ltv: Number(daily.ltv),
            revenue: Number(daily.revenue),
            churn: Number(daily.churn),
          },
          weekly: {
            cac: Number(weekly.cac),
            ltv: Number(weekly.ltv),
            revenue: Number(weekly.revenue),
            churn: Number(weekly.churn),
          },
          monthly: {
            cac: Number(monthly.cac),
            ltv: Number(monthly.ltv),
            revenue: Number(monthly.revenue),
            churn: Number(monthly.churn),
          },
        },
      },
      null,
      2,
    ),
  );
}

async function run() {
  const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
  const mode = (modeArg ? modeArg.split('=')[1] : 'smoke') as 'smoke' | 'rich' | 'stress';

  if (mode !== 'smoke' && mode !== 'rich' && mode !== 'stress') {
    throw new Error(`Unsupported mode: ${mode}. Use --mode=smoke, --mode=rich or --mode=stress`);
  }

  const app = await NestFactory.createApplicationContext(AnalyticsAuditModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const aggregationService = app.get(AnalyticsAggregationService);

  const marker = `analytics-audit-${randomUUID().slice(0, 8)}`;
  let organizationId: string | null = null;

  try {
    const organization = await prisma.organization.create({
      data: {
        name: marker,
        industry: Industry.OTHER,
      },
    });

    organizationId = organization.id;
    console.log(`Created audit organization: ${organizationId}`);
    console.log(`Running analytics aggregation audit mode: ${mode}`);

    if (mode === 'stress') {
      await runStressAudit(prisma, aggregationService, organizationId);
    } else if (mode === 'rich') {
      await runRichAudit(prisma, aggregationService, organizationId);
    } else {
      await runSmokeAudit(prisma, aggregationService, organizationId);
    }
  } finally {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } });
      console.log(`Deleted audit organization: ${organizationId}`);
    }

    await app.close();
  }
}

run().catch((error) => {
  console.error('Analytics aggregation audit failed:', error);
  process.exit(1);
});

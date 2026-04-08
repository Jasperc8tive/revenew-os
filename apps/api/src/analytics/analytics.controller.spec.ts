import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeAll, beforeEach, afterAll, describe, expect, it, jest } from '@jest/globals';
import { CustomerEventType, DealStageType, RevenueEventType, SubscriptionStatus } from '@prisma/client';
import request = require('supertest');
import { BillingAccessService } from '../billing/billing-access.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { DataQualityService } from '../data-quality/data-quality.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { AnalyticsController } from './analytics.controller';
import { ConfidenceScoringService } from './confidence-scoring.service';
import { AnalyticsService } from './analytics.service';
import { VerifiedMetricsService } from './verified-metrics.service';

type DateRangeFilter = {
  gte?: Date;
  lte?: Date;
  lt?: Date;
};

type MockWhereClause = {
  organizationId?: string;
  date?: DateRangeFilter;
  firstSeen?: DateRangeFilter;
  acquisitionChannel?: string;
  timestamp?: DateRangeFilter;
  status?: SubscriptionStatus;
  endDate?: DateRangeFilter;
  eventType?: CustomerEventType;
  createdAt?: DateRangeFilter;
  campaign?: {
    name?: string;
    channel?: {
      name?: string;
    };
  };
};

const inDateRange = (value: Date, range?: DateRangeFilter): boolean => {
  if (!range) {
    return true;
  }

  if (range.gte && value < range.gte) {
    return false;
  }

  if (range.lte && value > range.lte) {
    return false;
  }

  if (range.lt && value >= range.lt) {
    return false;
  }

  return true;
};

describe('AnalyticsController (e2e)', () => {
  let app: INestApplication;

  const orgId = 'org-analytics';
  const startDate = new Date('2026-01-01T00:00:00.000Z');
  const endDate = new Date('2026-01-31T23:59:59.999Z');

  const marketingMetrics = [
    {
      id: 'metric-google',
      organizationId: orgId,
      date: new Date('2026-01-08T00:00:00.000Z'),
      cost: 120000,
      conversions: 2,
      campaign: {
        id: 'campaign-google',
        name: 'Google Growth',
        channel: {
          id: 'channel-google',
          name: 'Google Ads',
        },
      },
    },
    {
      id: 'metric-meta',
      organizationId: orgId,
      date: new Date('2026-01-18T00:00:00.000Z'),
      cost: 30000,
      conversions: 1,
      campaign: {
        id: 'campaign-meta',
        name: 'Meta Retargeting',
        channel: {
          id: 'channel-meta',
          name: 'Meta Ads',
        },
      },
    },
  ];

  const customers = [
    {
      id: 'customer-legacy',
      organizationId: orgId,
      firstSeen: new Date('2025-12-15T09:00:00.000Z'),
      acquisitionChannel: 'Referral',
    },
    {
      id: 'customer-a',
      organizationId: orgId,
      firstSeen: new Date('2026-01-05T09:00:00.000Z'),
      acquisitionChannel: 'Google Ads',
    },
    {
      id: 'customer-b',
      organizationId: orgId,
      firstSeen: new Date('2026-01-10T09:00:00.000Z'),
      acquisitionChannel: 'Google Ads',
    },
    {
      id: 'customer-c',
      organizationId: orgId,
      firstSeen: new Date('2026-01-15T09:00:00.000Z'),
      acquisitionChannel: 'Meta Ads',
    },
  ];

  const subscriptions = [
    {
      id: 'subscription-canceled',
      organizationId: orgId,
      status: SubscriptionStatus.CANCELED,
      startDate: new Date('2025-11-01T00:00:00.000Z'),
      endDate: new Date('2026-01-25T00:00:00.000Z'),
    },
    {
      id: 'subscription-active',
      organizationId: orgId,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date('2025-09-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
    },
  ];

  const revenueEvents = [
    {
      id: 'revenue-previous-window',
      organizationId: orgId,
      customerId: 'customer-a',
      amount: 100000,
      eventType: RevenueEventType.SUBSCRIPTION_STARTED,
      timestamp: new Date('2025-12-15T10:00:00.000Z'),
    },
    {
      id: 'revenue-current-a',
      organizationId: orgId,
      customerId: 'customer-a',
      amount: 120000,
      eventType: RevenueEventType.SUBSCRIPTION_STARTED,
      timestamp: new Date('2026-01-12T10:00:00.000Z'),
    },
    {
      id: 'revenue-current-b',
      organizationId: orgId,
      customerId: 'customer-b',
      amount: 80000,
      eventType: RevenueEventType.SUBSCRIPTION_RENEWED,
      timestamp: new Date('2026-01-20T10:00:00.000Z'),
    },
    {
      id: 'revenue-current-upgrade',
      organizationId: orgId,
      customerId: 'customer-a',
      amount: 40000,
      eventType: RevenueEventType.UPGRADE,
      timestamp: new Date('2026-01-25T10:00:00.000Z'),
    },
  ];

  const customerEvents = [
    {
      id: 'event-legacy-purchase',
      organizationId: orgId,
      customerId: 'customer-legacy',
      eventType: CustomerEventType.PURCHASE,
      timestamp: new Date('2025-12-20T12:00:00.000Z'),
    },
    {
      id: 'event-page-view-1',
      organizationId: orgId,
      customerId: 'customer-a',
      eventType: CustomerEventType.PAGE_VIEW,
      timestamp: new Date('2026-01-04T12:00:00.000Z'),
    },
    {
      id: 'event-page-view-2',
      organizationId: orgId,
      customerId: 'customer-a',
      eventType: CustomerEventType.PAGE_VIEW,
      timestamp: new Date('2026-01-05T12:00:00.000Z'),
    },
    {
      id: 'event-page-view-3',
      organizationId: orgId,
      customerId: 'customer-b',
      eventType: CustomerEventType.PAGE_VIEW,
      timestamp: new Date('2026-01-10T12:00:00.000Z'),
    },
    {
      id: 'event-page-view-4',
      organizationId: orgId,
      customerId: 'customer-c',
      eventType: CustomerEventType.PAGE_VIEW,
      timestamp: new Date('2026-01-15T12:00:00.000Z'),
    },
    {
      id: 'event-signup-1',
      organizationId: orgId,
      customerId: 'customer-a',
      eventType: CustomerEventType.SIGNUP,
      timestamp: new Date('2026-01-05T12:30:00.000Z'),
    },
    {
      id: 'event-signup-2',
      organizationId: orgId,
      customerId: 'customer-b',
      eventType: CustomerEventType.SIGNUP,
      timestamp: new Date('2026-01-11T12:30:00.000Z'),
    },
    {
      id: 'event-purchase-1',
      organizationId: orgId,
      customerId: 'customer-a',
      eventType: CustomerEventType.PURCHASE,
      timestamp: new Date('2026-01-12T14:00:00.000Z'),
    },
    {
      id: 'event-purchase-2',
      organizationId: orgId,
      customerId: 'customer-b',
      eventType: CustomerEventType.PURCHASE,
      timestamp: new Date('2026-01-20T14:00:00.000Z'),
    },
  ];

  const deals = [
    {
      id: 'deal-won',
      organizationId: orgId,
      createdAt: new Date('2026-01-03T09:00:00.000Z'),
      closeDate: new Date('2026-01-20T09:00:00.000Z'),
      stage: DealStageType.WON,
      value: 200000,
    },
    {
      id: 'deal-lead',
      organizationId: orgId,
      createdAt: new Date('2026-01-05T09:00:00.000Z'),
      closeDate: null,
      stage: DealStageType.LEAD,
      value: 100000,
    },
    {
      id: 'deal-lost',
      organizationId: orgId,
      createdAt: new Date('2026-01-06T09:00:00.000Z'),
      closeDate: new Date('2026-01-25T09:00:00.000Z'),
      stage: DealStageType.LOST,
      value: 50000,
    },
  ];

  const prismaMock = {
    marketingMetric: {
      findMany: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return marketingMetrics.filter((metric) => {
          if (metric.organizationId !== where.organizationId) {
            return false;
          }

          if (!inDateRange(metric.date, where.date)) {
            return false;
          }

          const campaignName = where.campaign?.name;
          if (campaignName && metric.campaign.name !== campaignName) {
            return false;
          }

          const channelName = where.campaign?.channel?.name;
          if (channelName && metric.campaign.channel.name !== channelName) {
            return false;
          }

          return true;
        });
      }),
    },
    customer: {
      count: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return customers.filter((customer) => {
          if (customer.organizationId !== where.organizationId) {
            return false;
          }

          if (!inDateRange(customer.firstSeen, where.firstSeen)) {
            return false;
          }

          if (where.acquisitionChannel && customer.acquisitionChannel !== where.acquisitionChannel) {
            return false;
          }

          return true;
        }).length;
      }),
    },
    revenueEvent: {
      findMany: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return revenueEvents.filter((event) => {
          if (event.organizationId !== where.organizationId) {
            return false;
          }

          return inDateRange(event.timestamp, where.timestamp);
        });
      }),
    },
    subscription: {
      findMany: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return subscriptions.filter((subscription) => subscription.organizationId === where.organizationId);
      }),
      count: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return subscriptions.filter((subscription) => {
          if (subscription.organizationId !== where.organizationId) {
            return false;
          }

          if (where.status && subscription.status !== where.status) {
            return false;
          }

          if (!subscription.endDate) {
            return false;
          }

          return inDateRange(subscription.endDate, where.endDate);
        }).length;
      }),
    },
    customerEvent: {
      findMany: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return customerEvents.filter((event) => {
          if (event.organizationId !== where.organizationId) {
            return false;
          }

          return inDateRange(event.timestamp, where.timestamp);
        });
      }),
      groupBy: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        const filtered = customerEvents.filter((event) => {
          if (event.organizationId !== where.organizationId) {
            return false;
          }

          if (where.eventType && event.eventType !== where.eventType) {
            return false;
          }

          return inDateRange(event.timestamp, where.timestamp);
        });

        const grouped = new Map<string, Date>();

        for (const event of filtered) {
          const existing = grouped.get(event.customerId);
          if (!existing || event.timestamp < existing) {
            grouped.set(event.customerId, event.timestamp);
          }
        }

        return Array.from(grouped.entries()).map(([customerId, minTimestamp]) => ({
          customerId,
          _min: { timestamp: minTimestamp },
        }));
      }),
    },
    deal: {
      findMany: jest.fn(async ({ where }: { where: MockWhereClause }) => {
        return deals.filter((deal) => {
          if (deal.organizationId !== where.organizationId) {
            return false;
          }

          return inDateRange(deal.createdAt, where.createdAt);
        });
      }),
    },
  };

  const billingAccessServiceMock = {
    assertFeatureAccess: jest.fn(async () => true),
  };

  const confidenceScoringServiceMock = {
    score: jest.fn(async () => ({
      score: 0.82,
      components: {
        volume: 0.8,
        consistency: 0.85,
        variance: 0.8,
        anomaly: 0.9,
        freshness: 0.75,
      },
      diagnostics: {
        anomalyEventsLast7Days: 0,
        dataPoints: 64,
      },
    })),
  };

  const recommendationsServiceMock = {
    evaluateGuardrails: jest.fn(() => ({ allowed: true })),
    persistAuditableRecommendation: jest.fn(async () => ({
      persisted: true,
      recommendationId: 'rec-test',
      traceId: 'trace-test',
    })),
  };

  const dataQualityServiceMock = {
    scanAndStoreAnomalies: jest.fn(async () => ({ created: 0, anomalies: [] })),
    getAnomalyPenalty: jest.fn(async () => ({ count: 0, factor: 1 })),
    getSummary: jest.fn(async () => ({
      organizationId: orgId,
      totals: { totalEvents: 0, validationEvents: 0, anomalyEvents: 0 },
      severityBreakdown: [],
      lastOccurredAt: null,
    })),
  };

  const verifiedMetricsServiceMock = {
    upsertSnapshots: jest.fn(async () => [
      {
        id: 'verified-cac',
        metricKey: 'cac',
        metricValue: 50000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/cac/v1',
        sourceTables: ['marketing_metrics', 'customers'],
        sampleSize: 3,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-ltv',
        metricKey: 'ltv',
        metricValue: 300000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/ltv/v1',
        sourceTables: ['revenue_events', 'subscriptions'],
        sampleSize: 2,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-revenue',
        metricKey: 'revenue',
        metricValue: 240000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/revenue/v1',
        sourceTables: ['revenue_events'],
        sampleSize: 3,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-churn',
        metricKey: 'churn',
        metricValue: 1,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/churn/v1',
        sourceTables: ['customers', 'subscriptions'],
        sampleSize: 1,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
    ]),
    listSnapshots: jest.fn(async () => [
      {
        id: 'verified-cac',
        metricKey: 'cac',
        metricValue: 50000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/cac/v1',
        sourceTables: ['marketing_metrics', 'customers'],
        sampleSize: 3,
        dataQualityFlags: [],
        inputs: {
          totalSpend: 150000,
          newCustomers: 3,
          sourceRecordCount: 2,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-ltv',
        metricKey: 'ltv',
        metricValue: 300000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/ltv/v1',
        sourceTables: ['revenue_events', 'subscriptions'],
        sampleSize: 2,
        dataQualityFlags: [],
        inputs: {
          averageRevenuePerCustomer: 120000,
          averageCustomerLifetimeMonths: 2.5,
          subscriptionCount: 2,
          customersWithRevenueCount: 2,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-revenue',
        metricKey: 'revenue',
        metricValue: 240000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/revenue/v1',
        sourceTables: ['revenue_events'],
        sampleSize: 3,
        dataQualityFlags: [],
        inputs: {
          growthRate: 1.4,
          eventCount: 3,
          mrr: 240000,
          arr: 2880000,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-churn',
        metricKey: 'churn',
        metricValue: 1,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/churn/v1',
        sourceTables: ['customers', 'subscriptions'],
        sampleSize: 1,
        dataQualityFlags: [],
        inputs: {
          totalCustomersAtStart: 1,
          totalCustomersLost: 1,
        },
        verifiedAt: endDate.toISOString(),
      },
    ]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        AnalyticsService,
        JwtGuard,
        {
          provide: BillingAccessService,
          useValue: billingAccessServiceMock,
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfidenceScoringService,
          useValue: confidenceScoringServiceMock,
        },
        {
          provide: RecommendationsService,
          useValue: recommendationsServiceMock,
        },
        {
          provide: DataQualityService,
          useValue: dataQualityServiceMock,
        },
        {
          provide: VerifiedMetricsService,
          useValue: verifiedMetricsServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    billingAccessServiceMock.assertFeatureAccess.mockImplementation(async () => true);
    confidenceScoringServiceMock.score.mockImplementation(async () => ({
      score: 0.82,
      components: {
        volume: 0.8,
        consistency: 0.85,
        variance: 0.8,
        anomaly: 0.9,
        freshness: 0.75,
      },
      diagnostics: {
        anomalyEventsLast7Days: 0,
        dataPoints: 64,
      },
    }));
    recommendationsServiceMock.evaluateGuardrails.mockImplementation(() => ({ allowed: true }));
    recommendationsServiceMock.persistAuditableRecommendation.mockImplementation(async () => ({
      persisted: true,
      recommendationId: 'rec-test',
      traceId: 'trace-test',
    }));
    dataQualityServiceMock.scanAndStoreAnomalies.mockImplementation(async () => ({
      created: 0,
      anomalies: [],
    }));
    dataQualityServiceMock.getAnomalyPenalty.mockImplementation(async () => ({
      count: 0,
      factor: 1,
    }));
    dataQualityServiceMock.getSummary.mockImplementation(async () => ({
      organizationId: orgId,
      totals: { totalEvents: 0, validationEvents: 0, anomalyEvents: 0 },
      severityBreakdown: [],
      lastOccurredAt: null,
    }));
    verifiedMetricsServiceMock.upsertSnapshots.mockImplementation(async () => [
      {
        id: 'verified-cac',
        metricKey: 'cac',
        metricValue: 50000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/cac/v1',
        sourceTables: ['marketing_metrics', 'customers'],
        sampleSize: 3,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-ltv',
        metricKey: 'ltv',
        metricValue: 300000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/ltv/v1',
        sourceTables: ['revenue_events', 'subscriptions'],
        sampleSize: 2,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-revenue',
        metricKey: 'revenue',
        metricValue: 240000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/revenue/v1',
        sourceTables: ['revenue_events'],
        sampleSize: 3,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-churn',
        metricKey: 'churn',
        metricValue: 1,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/churn/v1',
        sourceTables: ['customers', 'subscriptions'],
        sampleSize: 1,
        dataQualityFlags: [],
        verifiedAt: endDate.toISOString(),
      },
    ]);
    verifiedMetricsServiceMock.listSnapshots.mockImplementation(async () => [
      {
        id: 'verified-cac',
        metricKey: 'cac',
        metricValue: 50000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/cac/v1',
        sourceTables: ['marketing_metrics', 'customers'],
        sampleSize: 3,
        dataQualityFlags: [],
        inputs: {
          totalSpend: 150000,
          newCustomers: 3,
          sourceRecordCount: 2,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-ltv',
        metricKey: 'ltv',
        metricValue: 300000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/ltv/v1',
        sourceTables: ['revenue_events', 'subscriptions'],
        sampleSize: 2,
        dataQualityFlags: [],
        inputs: {
          averageRevenuePerCustomer: 120000,
          averageCustomerLifetimeMonths: 2.5,
          subscriptionCount: 2,
          customersWithRevenueCount: 2,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-revenue',
        metricKey: 'revenue',
        metricValue: 240000,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/revenue/v1',
        sourceTables: ['revenue_events'],
        sampleSize: 3,
        dataQualityFlags: [],
        inputs: {
          growthRate: 1.4,
          eventCount: 3,
          mrr: 240000,
          arr: 2880000,
        },
        verifiedAt: endDate.toISOString(),
      },
      {
        id: 'verified-churn',
        metricKey: 'churn',
        metricValue: 1,
        windowType: 'CUSTOM',
        windowStart: startDate.toISOString(),
        windowEnd: endDate.toISOString(),
        formulaVersion: 'analytics/churn/v1',
        sourceTables: ['customers', 'subscriptions'],
        sampleSize: 1,
        dataQualityFlags: [],
        inputs: {
          totalCustomersAtStart: 1,
          totalCustomersLost: 1,
        },
        verifiedAt: endDate.toISOString(),
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /analytics/overview returns consolidated metrics', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/overview?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      organizationId: orgId,
      cac: {
        cac: 50000,
      },
      revenue: {
        totalRevenue: 240000,
      },
      pipeline: {
        dealCount: 3,
      },
    });
    expect(response.body.verifiedMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'cac',
          formulaVersion: 'analytics/cac/v1',
        }),
      ]),
    );
    expect(response.body.conversion.counts.activatedCustomers).toBe(2);
  });

  it('GET /analytics/cac returns expected CAC and segmentation', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/cac?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.totalSpend).toBe(150000);
    expect(response.body.newCustomers).toBe(3);
    expect(response.body.cac).toBe(50000);
    expect(response.body.byChannel).toHaveLength(2);
    expect(response.body.byCampaign).toHaveLength(2);
  });

  it('GET /analytics/ltv returns positive LTV with expected components', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/ltv?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.averageRevenuePerCustomer).toBe(120000);
    expect(response.body.averageCustomerLifetimeMonths).toBeGreaterThan(0);
    expect(response.body.ltv).toBeGreaterThan(response.body.averageRevenuePerCustomer);
  });

  it('GET /analytics/churn returns monthly churn series', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/churn?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.overallRate).toBe(1);
    expect(response.body.byMonth).toHaveLength(1);
    expect(response.body.byMonth[0]).toMatchObject({
      customersAtStart: 1,
      customersLost: 1,
      churnRate: 1,
    });
  });

  it('GET /analytics/revenue returns revenue totals, growth and forecast', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/revenue?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.totalRevenue).toBe(240000);
    expect(response.body.mrr).toBe(240000);
    expect(response.body.arr).toBe(2880000);
    expect(response.body.growthRate).toBeCloseTo(1.4, 5);
    expect(response.body.forecast).toHaveLength(6);
    expect(response.body.formatted.totalRevenue).toContain('₦');
  });

  it('GET /analytics/pipeline returns velocity metrics', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/pipeline?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.dealCount).toBe(3);
    expect(response.body.averageDealValue).toBeCloseTo(116666.6667, 3);
    expect(response.body.winRate).toBeCloseTo(1 / 3, 5);
    expect(response.body.salesCycleLengthDays).toBeCloseTo(18, 5);
    expect(response.body.velocity).toBeGreaterThan(0);
  });

  it('GET /analytics/executive-summary returns command center KPIs', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/executive-summary?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .expect(200);

    expect(response.body.organizationId).toBe(orgId);
    expect(response.body.kpis.revenue).toBe(240000);
    expect(response.body.kpis.cac).toBe(50000);
    expect(response.body.kpis.ltv).toBeGreaterThan(0);
    expect(Array.isArray(response.body.alerts)).toBe(true);
    expect(response.body.verifiedMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'revenue',
          formulaVersion: 'analytics/revenue/v1',
        }),
      ]),
    );
  });

  it('GET /analytics/verified-metrics returns snapshot provenance', async () => {
    const response = await request(app.getHttpServer())
      .get(`/analytics/verified-metrics?organizationId=${orgId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&windowType=CUSTOM`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricKey: 'cac',
          sampleSize: 3,
          formulaVersion: 'analytics/cac/v1',
        }),
      ]),
    );
  });
});
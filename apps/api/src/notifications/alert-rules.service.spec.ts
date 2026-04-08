import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AlertMetric, AlertOperator, Prisma } from '@prisma/client';
import { AlertRulesService } from './alert-rules.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const makePrisma = () => ({
  alertRule: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  alertEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
});

const makeAnalytics = () => ({
  getCACRaw: jest.fn(),
  getLTVRaw: jest.fn(),
  getChurnRaw: jest.fn(),
  getRevenueRaw: jest.fn(),
});

const makeBilling = () => ({
  assertFeatureAccess: jest.fn(),
});

const makeNotifications = () => ({
  dispatchAlert: jest.fn(),
});

describe('AlertRulesService', () => {
  let service: AlertRulesService;
  let prisma: ReturnType<typeof makePrisma>;
  let analytics: ReturnType<typeof makeAnalytics>;
  let billing: ReturnType<typeof makeBilling>;
  let notifications: ReturnType<typeof makeNotifications>;

  beforeEach(async () => {
    prisma = makePrisma();
    analytics = makeAnalytics();
    billing = makeBilling();
    notifications = makeNotifications();

    jest.clearAllMocks();

    billing.assertFeatureAccess.mockImplementation(async () => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertRulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnalyticsService, useValue: analytics },
        { provide: BillingAccessService, useValue: billing },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AlertRulesService>(AlertRulesService);
  });

  describe('threshold comparison — GT operator', () => {
    it('triggers when metric value is strictly greater than threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.CHURN, operator: AlertOperator.GT, threshold: 5 });
        analytics.getChurnRaw.mockImplementation(async () => ({ overallRate: 6.1 }));
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-1' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(true);
      expect(result.metricValue).toBeCloseTo(6.1);
      expect(prisma.alertEvent.create).toHaveBeenCalledTimes(1);
    });

    it('does not trigger when metric value equals threshold exactly', async () => {
      const rule = buildRule({ metric: AlertMetric.CHURN, operator: AlertOperator.GT, threshold: 5 });
        analytics.getChurnRaw.mockImplementation(async () => ({ overallRate: 5 }));
        prisma.alertRule.update.mockImplementation(async () => rule);

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(false);
      expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    });

    it('does not trigger when metric value is below threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.REVENUE, operator: AlertOperator.GT, threshold: 1_000_000 });
        analytics.getRevenueRaw.mockImplementation(async () => ({ totalRevenue: 800_000 }));
        prisma.alertRule.update.mockImplementation(async () => rule);

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(false);
    });
  });

  describe('threshold comparison — LT operator', () => {
    it('triggers when metric value is strictly less than threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.LTV, operator: AlertOperator.LT, threshold: 500 });
        analytics.getLTVRaw.mockImplementation(async () => 450);
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-2' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(true);
      expect(prisma.alertEvent.create).toHaveBeenCalledTimes(1);
    });

    it('does not trigger when metric value equals threshold exactly', async () => {
      const rule = buildRule({ metric: AlertMetric.LTV, operator: AlertOperator.LT, threshold: 500 });
        analytics.getLTVRaw.mockImplementation(async () => 500);
        prisma.alertRule.update.mockImplementation(async () => rule);

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(false);
    });

    it('does not trigger when metric value is above threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.CAC, operator: AlertOperator.LT, threshold: 200 });
        analytics.getCACRaw.mockImplementation(async () => 250);
        prisma.alertRule.update.mockImplementation(async () => rule);

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(false);
    });
  });

  describe('threshold comparison — CHANGE_PCT operator', () => {
    it('triggers when absolute percent change meets or exceeds threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.REVENUE, operator: AlertOperator.CHANGE_PCT, threshold: 10 });
        analytics.getRevenueRaw.mockImplementation(async () => ({ totalRevenue: 10 }));
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-3' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(true);
    });

    it('triggers for a negative percent change whose absolute value meets threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.REVENUE, operator: AlertOperator.CHANGE_PCT, threshold: 10 });
      // fetchMetricValue returns -15 (a -15% change stored as raw value)
        analytics.getRevenueRaw.mockImplementation(async () => ({ totalRevenue: -15 }));
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-4' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(true);
      expect(result.metricValue).toBe(-15);
    });

    it('does not trigger when absolute percent change is below threshold', async () => {
      const rule = buildRule({ metric: AlertMetric.REVENUE, operator: AlertOperator.CHANGE_PCT, threshold: 10 });
        analytics.getRevenueRaw.mockImplementation(async () => ({ totalRevenue: 9 }));
        prisma.alertRule.update.mockImplementation(async () => rule);

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(false);
    });

    it('triggers exactly at the threshold boundary (|value| === |threshold|)', async () => {
      const rule = buildRule({ metric: AlertMetric.CHURN, operator: AlertOperator.CHANGE_PCT, threshold: 5 });
        analytics.getChurnRaw.mockImplementation(async () => ({ overallRate: 5 }));
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-5' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const result = await service.evaluateRule(rule);

      expect(result.triggered).toBe(true);
    });
  });

  describe('evaluateRule — side effects', () => {
    it('records an AlertEvent with metric value and delivery details when triggered', async () => {
      const rule = buildRule({ metric: AlertMetric.CAC, operator: AlertOperator.GT, threshold: 100 });
        analytics.getCACRaw.mockImplementation(async () => 150);
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-6', ruleId: rule.id, metricValue: 150 }));
        notifications.dispatchAlert.mockImplementation(async () => ({
          deliveries: [{ channel: 'email', status: 'sent' }],
        }));

      const result = await service.evaluateRule(rule);

      expect(prisma.alertEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ruleId: rule.id,
            metricValue: 150,
            status: 'SENT',
          }),
        }),
      );
      expect(result.eventId).toBe('evt-6');
    });

    it('marks the alert event as FAILED when every delivery is skipped or failed', async () => {
      const rule = buildRule({ metric: AlertMetric.CAC, operator: AlertOperator.GT, threshold: 100 });
        analytics.getCACRaw.mockImplementation(async () => 150);
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-failed' }));
        notifications.dispatchAlert.mockImplementation(async () => ({
          deliveries: [
            { channel: 'email', status: 'skipped' },
            { channel: 'sms:+2348000000000', status: 'failed' },
          ],
        }));

      await service.evaluateRule(rule);

      expect(prisma.alertEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('updates lastCheckedAt regardless of whether the rule triggered', async () => {
      const rule = buildRule({ metric: AlertMetric.REVENUE, operator: AlertOperator.GT, threshold: 999_999_999 });
        analytics.getRevenueRaw.mockImplementation(async () => ({ totalRevenue: 1 }));
        prisma.alertRule.update.mockImplementation(async () => rule);

      await service.evaluateRule(rule);

      expect(prisma.alertRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastCheckedAt: expect.any(Date) }),
        }),
      );
    });

    it('dispatches notification with correct payload when triggered', async () => {
      const rule = buildRule({
        name: 'High CAC Alert',
        metric: AlertMetric.CAC,
        operator: AlertOperator.GT,
        threshold: 100,
        channels: ['email'],
      });
        analytics.getCACRaw.mockImplementation(async () => 200);
        prisma.alertRule.update.mockImplementation(async () => rule);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-7' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      await service.evaluateRule(rule);

      expect(notifications.dispatchAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-test',
          title: 'Alert: High CAC Alert',
          channels: ['email'],
        }),
      );
    });
  });

  describe('evaluateAll', () => {
    it('returns summary with checked and triggered counts', async () => {
      const ruleA = buildRule({ metric: AlertMetric.CHURN, operator: AlertOperator.GT, threshold: 5 });
      const ruleB = buildRule({ metric: AlertMetric.CAC, operator: AlertOperator.LT, threshold: 50 });
        prisma.alertRule.findMany.mockImplementation(async () => [ruleA, ruleB]);
        analytics.getChurnRaw.mockImplementation(async () => ({ overallRate: 6 })); // triggers ruleA
        analytics.getCACRaw.mockImplementation(async () => 80); // does NOT trigger ruleB (80 > 50)
        prisma.alertRule.update.mockImplementation(async () => ruleA);
        prisma.alertEvent.create.mockImplementation(async () => ({ id: 'evt-8' }));
        notifications.dispatchAlert.mockImplementation(async () => ({ deliveries: [] }));

      const summary = await service.evaluateAll();

      expect(summary.checked).toBe(2);
      expect(summary.triggered).toBe(1);
      expect(summary.evaluations).toHaveLength(2);
    });
  });
});

// ---- helpers ----

type RuleOverrides = Partial<{
  id: string;
  name: string;
  organizationId: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channels: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt: Date | null;
  lastTriggeredAt: Date | null;
}>;

function buildRule(overrides: RuleOverrides = {}) {
  const { threshold: rawThreshold, channels: rawChannels, ...rest } = overrides;
  return {
    id: 'rule-test',
    name: 'Test Rule',
    organizationId: 'org-test',
    metric: AlertMetric.CHURN,
    operator: AlertOperator.GT,
    threshold: new Prisma.Decimal(rawThreshold ?? 5),
    channels: (rawChannels ?? ['email']) as Prisma.JsonValue,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastCheckedAt: null,
    lastTriggeredAt: null,
    ...rest,
  };
}

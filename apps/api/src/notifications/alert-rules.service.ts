import {
  AlertMetric,
  AlertOperator,
  AlertRule,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateAlertRuleDto,
  ListAlertEventsQueryDto,
  ListAlertRulesQueryDto,
} from './dto/alert-rule.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class AlertRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly billingAccessService: BillingAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRule(input: CreateAlertRuleDto) {
    await this.assertAccessForRule(input.organizationId, input.metric, input.operator);

    return this.prisma.alertRule.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold,
        channels: input.channels as Prisma.InputJsonValue,
        active: input.active ?? true,
      },
    });
  }

  async listRules(input: ListAlertRulesQueryDto) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');

    return this.prisma.alertRule.findMany({
      where: {
        organizationId: input.organizationId,
        ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteRule(id: string, organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    await this.prisma.alertRule.deleteMany({
      where: {
        id,
        organizationId,
      },
    });

    return { deleted: true, id };
  }

  async listEvents(input: ListAlertEventsQueryDto) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');

    return this.prisma.alertEvent.findMany({
      where: {
        rule: {
          organizationId: input.organizationId,
        },
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            metric: true,
            operator: true,
            threshold: true,
          },
        },
      },
      orderBy: { firedAt: 'desc' },
      take: input.limit ?? 50,
    });
  }

  async getLifecycleSummary(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    const [ruleStats, recentEvents] = await Promise.all([
      this.prisma.alertRule.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          metric: true,
          active: true,
          lastCheckedAt: true,
          _count: {
            select: {
              events: true,
            },
          },
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          rule: {
            organizationId,
          },
        },
        include: {
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          firedAt: 'desc',
        },
        take: 20,
      }),
    ]);

    return {
      organizationId,
      rules: ruleStats.map((item) => ({
        id: item.id,
        name: item.name,
        metric: item.metric,
        active: item.active,
        lastCheckedAt: item.lastCheckedAt,
        totalEvents: item._count.events,
      })),
      recentEvents,
    };
  }

  async evaluateAll() {
    const rules = await this.prisma.alertRule.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });

    const evaluations = await Promise.all(rules.map((rule) => this.evaluateRule(rule)));
    return {
      checked: rules.length,
      triggered: evaluations.filter((evaluation) => evaluation.triggered).length,
      evaluations,
    };
  }

  async evaluateRule(rule: AlertRule) {
    const metricValue = await this.fetchMetricValue(rule.organizationId, rule.metric);
    const triggered = this.compareMetric(metricValue, Number(rule.threshold), rule.operator);

    if (!triggered) {
      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastCheckedAt: new Date() },
      });

      return {
        ruleId: rule.id,
        triggered: false,
        metricValue,
      };
    }

    const recentEvent = await this.prisma.alertEvent.findFirst({
      where: {
        ruleId: rule.id,
        status: 'SENT',
        firedAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000),
        },
      },
      orderBy: {
        firedAt: 'desc',
      },
    });

    if (recentEvent && Math.abs(Number(recentEvent.metricValue) - metricValue) < 0.0001) {
      const dedupedEvent = await this.prisma.alertEvent.create({
        data: {
          ruleId: rule.id,
          metricValue,
          status: 'SENT',
          deliveryDetails: {
            deduplicated: true,
            duplicateOf: recentEvent.id,
            suppressedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      await this.prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastCheckedAt: new Date() },
      });

      return {
        ruleId: rule.id,
        triggered: true,
        deduplicated: true,
        metricValue,
        eventId: dedupedEvent.id,
      };
    }

    const delivery = await this.notificationsService.dispatchAlert({
      organizationId: rule.organizationId,
      title: `Alert: ${rule.name}`,
      message: `${rule.metric} crossed threshold (${rule.operator} ${rule.threshold}) with value ${metricValue}.`,
      channels: this.normalizeChannels(rule.channels),
    });

    const event = await this.prisma.alertEvent.create({
      data: {
        ruleId: rule.id,
        metricValue,
        status: delivery.deliveries.some((entry) => entry.status === 'sent') ? 'SENT' : 'FAILED',
        deliveryDetails: delivery as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastCheckedAt: new Date() },
    });

    return {
      ruleId: rule.id,
      triggered: true,
      metricValue,
      eventId: event.id,
    };
  }

  private async assertAccessForRule(
    organizationId: string,
    metric: AlertMetric,
    operator: AlertOperator,
  ) {
    const requiresAdvanced =
      metric === AlertMetric.CAC ||
      metric === AlertMetric.LTV ||
      operator === AlertOperator.CHANGE_PCT;

    await this.billingAccessService.assertFeatureAccess(
      organizationId,
      requiresAdvanced ? 'analytics.full' : 'analytics.basic',
    );
  }

  private compareMetric(value: number, threshold: number, operator: AlertOperator): boolean {
    if (operator === AlertOperator.GT) {
      return value > threshold;
    }

    if (operator === AlertOperator.LT) {
      return value < threshold;
    }

    if (operator === AlertOperator.CHANGE_PCT) {
      return Math.abs(value) >= Math.abs(threshold);
    }

    return false;
  }

  private async fetchMetricValue(organizationId: string, metric: AlertMetric): Promise<number> {
    const input = { organizationId };

    if (metric === AlertMetric.CAC) {
      return this.analyticsService.getCACRaw(input);
    }

    if (metric === AlertMetric.LTV) {
      return this.analyticsService.getLTVRaw(input);
    }

    if (metric === AlertMetric.CHURN) {
      const churn = await this.analyticsService.getChurnRaw(input);
      return churn.overallRate;
    }

    const revenue = await this.analyticsService.getRevenueRaw(input);
    return revenue.totalRevenue;
  }

  private normalizeChannels(rawChannels: Prisma.JsonValue): string[] {
    if (!Array.isArray(rawChannels)) {
      return ['email'];
    }

    return rawChannels
      .map((channel) => (typeof channel === 'string' ? channel.trim().toLowerCase() : ''))
      .filter((channel) => channel.length > 0);
  }
}

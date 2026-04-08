import {
  calculateARR,
  calculateAverageCustomerLifetimeMonths,
  calculateAverageRevenuePerCustomer,
  calculateCAC,
  calculateCACBySegments,
  calculateChurnRate,
  calculateConversionMetrics,
  calculateLTV,
  calculatePipelineVelocity,
  calculateRevenueGrowthRate,
  ForecastPoint,
  forecastRevenue,
  formatNaira,
} from '../../../../packages/analytics/src';
import { Prisma, VerifiedMetricWindow } from '@prisma/client';
import {
  CustomerEventType,
  DealStageType,
  ImpactLevel,
  RevenueEventType,
  SubscriptionStatus,
} from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConfidenceScoringService } from './confidence-scoring.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { DataQualityService } from '../data-quality/data-quality.service';
import { VerifiedMetricsService } from './verified-metrics.service';

interface AnalyticsQueryInput {
  organizationId: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

interface CACQueryInput extends AnalyticsQueryInput {
  channel?: string;
  campaign?: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly confidenceScoringService: ConfidenceScoringService,
    private readonly recommendationsService: RecommendationsService,
    private readonly dataQualityService: DataQualityService,
    private readonly verifiedMetricsService: VerifiedMetricsService,
  ) {}

  async getOverview(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);

    const [cac, ltv, churn, revenue, conversion, pipeline] = await Promise.all([
      this.getCAC(input),
      this.getLTV(input),
      this.getChurn(input),
      this.getRevenue(input),
      this.getConversion(input),
      this.getPipeline(input),
    ]);

    const range = this.buildDateRange(input);
    await this.upsertVerifiedMetrics({
      organizationId: input.organizationId,
      windowType: VerifiedMetricWindow.CUSTOM,
      range,
      cac,
      ltv,
      churn,
      revenue,
    });
    const verifiedMetrics = await this.verifiedMetricsService.listSnapshots({
      organizationId: input.organizationId,
      windowType: VerifiedMetricWindow.CUSTOM,
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate),
    });

    return {
      organizationId: input.organizationId,
      range,
      cac,
      ltv,
      churn,
      revenue,
      conversion,
      pipeline,
      verifiedMetrics,
    };
  }

  async getExecutiveSummary(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);

    const [cac, ltv, churn, revenue, conversion, pipeline] = await Promise.all([
      this.getCAC(input),
      this.getLTV(input),
      this.getChurn(input),
      this.getRevenue(input),
      this.getConversion(input),
      this.getPipeline(input),
    ]);

    const range = this.buildDateRange(input);
    await this.upsertVerifiedMetrics({
      organizationId: input.organizationId,
      windowType: VerifiedMetricWindow.CUSTOM,
      range,
      cac,
      ltv,
      churn,
      revenue,
    });
    const verifiedMetrics = await this.verifiedMetricsService.listSnapshots({
      organizationId: input.organizationId,
      windowType: VerifiedMetricWindow.CUSTOM,
      startDate: new Date(range.startDate),
      endDate: new Date(range.endDate),
    });
    const verifiedMetricMap = this.toVerifiedMetricMap(verifiedMetrics);
    const verifiedCac = verifiedMetricMap.cac?.metricValue ?? 0;
    const verifiedLtv = verifiedMetricMap.ltv?.metricValue ?? 0;
    const verifiedRevenue = verifiedMetricMap.revenue?.metricValue ?? 0;
    const verifiedChurn = verifiedMetricMap.churn?.metricValue ?? 0;
    const verifiedRevenueGrowthRate = this.readNumericInput(
      verifiedMetricMap.revenue?.inputs,
      'growthRate',
      0,
    );
    const verifiedDataPoints = this.readNumericInput(
      verifiedMetricMap.cac?.inputs,
      'newCustomers',
      conversion.counts.totalCustomersInRange,
    );
    const hasAllRequiredSnapshots = ['cac', 'ltv', 'revenue', 'churn'].every(
      (key) => Boolean(verifiedMetricMap[key]),
    );
    const ltvToCacRatio = verifiedCac === 0 ? 0 : verifiedLtv / verifiedCac;

    const anomalyScan = await this.dataQualityService.scanAndStoreAnomalies(input.organizationId, 30);
    const confidence = await this.confidenceScoringService.score({
      organizationId: input.organizationId,
      dataPoints: verifiedDataPoints,
      revenueGrowthRate: verifiedRevenueGrowthRate,
      churnRate: verifiedChurn,
      ltvToCacRatio,
    });

    const integrationsHealthy = confidence.components.freshness >= 0.5;
    const guardrailDecision = this.recommendationsService.evaluateGuardrails({
      dataPoints: verifiedDataPoints,
      confidenceScore: confidence.score,
      integrationsHealthy,
    });

    const alerts: string[] = [];
    if (verifiedChurn > 0.05) {
      alerts.push(`Churn is elevated at ${(verifiedChurn * 100).toFixed(2)}%`);
    }
    if (ltvToCacRatio < 3 && verifiedCac > 0) {
      alerts.push(`LTV:CAC ratio is below healthy range at ${ltvToCacRatio.toFixed(2)}`);
    }
    if (verifiedRevenueGrowthRate < 0) {
      alerts.push(
        `Revenue declined by ${Math.abs(verifiedRevenueGrowthRate * 100).toFixed(2)}% in selected period`,
      );
    }

    const topRecommendation =
      alerts[0] ??
      (conversion.leadToCustomerRate < 0.2
        ? 'Lead-to-customer conversion is low. Prioritize checkout and sales handoff improvements.'
        : 'Core growth indicators are stable. Continue scaling top-performing channels.');

    const evidenceCards = [
      {
        id: 'cac-vs-ltv',
        title: 'Customer Economics',
        description: `CAC is ${formatNaira(verifiedCac)} while LTV is ${formatNaira(verifiedLtv)} (ratio ${ltvToCacRatio.toFixed(2)}x).`,
        impact: ltvToCacRatio < 2 ? 'high' : ltvToCacRatio < 3 ? 'medium' : 'low',
        confidenceScore: Math.round(confidence.score * 100),
        evidence: [
          {
            label: 'CAC',
            value: formatNaira(verifiedCac),
          },
          {
            label: 'LTV',
            value: formatNaira(verifiedLtv),
          },
          {
            label: 'LTV:CAC ratio',
            value: `${ltvToCacRatio.toFixed(2)}x`,
          },
        ],
      },
      {
        id: 'revenue-growth',
        title: 'Revenue Trend',
        description: `Revenue growth is ${(verifiedRevenueGrowthRate * 100).toFixed(2)}% with total revenue ${formatNaira(verifiedRevenue)} in this window.`,
        impact: verifiedRevenueGrowthRate < 0 ? 'high' : verifiedRevenueGrowthRate < 0.05 ? 'medium' : 'low',
        confidenceScore: Math.round(confidence.score * 100),
        evidence: [
          {
            label: 'Revenue',
            value: formatNaira(verifiedRevenue),
          },
          {
            label: 'Growth rate',
            value: `${(verifiedRevenueGrowthRate * 100).toFixed(2)}%`,
          },
          {
            label: 'Anomalies detected',
            value: `${anomalyScan.anomalies.length}`,
          },
        ],
      },
      {
        id: 'churn-risk',
        title: 'Retention Risk',
        description: `Overall churn is ${(verifiedChurn * 100).toFixed(2)}% with ${conversion.counts.totalCustomersInRange} customers in range.`,
        impact: verifiedChurn > 0.05 ? 'high' : verifiedChurn > 0.03 ? 'medium' : 'low',
        confidenceScore: Math.round(confidence.score * 100),
        evidence: [
          {
            label: 'Churn rate',
            value: `${(verifiedChurn * 100).toFixed(2)}%`,
          },
          {
            label: 'Active customers',
            value: `${conversion.counts.totalCustomersInRange}`,
          },
          {
            label: 'Freshness score',
            value: `${Math.round(confidence.components.freshness * 100)}%`,
          },
        ],
      },
    ] as const;

    const suppression =
      hasAllRequiredSnapshots
        ? guardrailDecision.allowed
        ? null
        : {
            reason: guardrailDecision.reason,
            message:
              guardrailDecision.reason === 'insufficient_data_points'
                ? 'Insufficient data volume. Recommendation generation is suppressed until more verified events are available.'
                : guardrailDecision.reason === 'low_confidence'
                  ? 'Confidence score is below threshold. Recommendation generation is suppressed.'
                  : 'Integration freshness/health is below threshold. Recommendation generation is suppressed.',
          }
        : {
            reason: 'insufficient_data_points' as const,
            message:
              'Verified metric snapshots are incomplete for this window. Recommendation generation is suppressed until all required verified metrics are available.',
          };

      const traceId = [
        input.organizationId,
        range.startDate,
        range.endDate,
        topRecommendation,
        suppression?.reason ?? 'none',
      ].join(':');

      await this.recommendationsService.persistAuditableRecommendation({
        organizationId: input.organizationId,
        insight: alerts[0] ?? 'Executive summary generated from verified metrics',
        recommendation: suppression ? suppression.message : topRecommendation,
        impactLevel:
          suppression?.reason === 'low_confidence' || suppression?.reason === 'integration_health_degraded'
            ? ImpactLevel.HIGH
            : alerts.length > 0
              ? ImpactLevel.HIGH
              : ImpactLevel.MEDIUM,
        confidenceScore: confidence.score,
        dataPoints: verifiedDataPoints,
        dataWindow: range,
        evidence: {
          evidenceCards,
          alerts,
          confidence,
        },
        explanation: {
          what: evidenceCards[0]?.description ?? 'Executive KPI summary computed for selected window',
          why:
            alerts[0] ??
            `Growth ${(verifiedRevenueGrowthRate * 100).toFixed(2)}%, churn ${(verifiedChurn * 100).toFixed(2)}%, LTV:CAC ${ltvToCacRatio.toFixed(2)}x`,
          action: suppression ? suppression.message : topRecommendation,
        },
        suppressionReason: suppression?.reason,
        traceId,
      });

    return {
      organizationId: input.organizationId,
      range,
      kpis: {
        revenue: verifiedRevenue,
        revenueGrowthRate: verifiedRevenueGrowthRate,
        cac: verifiedCac,
        ltv: verifiedLtv,
        ltvToCacRatio,
        churnRate: verifiedChurn,
        activeCustomers: verifiedDataPoints,
        pipelineValue: pipeline.totalValue,
      },
      marketingPerformance: {
        byChannel: cac.byChannel.slice(0, 5),
      },
      topRecommendation: suppression ? suppression.message : topRecommendation,
      alerts,
      confidence,
      suppression,
      evidenceCards,
      verifiedMetrics,
    };
  }

  async getVerifiedMetrics(
    input: AnalyticsQueryInput & {
      windowType?: VerifiedMetricWindow;
    },
  ) {
    this.assertOrganizationId(input.organizationId);

    const { startDate, endDate } = this.resolveDates(input);
    return this.verifiedMetricsService.listSnapshots({
      organizationId: input.organizationId,
      windowType: input.windowType,
      startDate,
      endDate,
    });
  }

  async getCAC(input: CACQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);

    const metrics = await this.prisma.marketingMetric.findMany({
      where: {
        organizationId: input.organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        campaign: {
          ...(input.campaign ? { name: input.campaign } : {}),
          channel: {
            ...(input.channel ? { name: input.channel } : {}),
          },
        },
      },
      include: {
        campaign: {
          include: {
            channel: true,
          },
        },
      },
    });

    const newCustomers = await this.prisma.customer.count({
      where: {
        organizationId: input.organizationId,
        firstSeen: {
          gte: startDate,
          lte: endDate,
        },
        ...(input.channel ? { acquisitionChannel: input.channel } : {}),
      },
    });

    const totalSpend = metrics.reduce((sum, metric) => sum + Number(metric.cost), 0);
    const overallCAC = calculateCAC({
      totalMarketingSpend: totalSpend,
      newCustomers,
    });

    const channelAgg = new Map<string, { spend: number; newCustomers: number }>();
    const campaignAgg = new Map<string, { spend: number; newCustomers: number }>();

    for (const metric of metrics) {
      const channelName = metric.campaign.channel.name;
      const campaignName = metric.campaign.name;

      const channelCurrent = channelAgg.get(channelName) ?? { spend: 0, newCustomers: 0 };
      channelAgg.set(channelName, {
        spend: channelCurrent.spend + Number(metric.cost),
        newCustomers: channelCurrent.newCustomers + metric.conversions,
      });

      const campaignCurrent = campaignAgg.get(campaignName) ?? { spend: 0, newCustomers: 0 };
      campaignAgg.set(campaignName, {
        spend: campaignCurrent.spend + Number(metric.cost),
        newCustomers: campaignCurrent.newCustomers + metric.conversions,
      });
    }

    return {
      totalSpend,
      newCustomers,
      sourceRecordCount: metrics.length,
      cac: overallCAC,
      byChannel: calculateCACBySegments(
        Array.from(channelAgg.entries()).map(([key, value]) => ({
          key,
          spend: value.spend,
          newCustomers: value.newCustomers,
        })),
      ),
      byCampaign: calculateCACBySegments(
        Array.from(campaignAgg.entries()).map(([key, value]) => ({
          key,
          spend: value.spend,
          newCustomers: value.newCustomers,
        })),
      ),
      range: this.buildDateRange(input),
    };
  }

  async getLTV(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);

    const [revenueEvents, subscriptions] = await Promise.all([
      this.prisma.revenueEvent.findMany({
        where: {
          organizationId: input.organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.subscription.findMany({
        where: {
          organizationId: input.organizationId,
        },
      }),
    ]);

    const totalRevenue = revenueEvents.reduce((sum, event) => sum + Number(event.amount), 0);
    const customersWithRevenue = new Set(
      revenueEvents
        .map((event) => event.customerId)
        .filter((value): value is string => Boolean(value)),
    );

    const averageRevenuePerCustomer = calculateAverageRevenuePerCustomer(
      totalRevenue,
      customersWithRevenue.size,
    );

    const now = new Date();
    const lifetimeMonths = subscriptions.map((subscription) => {
      const start = subscription.startDate;
      const end = subscription.endDate ?? now;
      const months = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return Math.max(0, months);
    });

    const averageCustomerLifetimeMonths = calculateAverageCustomerLifetimeMonths(lifetimeMonths);
    const ltv = calculateLTV({
      averageRevenuePerCustomer,
      averageCustomerLifetimeMonths,
    });

    return {
      ltv,
      averageRevenuePerCustomer,
      averageCustomerLifetimeMonths,
      subscriptionCount: subscriptions.length,
      customersWithRevenueCount: customersWithRevenue.size,
      range: this.buildDateRange(input),
    };
  }

  async getChurn(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);

    const monthlySeries = this.monthSeries(startDate, endDate);
    const churnByMonth = await Promise.all(
      monthlySeries.map(async (month) => {
        const [customersAtStart, customersLostFromSubscriptions] = await Promise.all([
          this.prisma.customer.count({
            where: {
              organizationId: input.organizationId,
              firstSeen: {
                lt: month.start,
              },
            },
          }),
          this.prisma.subscription.count({
            where: {
              organizationId: input.organizationId,
              endDate: {
                gte: month.start,
                lte: month.end,
              },
              status: SubscriptionStatus.CANCELED,
            },
          }),
        ]);

        const customersLost = Math.min(customersAtStart, customersLostFromSubscriptions);

        return {
          month: month.key,
          customersAtStart,
          customersLost,
          churnRate: calculateChurnRate({
            customersAtStart,
            customersLost,
          }),
        };
      }),
    );

    const totalStart = churnByMonth.reduce((sum, item) => sum + item.customersAtStart, 0);
    const totalLost = churnByMonth.reduce((sum, item) => sum + item.customersLost, 0);

    return {
      overallRate: calculateChurnRate({
        customersAtStart: totalStart,
        customersLost: totalLost,
      }),
      totalCustomersAtStart: totalStart,
      totalCustomersLost: totalLost,
      byMonth: churnByMonth,
      range: this.buildDateRange(input),
    };
  }

  async getRevenue(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);
    const totalDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const previousStart = new Date(startDate);
    previousStart.setUTCDate(previousStart.getUTCDate() - totalDays);
    const previousEnd = new Date(endDate);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - totalDays);

    const [currentEvents, previousEvents] = await Promise.all([
      this.prisma.revenueEvent.findMany({
        where: {
          organizationId: input.organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.revenueEvent.findMany({
        where: {
          organizationId: input.organizationId,
          timestamp: {
            gte: previousStart,
            lte: previousEnd,
          },
        },
      }),
    ]);

    const recurringTypes = new Set<RevenueEventType>([
      RevenueEventType.SUBSCRIPTION_STARTED,
      RevenueEventType.SUBSCRIPTION_RENEWED,
      RevenueEventType.UPGRADE,
      RevenueEventType.DOWNGRADE,
    ]);

    const totalRevenue = currentEvents.reduce((sum, event) => sum + Number(event.amount), 0);
    const currentRecurring = currentEvents
      .filter((event) => recurringTypes.has(event.eventType))
      .reduce((sum, event) => sum + Number(event.amount), 0);

    const previousRevenue = previousEvents.reduce((sum, event) => sum + Number(event.amount), 0);
    const growthRate = calculateRevenueGrowthRate(totalRevenue, previousRevenue);
    const arr = calculateARR(currentRecurring);

    const history = this.groupRevenueByMonth(currentEvents);
    const forecast = forecastRevenue(history, 6);

    return {
      totalRevenue,
      mrr: currentRecurring,
      arr,
      growthRate,
      eventCount: currentEvents.length,
      forecast,
      formatted: {
        totalRevenue: formatNaira(totalRevenue),
        mrr: formatNaira(currentRecurring),
        arr: formatNaira(arr),
      },
      range: this.buildDateRange(input),
    };
  }

  async getConversion(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);

    const [events, deals, customers, firstPurchases] = await Promise.all([
      this.prisma.customerEvent.findMany({
        where: {
          organizationId: input.organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.deal.findMany({
        where: {
          organizationId: input.organizationId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.customer.count({
        where: {
          organizationId: input.organizationId,
          firstSeen: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.customerEvent.groupBy({
        by: ['customerId'],
        where: {
          organizationId: input.organizationId,
          eventType: CustomerEventType.PURCHASE,
          timestamp: {
            lte: endDate,
          },
        },
        _min: {
          timestamp: true,
        },
      }),
    ]);

    const visitors = events.filter((event) => event.eventType === CustomerEventType.PAGE_VIEW).length;
    const leadFromEvents = events.filter((event) => event.eventType === CustomerEventType.SIGNUP).length;
    const leadFromPipeline = deals.filter((deal) => deal.stage === DealStageType.LEAD).length;
    const leads = Math.max(leadFromEvents, leadFromPipeline);

    const customersFromEvents = new Set(
      events
        .filter((event) => event.eventType === CustomerEventType.PURCHASE)
        .map((event) => event.customerId)
        .filter((value): value is string => Boolean(value)),
    ).size;

    const activatedCustomers = firstPurchases.filter((row) => {
      if (!row.customerId) {
        return false;
      }

      const firstPurchaseAt = row._min?.timestamp;
      return Boolean(firstPurchaseAt && firstPurchaseAt >= startDate && firstPurchaseAt <= endDate);
    }).length;

    return {
      ...calculateConversionMetrics({
        visitors,
        leads,
        customers: customersFromEvents,
        activatedCustomers,
      }),
      counts: {
        visitors,
        leads,
        customers: customersFromEvents,
        activatedCustomers,
        totalCustomersInRange: customers,
      },
      range: this.buildDateRange(input),
    };
  }

  async getPipeline(input: AnalyticsQueryInput) {
    this.assertOrganizationId(input.organizationId);
    const { startDate, endDate } = this.resolveDates(input);
    const deals = await this.prisma.deal.findMany({
      where: {
        organizationId: input.organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const dealCount = deals.length;
    const wonDeals = deals.filter((deal) => deal.stage === DealStageType.WON).length;
    const totalValue = deals.reduce((sum, deal) => sum + Number(deal.value), 0);

    const cycleDays = deals
      .filter((deal) => deal.closeDate)
      .map((deal) => {
        const closeDate = deal.closeDate as Date;
        return Math.max(1, (closeDate.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      });

    const averageDealValue = dealCount === 0 ? 0 : totalValue / dealCount;
    const winRate = dealCount === 0 ? 0 : wonDeals / dealCount;
    const salesCycleLengthDays =
      cycleDays.length === 0
        ? 1
        : cycleDays.reduce((sum, day) => sum + day, 0) / cycleDays.length;

    return {
      dealCount,
      totalValue,
      averageDealValue,
      winRate,
      salesCycleLengthDays,
      velocity: calculatePipelineVelocity({
        dealCount,
        averageDealValue,
        winRate,
        salesCycleLengthDays,
      }),
      range: this.buildDateRange(input),
    };
  }

  async getCACRaw(input: AnalyticsQueryInput): Promise<number> {
    const cac = await this.getCAC(input);
    return cac.cac;
  }

  async getLTVRaw(input: AnalyticsQueryInput): Promise<number> {
    const ltv = await this.getLTV(input);
    return ltv.ltv;
  }

  async getChurnRaw(input: AnalyticsQueryInput): Promise<{ overallRate: number }> {
    return this.getChurn(input);
  }

  async getRevenueRaw(input: AnalyticsQueryInput): Promise<{ totalRevenue: number }> {
    return this.getRevenue(input);
  }

  private resolveDates(input: AnalyticsQueryInput): { startDate: Date; endDate: Date } {
    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    const startDate = input.startDate
      ? new Date(input.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    startDate.setUTCHours(0, 0, 0, 0);
    endDate.setUTCHours(23, 59, 59, 999);

    return { startDate, endDate };
  }

  private buildDateRange(input: AnalyticsQueryInput): { startDate: string; endDate: string } {
    const { startDate, endDate } = this.resolveDates(input);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  private monthSeries(startDate: Date, endDate: Date): Array<{ key: string; start: Date; end: Date }> {
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const endCursor = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

    const months: Array<{ key: string; start: Date; end: Date }> = [];

    while (cursor <= endCursor) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      months.push({
        key: monthStart.toISOString().slice(0, 7),
        start: monthStart,
        end: monthEnd,
      });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return months;
  }

  private groupRevenueByMonth(events: Array<{ amount: Prisma.Decimal | number; timestamp: Date }>): ForecastPoint[] {
    const grouped = new Map<string, number>();

    for (const event of events) {
      const key = event.timestamp.toISOString().slice(0, 7);
      const current = grouped.get(key) ?? 0;
      grouped.set(key, current + Number(event.amount));
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, value]) => ({ period, value }));
  }

  private assertOrganizationId(organizationId?: string): void {
    if (!organizationId || organizationId.trim().length === 0) {
      throw new BadRequestException('organizationId query parameter is required');
    }
  }

  private async upsertVerifiedMetrics(input: {
    organizationId: string;
    windowType: VerifiedMetricWindow;
    range: { startDate: string; endDate: string };
    cac: Awaited<ReturnType<AnalyticsService['getCAC']>>;
    ltv: Awaited<ReturnType<AnalyticsService['getLTV']>>;
    churn: Awaited<ReturnType<AnalyticsService['getChurn']>>;
    revenue: Awaited<ReturnType<AnalyticsService['getRevenue']>>;
  }) {
    const [anomalyPenalty, dataQualitySummary] = await Promise.all([
      this.dataQualityService.getAnomalyPenalty(input.organizationId, 7),
      this.dataQualityService.getSummary(input.organizationId),
    ]);

    const baseFlags = [
      ...(anomalyPenalty.count > 0 ? ['recent_anomalies'] : []),
      ...(dataQualitySummary.totals.validationEvents > 0 ? ['validation_events_present'] : []),
    ];
    const windowStart = new Date(input.range.startDate);
    const windowEnd = new Date(input.range.endDate);

    return this.verifiedMetricsService.upsertSnapshots([
      {
        organizationId: input.organizationId,
        metricKey: 'cac',
        windowType: input.windowType,
        windowStart,
        windowEnd,
        metricValue: input.cac.cac,
        formulaVersion: 'analytics/cac/v1',
        sourceTables: ['marketing_metrics', 'customers'],
        sampleSize: Math.max(input.cac.newCustomers, input.cac.sourceRecordCount),
        dataQualityFlags: this.buildQualityFlags(
          Math.max(input.cac.newCustomers, input.cac.sourceRecordCount),
          baseFlags,
        ),
        inputs: {
          totalSpend: input.cac.totalSpend,
          newCustomers: input.cac.newCustomers,
          sourceRecordCount: input.cac.sourceRecordCount,
        },
      },
      {
        organizationId: input.organizationId,
        metricKey: 'ltv',
        windowType: input.windowType,
        windowStart,
        windowEnd,
        metricValue: input.ltv.ltv,
        formulaVersion: 'analytics/ltv/v1',
        sourceTables: ['revenue_events', 'subscriptions'],
        sampleSize: Math.max(input.ltv.subscriptionCount, input.ltv.customersWithRevenueCount),
        dataQualityFlags: this.buildQualityFlags(
          Math.max(input.ltv.subscriptionCount, input.ltv.customersWithRevenueCount),
          baseFlags,
        ),
        inputs: {
          averageRevenuePerCustomer: input.ltv.averageRevenuePerCustomer,
          averageCustomerLifetimeMonths: input.ltv.averageCustomerLifetimeMonths,
          subscriptionCount: input.ltv.subscriptionCount,
          customersWithRevenueCount: input.ltv.customersWithRevenueCount,
        },
      },
      {
        organizationId: input.organizationId,
        metricKey: 'revenue',
        windowType: input.windowType,
        windowStart,
        windowEnd,
        metricValue: input.revenue.totalRevenue,
        formulaVersion: 'analytics/revenue/v1',
        sourceTables: ['revenue_events'],
        sampleSize: input.revenue.eventCount,
        dataQualityFlags: this.buildQualityFlags(input.revenue.eventCount, baseFlags),
        inputs: {
          eventCount: input.revenue.eventCount,
          mrr: input.revenue.mrr,
          arr: input.revenue.arr,
          growthRate: input.revenue.growthRate,
        },
      },
      {
        organizationId: input.organizationId,
        metricKey: 'churn',
        windowType: input.windowType,
        windowStart,
        windowEnd,
        metricValue: input.churn.overallRate,
        formulaVersion: 'analytics/churn/v1',
        sourceTables: ['customers', 'subscriptions'],
        sampleSize: input.churn.totalCustomersAtStart,
        dataQualityFlags: this.buildQualityFlags(input.churn.totalCustomersAtStart, baseFlags),
        inputs: {
          totalCustomersAtStart: input.churn.totalCustomersAtStart,
          totalCustomersLost: input.churn.totalCustomersLost,
        },
      },
    ]);
  }

  private buildQualityFlags(sampleSize: number, baseFlags: string[]) {
    return [
      ...baseFlags,
      ...(sampleSize === 0 ? ['no_supporting_records'] : []),
      ...(sampleSize > 0 && sampleSize < 5 ? ['low_sample_size'] : []),
    ];
  }

  private toVerifiedMetricMap(
    snapshots: Array<{
      metricKey: string;
      metricValue: number;
      formulaVersion?: string;
      sampleSize?: number;
      dataQualityFlags?: unknown;
      sourceTables?: unknown;
      inputs?: unknown;
    }>,
  ) {
    return snapshots.reduce<
      Record<
        string,
        {
          metricValue: number;
          formulaVersion?: string;
          sampleSize?: number;
          dataQualityFlags?: string[];
          sourceTables?: string[];
          inputs?: Record<string, unknown> | null;
        }
      >
    >((accumulator, snapshot) => {
      accumulator[snapshot.metricKey] = {
        metricValue: snapshot.metricValue,
        formulaVersion: snapshot.formulaVersion,
        sampleSize: snapshot.sampleSize,
        dataQualityFlags: this.readStringArray(snapshot.dataQualityFlags),
        sourceTables: this.readStringArray(snapshot.sourceTables),
        inputs: this.readInputObject(snapshot.inputs),
      };
      return accumulator;
    }, {});
  }

  private readNumericInput(
    inputs: Record<string, unknown> | null | undefined,
    key: string,
    fallback: number,
  ) {
    if (!inputs) {
      return fallback;
    }

    const value = inputs[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item : null))
      .filter((item): item is string => Boolean(item));
  }

  private readInputObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}

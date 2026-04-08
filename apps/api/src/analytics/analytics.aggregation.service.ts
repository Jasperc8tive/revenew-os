import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, VerifiedMetricWindow } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from './analytics.service';
import { VerifiedMetricsService } from './verified-metrics.service';

@Injectable()
export class AnalyticsAggregationService {
  private readonly logger = new Logger(AnalyticsAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly verifiedMetricsService: VerifiedMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async aggregateDailyMetrics(): Promise<void> {
    await this.aggregateForPeriod('daily');
  }

  @Cron(CronExpression.EVERY_WEEK)
  async aggregateWeeklyMetrics(): Promise<void> {
    await this.aggregateForPeriod('weekly');
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async aggregateMonthlyMetrics(): Promise<void> {
    await this.aggregateForPeriod('monthly');
  }

  async aggregateForPeriod(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
    });

    const now = new Date();
    const { startDate, endDate } = this.getPeriodRange(period, now);

    await Promise.all(
      organizations.map(async (organization) => {
        const [cac, ltv, churn, revenue] = await Promise.all([
          this.analyticsService.getCACRaw({
            organizationId: organization.id,
            startDate,
            endDate,
          }),
          this.analyticsService.getLTVRaw({
            organizationId: organization.id,
            startDate,
            endDate,
          }),
          this.analyticsService.getChurnRaw({
            organizationId: organization.id,
            startDate,
            endDate,
          }),
          this.analyticsService.getRevenueRaw({
            organizationId: organization.id,
            startDate,
            endDate,
          }),
        ]);

        const windowTypeByPeriod: Record<'daily' | 'weekly' | 'monthly', VerifiedMetricWindow> = {
          daily: VerifiedMetricWindow.DAILY,
          weekly: VerifiedMetricWindow.WEEKLY,
          monthly: VerifiedMetricWindow.MONTHLY,
        };

        await this.verifiedMetricsService.upsertSnapshots([
          {
            organizationId: organization.id,
            metricKey: 'cac',
            windowType: windowTypeByPeriod[period],
            windowStart: startDate,
            windowEnd: endDate,
            metricValue: cac,
            formulaVersion: 'analytics/cac/v1',
            sourceTables: ['marketing_metrics', 'customers'],
            sampleSize: 0,
            dataQualityFlags: ['aggregated_period_snapshot'],
          },
          {
            organizationId: organization.id,
            metricKey: 'ltv',
            windowType: windowTypeByPeriod[period],
            windowStart: startDate,
            windowEnd: endDate,
            metricValue: ltv,
            formulaVersion: 'analytics/ltv/v1',
            sourceTables: ['revenue_events', 'subscriptions'],
            sampleSize: 0,
            dataQualityFlags: ['aggregated_period_snapshot'],
          },
          {
            organizationId: organization.id,
            metricKey: 'revenue',
            windowType: windowTypeByPeriod[period],
            windowStart: startDate,
            windowEnd: endDate,
            metricValue: revenue.totalRevenue,
            formulaVersion: 'analytics/revenue/v1',
            sourceTables: ['revenue_events'],
            sampleSize: 0,
            dataQualityFlags: ['aggregated_period_snapshot'],
          },
          {
            organizationId: organization.id,
            metricKey: 'churn',
            windowType: windowTypeByPeriod[period],
            windowStart: startDate,
            windowEnd: endDate,
            metricValue: churn.overallRate,
            formulaVersion: 'analytics/churn/v1',
            sourceTables: ['customers', 'subscriptions'],
            sampleSize: 0,
            dataQualityFlags: ['aggregated_period_snapshot'],
          },
        ]);

        if (period === 'daily') {
          await this.prisma.dailyMetrics.upsert({
            where: {
              organizationId_date: {
                organizationId: organization.id,
                date: startDate,
              },
            },
            create: {
              organizationId: organization.id,
              date: startDate,
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
            update: {
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
          });
        }

        if (period === 'weekly') {
          await this.prisma.weeklyMetrics.upsert({
            where: {
              organizationId_weekStart: {
                organizationId: organization.id,
                weekStart: startDate,
              },
            },
            create: {
              organizationId: organization.id,
              weekStart: startDate,
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
            update: {
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
          });
        }

        if (period === 'monthly') {
          await this.prisma.monthlyMetrics.upsert({
            where: {
              organizationId_monthStart: {
                organizationId: organization.id,
                monthStart: startDate,
              },
            },
            create: {
              organizationId: organization.id,
              monthStart: startDate,
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
            update: {
              cac: new Prisma.Decimal(cac),
              ltv: new Prisma.Decimal(ltv),
              revenue: new Prisma.Decimal(revenue.totalRevenue),
              churn: new Prisma.Decimal(churn.overallRate),
            },
          });
        }
      }),
    );

    this.logger.log(`Analytics ${period} aggregation completed for ${organizations.length} orgs.`);
  }

  private getPeriodRange(period: 'daily' | 'weekly' | 'monthly', reference: Date) {
    const endDate = new Date(reference);
    const startDate = new Date(reference);

    if (period === 'daily') {
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
      return { startDate, endDate };
    }

    if (period === 'weekly') {
      const weekday = startDate.getUTCDay();
      const delta = weekday === 0 ? 6 : weekday - 1;
      startDate.setUTCDate(startDate.getUTCDate() - delta);
      startDate.setUTCHours(0, 0, 0, 0);

      endDate.setTime(startDate.getTime());
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      endDate.setUTCHours(23, 59, 59, 999);
      return { startDate, endDate };
    }

    startDate.setUTCDate(1);
    startDate.setUTCHours(0, 0, 0, 0);

    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    endDate.setUTCDate(0);
    endDate.setUTCHours(23, 59, 59, 999);

    return { startDate, endDate };
  }
}

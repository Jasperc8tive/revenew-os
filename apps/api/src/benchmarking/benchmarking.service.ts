import { AlertMetric, Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenchmarkQueryDto } from './dto/benchmark-query.dto';

@Injectable()
export class BenchmarkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async getBenchmarks(input: BenchmarkQueryDto) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.full');

    const endDate = input.endDate ?? new Date();
    const startDate = input.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, industry: true, name: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const metrics = input.metric ? [input.metric] : Object.values(AlertMetric);
    const benchmarkRows = await this.prisma.industryBenchmark.findMany({
      where: {
        industry: organization.industry,
        metric: { in: metrics },
        periodStart: { lte: startDate },
        periodEnd: { gte: endDate },
      },
      orderBy: [{ periodEnd: 'desc' }],
    });

    const rowsByMetric = new Map<AlertMetric, (typeof benchmarkRows)[number]>();
    for (const row of benchmarkRows) {
      if (!rowsByMetric.has(row.metric)) {
        rowsByMetric.set(row.metric, row);
      }
    }

    const orgMetrics = await this.prisma.dailyMetrics.findMany({
      where: {
        organizationId: input.organizationId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    const aggregates = {
      CAC: this.average(orgMetrics.map((row) => Number(row.cac))),
      LTV: this.average(orgMetrics.map((row) => Number(row.ltv))),
      CHURN: this.average(orgMetrics.map((row) => Number(row.churn))),
      REVENUE: this.average(orgMetrics.map((row) => Number(row.revenue))),
    };

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      industry: organization.industry,
      range: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      metrics: metrics.map((metric) => {
        const benchmark = rowsByMetric.get(metric);
        const organizationValue = aggregates[metric];
        const industryMedian = benchmark ? Number(benchmark.median) : 0;
        const delta = organizationValue - industryMedian;

        return {
          metric,
          organizationValue,
          industryMedian,
          p25: benchmark ? Number(benchmark.p25) : 0,
          p75: benchmark ? Number(benchmark.p75) : 0,
          sampleCount: benchmark?.sampleCount ?? 0,
          delta,
          deltaPct: industryMedian === 0 ? 0 : (delta / industryMedian) * 100,
        };
      }),
    };
  }

  async getDeepBenchmarks(input: BenchmarkQueryDto) {
    const baseline = await this.getBenchmarks(input);

    const customers = await this.prisma.customer.findMany({
      where: {
        organizationId: input.organizationId,
      },
      select: {
        acquisitionChannel: true,
        firstSeen: true,
      },
    });

    const totalCustomers = customers.length || 1;
    const byAcquisitionChannel = new Map<string, number>();
    const byAgeBand = new Map<string, number>();

    customers.forEach((customer) => {
      const channel = (customer.acquisitionChannel ?? 'unknown').toLowerCase();
      byAcquisitionChannel.set(channel, (byAcquisitionChannel.get(channel) ?? 0) + 1);

      const ageDays = Math.floor((Date.now() - customer.firstSeen.getTime()) / (24 * 60 * 60 * 1000));
      const ageBand = ageDays <= 30 ? '0-30d' : ageDays <= 90 ? '31-90d' : '90d+';
      byAgeBand.set(ageBand, (byAgeBand.get(ageBand) ?? 0) + 1);
    });

    const rankedMetrics = baseline.metrics
      .map((metric) => {
        const percentileContext = metric.organizationValue <= metric.p25
          ? 'bottom_quartile'
          : metric.organizationValue >= metric.p75
            ? 'top_quartile'
            : 'mid_band';

        const confidence = metric.sampleCount >= 150 ? 0.9 : metric.sampleCount >= 50 ? 0.75 : 0.55;
        const actionability = Math.min(Math.abs(metric.deltaPct) / 100, 1);
        const rankScore = Number((confidence * 0.6 + actionability * 0.4).toFixed(4));

        return {
          ...metric,
          percentileContext,
          confidence,
          rankScore,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore);

    return {
      ...baseline,
      cohorts: {
        acquisitionChannels: Array.from(byAcquisitionChannel.entries())
          .map(([key, count]) => ({
            key,
            count,
            share: Number((count / totalCustomers).toFixed(4)),
          }))
          .sort((a, b) => b.count - a.count),
        customerAgeBands: Array.from(byAgeBand.entries())
          .map(([key, count]) => ({
            key,
            count,
            share: Number((count / totalCustomers).toFixed(4)),
          }))
          .sort((a, b) => b.count - a.count),
      },
      rankedMetrics,
      contextQuality: {
        customerCoverage: totalCustomers,
        metricCoverage: rankedMetrics.length,
        confidenceAverage:
          rankedMetrics.length > 0
            ? Number(
                (
                  rankedMetrics.reduce((sum, metric) => sum + metric.confidence, 0) /
                  rankedMetrics.length
                ).toFixed(4),
              )
            : 0,
      },
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    return Number(new Prisma.Decimal(sum).div(values.length).toFixed(4));
  }
}

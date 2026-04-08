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

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    return Number(new Prisma.Decimal(sum).div(values.length).toFixed(4));
  }
}

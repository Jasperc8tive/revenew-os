import { AlertMetric, Industry, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface AggregateInput {
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class BenchmarkAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  async aggregate(input: AggregateInput = {}) {
    const endDate = input.endDate ?? new Date();
    const startDate = input.startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.dailyMetrics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            industry: true,
          },
        },
      },
    });

    const groupedByIndustry = new Map<Industry, Array<typeof rows[number]>>();

    for (const row of rows) {
      const entries = groupedByIndustry.get(row.organization.industry) ?? [];
      entries.push(row);
      groupedByIndustry.set(row.organization.industry, entries);
    }

    const persisted = [] as string[];

    for (const [industry, industryRows] of groupedByIndustry.entries()) {
      const metricsToValues: Record<AlertMetric, number[]> = {
        CAC: industryRows.map((row) => Number(row.cac)),
        LTV: industryRows.map((row) => Number(row.ltv)),
        CHURN: industryRows.map((row) => Number(row.churn)),
        REVENUE: industryRows.map((row) => Number(row.revenue)),
      };

      for (const metric of Object.values(AlertMetric)) {
        const values = metricsToValues[metric].filter((value) => Number.isFinite(value));

        if (values.length === 0) {
          continue;
        }

        const sorted = values.slice().sort((a, b) => a - b);
        const p25 = this.percentile(sorted, 25);
        const median = this.percentile(sorted, 50);
        const p75 = this.percentile(sorted, 75);

        const upserted = await this.prisma.industryBenchmark.upsert({
          where: {
            industry_metric_periodStart_periodEnd: {
              industry,
              metric,
              periodStart: startDate,
              periodEnd: endDate,
            },
          },
          update: {
            p25,
            median,
            p75,
            sampleCount: sorted.length,
          },
          create: {
            industry,
            metric,
            periodStart: startDate,
            periodEnd: endDate,
            p25,
            median,
            p75,
            sampleCount: sorted.length,
          },
        });

        persisted.push(upserted.id);
      }
    }

    return {
      startDate,
      endDate,
      rowCount: rows.length,
      benchmarkCount: persisted.length,
    };
  }

  private percentile(sortedValues: number[], percentile: number): Prisma.Decimal {
    if (sortedValues.length === 1) {
      return new Prisma.Decimal(sortedValues[0]);
    }

    const position = ((percentile / 100) * (sortedValues.length - 1));
    const base = Math.floor(position);
    const rest = position - base;
    const value = sortedValues[base] + rest * ((sortedValues[base + 1] ?? sortedValues[base]) - sortedValues[base]);
    return new Prisma.Decimal(value);
  }
}

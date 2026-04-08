import {
  DataQualityEventType,
  DataQualitySeverity,
  DataQualitySource,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ListDataQualityEventsDto } from './dto/list-data-quality-events.dto';

export interface MetricAnomalyCandidate {
  metric: 'revenue' | 'cac' | 'ltv' | 'churn';
  latest: number;
  baseline: number;
  deviationPct: number;
  zScore: number;
}

@Injectable()
export class DataQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async logValidationIssue(input: {
    organizationId: string;
    integrationId: string;
    rejectedCount: number;
    totalCount: number;
    issues: Array<{ index: number; recordType: string; reason: string }>;
  }) {
    if (input.rejectedCount <= 0) {
      return null;
    }

    return this.prisma.dataQualityEvent.create({
      data: {
        organizationId: input.organizationId,
        integrationId: input.integrationId,
        eventType: DataQualityEventType.VALIDATION,
        severity:
          input.rejectedCount === input.totalCount
            ? DataQualitySeverity.HIGH
            : DataQualitySeverity.MEDIUM,
        source: DataQualitySource.INGESTION,
        code: 'INGESTION_VALIDATION_REJECTED',
        message: `Rejected ${input.rejectedCount}/${input.totalCount} records during sync validation`,
        details: {
          rejectedCount: input.rejectedCount,
          totalCount: input.totalCount,
          issues: input.issues,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async scanAndStoreAnomalies(organizationId: string, lookbackDays = 30) {
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - lookbackDays);

    const points = await this.prisma.dailyMetrics.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (points.length < 8) {
      return { created: 0, anomalies: [] as MetricAnomalyCandidate[] };
    }

    const latest = points[points.length - 1];
    const previous = points.slice(0, -1);

    const anomalies: MetricAnomalyCandidate[] = [];

    anomalies.push(...this.detectMetricAnomaly('revenue', Number(latest.revenue), previous.map((p) => Number(p.revenue))));
    anomalies.push(...this.detectMetricAnomaly('cac', Number(latest.cac), previous.map((p) => Number(p.cac))));
    anomalies.push(...this.detectMetricAnomaly('ltv', Number(latest.ltv), previous.map((p) => Number(p.ltv))));
    anomalies.push(...this.detectMetricAnomaly('churn', Number(latest.churn), previous.map((p) => Number(p.churn))));

    if (anomalies.length === 0) {
      return { created: 0, anomalies };
    }

    const createResults = await Promise.all(
      anomalies.map((anomaly) =>
        this.upsertAnomalyEvent(organizationId, anomaly, latest.date, lookbackDays),
      ),
    );

    return {
      created: createResults.length,
      anomalies,
    };
  }

  async listEvents(query: ListDataQualityEventsDto) {
    const parsedLimit = Number(query.limit);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(200, Math.trunc(parsedLimit))
        : 50;

    return this.prisma.dataQualityEvent.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.eventType ? { eventType: query.eventType } : {}),
        ...(query.severity ? { severity: query.severity } : {}),
      },
      include: {
        integration: {
          select: {
            id: true,
            provider: true,
            status: true,
          },
        },
      },
      orderBy: {
        occurredAt: 'desc',
      },
      take: limit,
    });
  }

  async getSummary(organizationId: string) {
    const [totalEvents, validationEvents, anomalyEvents, severityBreakdown, lastEvent] =
      await Promise.all([
        this.prisma.dataQualityEvent.count({ where: { organizationId } }),
        this.prisma.dataQualityEvent.count({
          where: { organizationId, eventType: DataQualityEventType.VALIDATION },
        }),
        this.prisma.dataQualityEvent.count({
          where: { organizationId, eventType: DataQualityEventType.ANOMALY },
        }),
        this.prisma.dataQualityEvent.groupBy({
          by: ['severity'],
          where: { organizationId },
          _count: {
            severity: true,
          },
        }),
        this.prisma.dataQualityEvent.findFirst({
          where: { organizationId },
          orderBy: { occurredAt: 'desc' },
        }),
      ]);

    return {
      organizationId,
      totals: {
        totalEvents,
        validationEvents,
        anomalyEvents,
      },
      severityBreakdown: severityBreakdown.map((entry) => ({
        severity: entry.severity,
        count: entry._count.severity,
      })),
      lastOccurredAt: lastEvent?.occurredAt ?? null,
    };
  }

  async getAnomalyPenalty(organizationId: string, windowDays = 7) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - windowDays);

    const anomalyCount = await this.prisma.dataQualityEvent.count({
      where: {
        organizationId,
        eventType: DataQualityEventType.ANOMALY,
        occurredAt: {
          gte: since,
        },
      },
    });

    const factor = Math.max(0.2, 1 - anomalyCount * 0.1);
    return {
      count: anomalyCount,
      factor,
    };
  }

  private detectMetricAnomaly(
    metric: MetricAnomalyCandidate['metric'],
    latest: number,
    historical: number[],
  ): MetricAnomalyCandidate[] {
    if (historical.length < 7) {
      return [];
    }

    const mean = historical.reduce((sum, value) => sum + value, 0) / historical.length;
    const variance =
      historical.reduce((sum, value) => sum + (value - mean) ** 2, 0) / historical.length;
    const stdDev = Math.sqrt(variance);

    if (!Number.isFinite(mean) || !Number.isFinite(stdDev) || mean === 0) {
      return [];
    }

    const zScore = stdDev === 0 ? 0 : (latest - mean) / stdDev;
    const deviationPct = (latest - mean) / Math.abs(mean);
    const isAnomaly = Math.abs(zScore) >= 2.5 || Math.abs(deviationPct) >= 0.45;

    if (!isAnomaly) {
      return [];
    }

    return [
      {
        metric,
        latest,
        baseline: mean,
        deviationPct,
        zScore,
      },
    ];
  }

  private async upsertAnomalyEvent(
    organizationId: string,
    anomaly: MetricAnomalyCandidate,
    observedDate: Date,
    lookbackDays: number,
  ) {
    const code = `ANOMALY_${anomaly.metric.toUpperCase()}`;
    const dedupeKey = `${anomaly.metric}:${observedDate.toISOString().slice(0, 10)}:${lookbackDays}`;

    return this.prisma.dataQualityEvent.upsert({
      where: {
        organizationId_code_dedupeKey: {
          organizationId,
          code,
          dedupeKey,
        },
      },
      update: {
        severity: Math.abs(anomaly.zScore) >= 3 ? DataQualitySeverity.HIGH : DataQualitySeverity.MEDIUM,
        message: `${anomaly.metric.toUpperCase()} anomaly detected (${(anomaly.deviationPct * 100).toFixed(1)}% from baseline)`,
        details: {
          metric: anomaly.metric,
          latest: anomaly.latest,
          baseline: anomaly.baseline,
          deviationPct: anomaly.deviationPct,
          zScore: anomaly.zScore,
          lookbackDays,
          observedDate: observedDate.toISOString(),
        } as Prisma.InputJsonValue,
        occurredAt: new Date(),
      },
      create: {
        organizationId,
        dedupeKey,
        eventType: DataQualityEventType.ANOMALY,
        severity: Math.abs(anomaly.zScore) >= 3 ? DataQualitySeverity.HIGH : DataQualitySeverity.MEDIUM,
        source: DataQualitySource.ANALYTICS,
        code,
        message: `${anomaly.metric.toUpperCase()} anomaly detected (${(anomaly.deviationPct * 100).toFixed(1)}% from baseline)`,
        details: {
          metric: anomaly.metric,
          latest: anomaly.latest,
          baseline: anomaly.baseline,
          deviationPct: anomaly.deviationPct,
          zScore: anomaly.zScore,
          lookbackDays,
          observedDate: observedDate.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }
}

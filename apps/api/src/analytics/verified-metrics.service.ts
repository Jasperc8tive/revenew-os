import { Injectable } from '@nestjs/common';
import { Prisma, VerifiedMetricWindow } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

const VERIFIED_METRICS_CONTRACT_VERSION = 'v1';

export interface VerifiedMetricSnapshotInput {
  organizationId: string;
  metricKey: 'cac' | 'ltv' | 'revenue' | 'churn';
  windowType: VerifiedMetricWindow;
  windowStart: Date;
  windowEnd: Date;
  metricValue: number;
  formulaVersion: string;
  sourceTables: string[];
  sampleSize: number;
  dataQualityFlags: string[];
  inputs?: Record<string, unknown>;
}

@Injectable()
export class VerifiedMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  private getFreshness(verifiedAt: Date) {
    const ageMs = Date.now() - verifiedAt.getTime();
    const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
    const status = ageHours <= 24 ? 'fresh' : ageHours <= 72 ? 'stale' : 'expired';

    return {
      ageHours: Number(ageHours.toFixed(2)),
      status,
    } as const;
  }

  async upsertSnapshots(inputs: VerifiedMetricSnapshotInput[]) {
    const snapshots = await Promise.all(
      inputs.map((input) =>
        this.prisma.verifiedMetricSnapshot.upsert({
          where: {
            organizationId_metricKey_windowType_windowStart_windowEnd: {
              organizationId: input.organizationId,
              metricKey: input.metricKey,
              windowType: input.windowType,
              windowStart: input.windowStart,
              windowEnd: input.windowEnd,
            },
          },
          create: {
            organizationId: input.organizationId,
            metricKey: input.metricKey,
            windowType: input.windowType,
            windowStart: input.windowStart,
            windowEnd: input.windowEnd,
            metricValue: new Prisma.Decimal(input.metricValue),
            formulaVersion: input.formulaVersion,
            sourceTables: input.sourceTables as Prisma.InputJsonValue,
            sampleSize: input.sampleSize,
            dataQualityFlags: input.dataQualityFlags as Prisma.InputJsonValue,
            ...(input.inputs ? { inputs: input.inputs as Prisma.InputJsonValue } : {}),
          },
          update: {
            metricValue: new Prisma.Decimal(input.metricValue),
            formulaVersion: input.formulaVersion,
            sourceTables: input.sourceTables as Prisma.InputJsonValue,
            sampleSize: input.sampleSize,
            dataQualityFlags: input.dataQualityFlags as Prisma.InputJsonValue,
            ...(input.inputs ? { inputs: input.inputs as Prisma.InputJsonValue } : {}),
            verifiedAt: new Date(),
          },
        }),
      ),
    );

    return snapshots.map((snapshot) => {
      const freshness = this.getFreshness(snapshot.verifiedAt);

      return {
        id: snapshot.id,
        metricKey: snapshot.metricKey,
        windowType: snapshot.windowType,
        windowStart: snapshot.windowStart.toISOString(),
        windowEnd: snapshot.windowEnd.toISOString(),
        metricValue: Number(snapshot.metricValue),
        formulaVersion: snapshot.formulaVersion,
        sourceTables: Array.isArray(snapshot.sourceTables) ? snapshot.sourceTables : [],
        sampleSize: snapshot.sampleSize,
        dataQualityFlags: Array.isArray(snapshot.dataQualityFlags) ? snapshot.dataQualityFlags : [],
        inputs: snapshot.inputs,
        verifiedAt: snapshot.verifiedAt.toISOString(),
        contract: {
          version: VERIFIED_METRICS_CONTRACT_VERSION,
          freshness,
          confidenceBand:
            snapshot.sampleSize >= 100
              ? 'high'
              : snapshot.sampleSize >= 25
                ? 'medium'
                : 'low',
        },
      };
    });
  }

  async listSnapshots(input: {
    organizationId: string;
    windowType?: VerifiedMetricWindow;
    startDate?: Date;
    endDate?: Date;
  }) {
    const snapshots = await this.prisma.verifiedMetricSnapshot.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.windowType ? { windowType: input.windowType } : {}),
        ...(input.startDate || input.endDate
          ? {
              windowStart: {
                ...(input.startDate ? { gte: input.startDate } : {}),
              },
              windowEnd: {
                ...(input.endDate ? { lte: input.endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ windowEnd: 'desc' }, { metricKey: 'asc' }],
    });

    return snapshots.map((snapshot) => {
      const freshness = this.getFreshness(snapshot.verifiedAt);

      return {
        id: snapshot.id,
        metricKey: snapshot.metricKey,
        windowType: snapshot.windowType,
        windowStart: snapshot.windowStart.toISOString(),
        windowEnd: snapshot.windowEnd.toISOString(),
        metricValue: Number(snapshot.metricValue),
        formulaVersion: snapshot.formulaVersion,
        sourceTables: Array.isArray(snapshot.sourceTables) ? snapshot.sourceTables : [],
        sampleSize: snapshot.sampleSize,
        dataQualityFlags: Array.isArray(snapshot.dataQualityFlags) ? snapshot.dataQualityFlags : [],
        inputs: snapshot.inputs,
        verifiedAt: snapshot.verifiedAt.toISOString(),
        contract: {
          version: VERIFIED_METRICS_CONTRACT_VERSION,
          freshness,
          confidenceBand:
            snapshot.sampleSize >= 100
              ? 'high'
              : snapshot.sampleSize >= 25
                ? 'medium'
                : 'low',
        },
      };
    });
  }
}
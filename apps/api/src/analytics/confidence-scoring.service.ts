import { Injectable } from '@nestjs/common';
import { IntegrationSyncStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DataQualityService } from '../data-quality/data-quality.service';

interface ConfidenceInput {
  organizationId: string;
  dataPoints: number;
  revenueGrowthRate: number;
  churnRate: number;
  ltvToCacRatio: number;
}

@Injectable()
export class ConfidenceScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataQualityService: DataQualityService,
  ) {}

  async score(input: ConfidenceInput) {
    const [varianceFactor, freshnessFactor, anomalyPenalty] = await Promise.all([
      this.computeVarianceFactor(input.organizationId),
      this.computeFreshnessFactor(input.organizationId),
      this.dataQualityService.getAnomalyPenalty(input.organizationId, 7),
    ]);

    const volumeFactor = this.normalizeVolumeFactor(input.dataPoints);
    const consistencyFactor = this.computeConsistencyFactor(
      input.revenueGrowthRate,
      input.churnRate,
      input.ltvToCacRatio,
    );
    const anomalyFactor = anomalyPenalty.factor;

    const score =
      volumeFactor * 0.25 +
      consistencyFactor * 0.2 +
      varianceFactor * 0.2 +
      anomalyFactor * 0.15 +
      freshnessFactor * 0.2;

    return {
      score: Number(score.toFixed(4)),
      components: {
        volume: Number(volumeFactor.toFixed(4)),
        consistency: Number(consistencyFactor.toFixed(4)),
        variance: Number(varianceFactor.toFixed(4)),
        anomaly: Number(anomalyFactor.toFixed(4)),
        freshness: Number(freshnessFactor.toFixed(4)),
      },
      diagnostics: {
        anomalyEventsLast7Days: anomalyPenalty.count,
        dataPoints: input.dataPoints,
      },
    };
  }

  private normalizeVolumeFactor(dataPoints: number): number {
    if (dataPoints <= 0) {
      return 0;
    }

    return Math.min(1, dataPoints / 120);
  }

  private computeConsistencyFactor(
    revenueGrowthRate: number,
    churnRate: number,
    ltvToCacRatio: number,
  ): number {
    const growthScore = revenueGrowthRate >= 0 ? 1 : Math.max(0.2, 1 + revenueGrowthRate);
    const churnScore = churnRate <= 0.05 ? 1 : Math.max(0.2, 1 - (churnRate - 0.05) * 5);

    let ratioScore = 0.3;
    if (ltvToCacRatio >= 3) {
      ratioScore = 1;
    } else if (ltvToCacRatio >= 2) {
      ratioScore = 0.75;
    } else if (ltvToCacRatio >= 1) {
      ratioScore = 0.5;
    }

    return (growthScore + churnScore + ratioScore) / 3;
  }

  private async computeVarianceFactor(organizationId: string): Promise<number> {
    const points = await this.prisma.dailyMetrics.findMany({
      where: { organizationId },
      orderBy: { date: 'desc' },
      take: 14,
    });

    if (points.length < 5) {
      return 0.4;
    }

    const revenues = points.map((point) => Number(point.revenue));
    const mean = revenues.reduce((sum, value) => sum + value, 0) / revenues.length;

    if (!Number.isFinite(mean) || mean === 0) {
      return 0.3;
    }

    const variance =
      revenues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / revenues.length;
    const stdDev = Math.sqrt(variance);
    const cv = Math.abs(stdDev / mean);

    if (!Number.isFinite(cv)) {
      return 0.3;
    }

    return Math.max(0.2, Math.min(1, 1 - cv));
  }

  private async computeFreshnessFactor(organizationId: string): Promise<number> {
    const integrations = await this.prisma.integration.findMany({
      where: {
        organizationId,
      },
      include: {
        syncLogs: {
          orderBy: {
            syncedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (integrations.length === 0) {
      return 0.3;
    }

    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000;

    const perIntegrationScores = integrations.map((integration) => {
      const lastSync = integration.syncLogs[0];
      if (!lastSync) {
        return 0.1;
      }

      const ageMs = now - lastSync.syncedAt.getTime();
      const ageScore = Math.max(0, 1 - ageMs / maxAgeMs);
      const statusPenalty =
        lastSync.status === IntegrationSyncStatus.SUCCESS
          ? 1
          : lastSync.status === IntegrationSyncStatus.PARTIAL
            ? 0.7
            : 0.3;

      return ageScore * statusPenalty;
    });

    return (
      perIntegrationScores.reduce((sum, value) => sum + value, 0) /
      perIntegrationScores.length
    );
  }
}

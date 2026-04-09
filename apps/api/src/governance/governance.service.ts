import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';

type SuccessMetricTargetRow = {
  organization_id: string;
  metric_key: string;
  target_value: number;
  operator: 'gte' | 'lte';
  cadence: 'daily' | 'weekly' | 'monthly';
  updated_by: string;
  updated_at: string;
};

type CountRow = { count: number };

@Injectable()
export class GovernanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async listWeeklyReviews(organizationId: string, actorUserId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM governance_weekly_reviews WHERE organization_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      organizationId,
    );
  }

  async upsertWeeklyReview(input: {
    organizationId: string;
    phase: string;
    workstream: string;
    evidence: string;
    blocker?: string;
    actorUserId: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO governance_weekly_reviews (
        organization_id, phase, workstream, evidence, blocker, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (organization_id, phase, workstream)
      DO UPDATE SET
        evidence = EXCLUDED.evidence,
        blocker = EXCLUDED.blocker,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      input.organizationId,
      input.phase,
      input.workstream,
      input.evidence,
      input.blocker ?? null,
      input.actorUserId,
    );

    return this.listWeeklyReviews(input.organizationId, input.actorUserId);
  }

  async listRisks(organizationId: string, actorUserId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM governance_risks WHERE organization_id = $1 ORDER BY created_at DESC`,
      organizationId,
    );
  }

  async createRisk(input: {
    organizationId: string;
    title: string;
    level: string;
    owner: string;
    mitigation: string;
    active?: boolean;
    actorUserId: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO governance_risks (
        organization_id, title, level, owner, mitigation, active, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      input.organizationId,
      input.title,
      input.level,
      input.owner,
      input.mitigation,
      input.active ?? true,
      input.actorUserId,
    );

    return this.listRisks(input.organizationId, input.actorUserId);
  }

  async upsertQualityGate(input: {
    organizationId: string;
    feature: string;
    testsPassed: boolean;
    observabilityReady: boolean;
    rollbackReady: boolean;
    actorUserId: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO governance_quality_gates (
        organization_id, feature, tests_passed, observability_ready, rollback_ready, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (organization_id, feature)
      DO UPDATE SET
        tests_passed = EXCLUDED.tests_passed,
        observability_ready = EXCLUDED.observability_ready,
        rollback_ready = EXCLUDED.rollback_ready,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      input.organizationId,
      input.feature,
      input.testsPassed,
      input.observabilityReady,
      input.rollbackReady,
      input.actorUserId,
    );

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM governance_quality_gates WHERE organization_id = $1 ORDER BY updated_at DESC`,
      input.organizationId,
    );
  }

  async createReleaseRollout(input: {
    organizationId: string;
    feature: string;
    stage: string;
    canaryValidated: boolean;
    notes?: string;
    actorUserId: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO governance_release_rollouts (
        organization_id, feature, stage, canary_validated, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      input.organizationId,
      input.feature,
      input.stage,
      input.canaryValidated,
      input.notes ?? null,
      input.actorUserId,
    );

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM governance_release_rollouts WHERE organization_id = $1 ORDER BY created_at DESC`,
      input.organizationId,
    );
  }

  async getSuccessMetrics(organizationId: string, actorUserId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
      totalIntegrations,
      activeIntegrations,
      syncFailures7d,
      syncTotal7d,
      criticalDq7d,
      recommendationsTotal,
      recommendationsApplied,
      highConfidenceRecommendations30d,
      latestVerifiedMetric,
      assistantMessages7d,
      alertsSent7d,
      alertsFailed7d,
      experimentsCompleted30d,
      weeklyReviews30d,
    ] = await Promise.all([
      this.prisma.integration.count({ where: { organizationId } }),
      this.prisma.integration.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.integrationSyncLog.count({
        where: {
          integration: { organizationId },
          status: 'FAILED',
          syncedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.integrationSyncLog.count({
        where: {
          integration: { organizationId },
          syncedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.dataQualityEvent.count({
        where: {
          organizationId,
          severity: 'CRITICAL',
          occurredAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.recommendation.count({ where: { organizationId } }),
      this.prisma.recommendation.count({ where: { organizationId, status: 'APPLIED' } }),
      this.prisma.recommendation.count({
        where: {
          organizationId,
          createdAt: { gte: thirtyDaysAgo },
          confidenceScore: { gte: 0.75 },
        },
      }),
      this.prisma.verifiedMetricSnapshot.findFirst({
        where: { organizationId },
        orderBy: { verifiedAt: 'desc' },
        select: { verifiedAt: true },
      }),
      this.prisma.copilotMessage.count({
        where: {
          conversation: { organizationId },
          role: 'ASSISTANT',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.alertEvent.count({
        where: {
          rule: { organizationId },
          status: 'SENT',
          firedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.alertEvent.count({
        where: {
          rule: { organizationId },
          status: 'FAILED',
          firedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.experiment.count({
        where: {
          organizationId,
          status: 'COMPLETED',
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM governance_weekly_reviews WHERE organization_id = $1 AND updated_at >= NOW() - INTERVAL '30 days'`,
        organizationId,
      ),
    ]);

    const activeIntegrationRatePct = totalIntegrations > 0 ? (activeIntegrations / totalIntegrations) * 100 : 0;
    const syncFailureRatePct = syncTotal7d > 0 ? (syncFailures7d / syncTotal7d) * 100 : 0;
    const recommendationAdoptionRatePct = recommendationsTotal > 0 ? (recommendationsApplied / recommendationsTotal) * 100 : 0;
    const verifiedMetricsFreshnessHours = latestVerifiedMetric
      ? (now - new Date(latestVerifiedMetric.verifiedAt).getTime()) / (60 * 60 * 1000)
      : null;

    const metricsSnapshot = {
      generatedAt: new Date(now).toISOString(),
      organizationId,
      stability: {
        activeIntegrationRatePct: this.round(activeIntegrationRatePct),
        syncFailureRatePct: this.round(syncFailureRatePct),
        criticalDataQualityEvents7d: criticalDq7d,
      },
      intelligence: {
        recommendationAdoptionRatePct: this.round(recommendationAdoptionRatePct),
        copilotAssistantMessages7d: assistantMessages7d,
        verifiedMetricsFreshnessHours: verifiedMetricsFreshnessHours === null ? null : this.round(verifiedMetricsFreshnessHours),
      },
      workflow: {
        alertsSent7d,
        alertsFailed7d,
        weeklyReviewsLogged30d: weeklyReviews30d[0]?.count ?? 0,
      },
      optimization: {
        experimentsCompleted30d,
        highConfidenceRecommendations30d,
      },
    };

    const targets = await this.listSuccessMetricTargets(organizationId, actorUserId);
    return {
      ...metricsSnapshot,
      targetEvaluations: targets.map((target) => {
        const currentValue = this.readMetricValue(metricsSnapshot, target.metric_key);
        if (typeof currentValue !== 'number') {
          return {
            metricKey: target.metric_key,
            targetValue: target.target_value,
            operator: target.operator,
            cadence: target.cadence,
            currentValue: null,
            met: null,
          };
        }

        const met = target.operator === 'gte'
          ? currentValue >= target.target_value
          : currentValue <= target.target_value;

        return {
          metricKey: target.metric_key,
          targetValue: target.target_value,
          operator: target.operator,
          cadence: target.cadence,
          currentValue: this.round(currentValue),
          met,
        };
      }),
    };
  }

  async getProgramControlsStatus(organizationId: string, actorUserId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    const [
      weeklyReviews30d,
      activeRisks,
      qualityGateTotals,
      latestRollout,
      targetTotals,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM governance_weekly_reviews WHERE organization_id = $1 AND updated_at >= NOW() - INTERVAL '30 days'`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM governance_risks WHERE organization_id = $1 AND active = true`,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ passing: number; total: number }>>(
        `
        SELECT
          SUM(CASE WHEN tests_passed = true AND observability_ready = true AND rollback_ready = true THEN 1 ELSE 0 END)::int AS passing,
          COUNT(*)::int AS total
        FROM governance_quality_gates
        WHERE organization_id = $1
        `,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<Array<{ stage: string; canary_validated: boolean; created_at: string }>>(
        `
        SELECT stage, canary_validated, created_at
        FROM governance_release_rollouts
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        organizationId,
      ),
      this.prisma.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*)::int AS count FROM governance_success_metric_targets WHERE organization_id = $1`,
        organizationId,
      ),
    ]);

    const passing = qualityGateTotals[0]?.passing ?? 0;
    const total = qualityGateTotals[0]?.total ?? 0;
    const qualityGatePassRatePct = total > 0 ? (passing / total) * 100 : 0;

    return {
      generatedAt: new Date().toISOString(),
      organizationId,
      governanceCadence: {
        weeklyReviewsLogged30d: weeklyReviews30d[0]?.count ?? 0,
        activeRisks: activeRisks[0]?.count ?? 0,
      },
      qualityGates: {
        passing,
        total,
        passRatePct: this.round(qualityGatePassRatePct),
      },
      releaseStrategy: {
        latestRollout: latestRollout[0] ?? null,
      },
      successMetricTargets: {
        total: targetTotals[0]?.count ?? 0,
      },
    };
  }

  async listSuccessMetricTargets(organizationId: string, actorUserId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    return this.prisma.$queryRawUnsafe<SuccessMetricTargetRow[]>(
      `SELECT * FROM governance_success_metric_targets WHERE organization_id = $1 ORDER BY metric_key ASC`,
      organizationId,
    );
  }

  async upsertSuccessMetricTarget(input: {
    organizationId: string;
    metricKey: string;
    targetValue: number;
    operator: 'gte' | 'lte';
    cadence: 'daily' | 'weekly' | 'monthly';
    actorUserId: string;
  }) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'analytics.basic');
    await this.assertGovernanceAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO governance_success_metric_targets (
        organization_id, metric_key, target_value, operator, cadence, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (organization_id, metric_key)
      DO UPDATE SET
        target_value = EXCLUDED.target_value,
        operator = EXCLUDED.operator,
        cadence = EXCLUDED.cadence,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      `,
      input.organizationId,
      input.metricKey,
      input.targetValue,
      input.operator,
      input.cadence,
      input.actorUserId,
    );

    return this.listSuccessMetricTargets(input.organizationId, input.actorUserId);
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS governance_weekly_reviews (
        organization_id TEXT NOT NULL,
        phase TEXT NOT NULL,
        workstream TEXT NOT NULL,
        evidence TEXT NOT NULL,
        blocker TEXT,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, phase, workstream)
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS governance_risks (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        level TEXT NOT NULL,
        owner TEXT NOT NULL,
        mitigation TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS governance_quality_gates (
        organization_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        tests_passed BOOLEAN NOT NULL,
        observability_ready BOOLEAN NOT NULL,
        rollback_ready BOOLEAN NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, feature)
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS governance_release_rollouts (
        id TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        organization_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        stage TEXT NOT NULL,
        canary_validated BOOLEAN NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS governance_success_metric_targets (
        organization_id TEXT NOT NULL,
        metric_key TEXT NOT NULL,
        target_value DOUBLE PRECISION NOT NULL,
        operator TEXT NOT NULL,
        cadence TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (organization_id, metric_key)
      )
    `);
  }

  private async assertGovernanceAccess(
    organizationId: string,
    actorUserId: string | undefined,
    mutate: boolean,
  ) {
    if (!actorUserId) {
      throw new ForbiddenException('Authenticated actor identity is required.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Membership required for governance access.');
    }

    const mutatingRoles: MembershipRole[] = [MembershipRole.OWNER, MembershipRole.ADMIN];
    if (mutate && !mutatingRoles.includes(membership.role)) {
      throw new ForbiddenException('Only owner/admin can mutate governance controls.');
    }
  }

  private readMetricValue(snapshot: Record<string, unknown>, metricKey: string): number | null {
    const path = metricKey.split('.');
    let current: unknown = snapshot;

    for (const segment of path) {
      if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return null;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return typeof current === 'number' ? current : null;
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}

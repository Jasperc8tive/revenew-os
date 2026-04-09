import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';

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
}

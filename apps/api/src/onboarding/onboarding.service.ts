import { ForbiddenException, Injectable } from '@nestjs/common';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';

type OnboardingStep =
  | 'connect_integration'
  | 'setup_billing'
  | 'invite_team'
  | 'create_first_order'
  | 'resolve_first_message'
  | 'configure_alert_rule'
  | 'schedule_first_report';

const DEFAULT_CHECKLIST: Record<OnboardingStep, boolean> = {
  connect_integration: false,
  setup_billing: false,
  invite_team: false,
  create_first_order: false,
  resolve_first_message: false,
  configure_alert_rule: false,
  schedule_first_report: false,
};

const ADVANCED_GATING_STEPS: OnboardingStep[] = [
  'connect_integration',
  'setup_billing',
  'invite_team',
  'create_first_order',
];

interface OnboardingRow {
  organization_id: string;
  checklist: unknown;
  updated_at: Date;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async getProgress(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    await this.ensureTable();
    const record = await this.fetchOrCreateRecord(organizationId);
    const checklist = this.normalizeChecklist(record.checklist);

    const completedCount = Object.values(checklist).filter(Boolean).length;
    const totalCount = Object.keys(checklist).length;

    return {
      organizationId,
      checklist,
      progress: {
        completed: completedCount,
        total: totalCount,
        percent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      },
      gates: this.buildGateState(checklist),
      updatedAt: record.updated_at,
    };
  }

  async updateStep(organizationId: string, step: OnboardingStep, completed: boolean) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.basic');

    await this.ensureTable();
    const record = await this.fetchOrCreateRecord(organizationId);
    const checklist = this.normalizeChecklist(record.checklist);

    checklist[step] = completed;

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE onboarding_progress
      SET checklist = $2::jsonb,
          updated_at = NOW()
      WHERE organization_id = $1
      `,
      organizationId,
      JSON.stringify(checklist),
    );

    return this.getProgress(organizationId);
  }

  async assertAdvancedWorkflowEnabled(organizationId: string) {
    const progress = await this.getProgress(organizationId);

    if (!progress.gates.advancedWorkflowsEnabled) {
      throw new ForbiddenException(
        'Advanced workflows are gated. Complete integration, billing, team invite, and first order milestones.',
      );
    }

    return progress;
  }

  async markMilestone(organizationId: string, step: OnboardingStep) {
    return this.updateStep(organizationId, step, true);
  }

  private async ensureTable() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS onboarding_progress (
        organization_id TEXT PRIMARY KEY,
        checklist JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async fetchOrCreateRecord(organizationId: string): Promise<OnboardingRow> {
    const rows = await this.prisma.$queryRawUnsafe<OnboardingRow[]>(
      `SELECT organization_id, checklist, updated_at FROM onboarding_progress WHERE organization_id = $1 LIMIT 1`,
      organizationId,
    );

    if (rows[0]) {
      return rows[0];
    }

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO onboarding_progress (organization_id, checklist)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (organization_id) DO NOTHING
      `,
      organizationId,
      JSON.stringify(DEFAULT_CHECKLIST),
    );

    const inserted = await this.prisma.$queryRawUnsafe<OnboardingRow[]>(
      `SELECT organization_id, checklist, updated_at FROM onboarding_progress WHERE organization_id = $1 LIMIT 1`,
      organizationId,
    );

    return inserted[0];
  }

  private normalizeChecklist(value: unknown): Record<OnboardingStep, boolean> {
    const source =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    const checklist = { ...DEFAULT_CHECKLIST };
    (Object.keys(checklist) as OnboardingStep[]).forEach((key) => {
      checklist[key] = Boolean(source[key]);
    });

    return checklist;
  }

  private buildGateState(checklist: Record<OnboardingStep, boolean>) {
    const blockedReasons = ADVANCED_GATING_STEPS.filter((step) => !checklist[step]);

    return {
      advancedWorkflowsEnabled: blockedReasons.length === 0,
      blockedReasons,
    };
  }
}

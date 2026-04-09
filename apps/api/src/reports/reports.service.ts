import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MembershipRole } from '@prisma/client';
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { OperationsService } from '../operations/operations.service';

type ReportTemplate = 'executive_summary' | 'revenue_health' | 'operations_sla';
type ReportStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

type ReportRunRow = {
  id: string;
  organization_id: string;
  template: ReportTemplate;
  status: ReportStatus;
  generated_by: string | null;
  payload: unknown;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

type ReportScheduleRow = {
  id: string;
  organization_id: string;
  template: ReportTemplate;
  cron_expression: string;
  channels: unknown;
  max_runs_per_day: number;
  last_triggered_at: Date | null;
  active: boolean;
  created_by: string | null;
  created_at: Date;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly operationsService: OperationsService,
    private readonly notificationsService: NotificationsService,
    private readonly onboardingService: OnboardingService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  listTemplates(organizationId: string) {
    return {
      organizationId,
      templates: [
        {
          key: 'executive_summary',
          title: 'Executive Summary',
          description: 'Weekly leadership report with KPI movement and recommendations.',
        },
        {
          key: 'revenue_health',
          title: 'Revenue Health',
          description: 'Revenue trends, churn pressure, and growth confidence.',
        },
        {
          key: 'operations_sla',
          title: 'Operations SLA',
          description: 'Order and message queue performance with unresolved load.',
        },
      ],
    };
  }

  async listRuns(input: { organizationId: string; actorUserId?: string }) {
    await this.assertReportAccess(input.organizationId, input.actorUserId, false);
    await this.ensureTables();

    const rows = await this.prisma.$queryRawUnsafe<ReportRunRow[]>(
      `
      SELECT id, organization_id, template, status, generated_by, payload, error_message, created_at, updated_at
      FROM report_runs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      input.organizationId,
    );

    return rows.map((row) => this.toRunResponse(row));
  }

  async generateReport(input: {
    organizationId: string;
    template: ReportTemplate;
    actorUserId?: string;
  }) {
    await this.assertReportAccess(input.organizationId, input.actorUserId, true);
    await this.ensureTables();

    const runId = await this.createRun(input.organizationId, input.template, input.actorUserId ?? null);

    try {
      await this.updateRunStatus(runId, 'RUNNING');
      const payload = await this.buildPayload(input.organizationId, input.template);

      await this.prisma.$executeRawUnsafe(
        `
        UPDATE report_runs
        SET status = 'COMPLETED',
            payload = $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        `,
        runId,
        JSON.stringify(payload),
      );

      return this.getRun(input.organizationId, runId);
    } catch (error) {
      await this.prisma.$executeRawUnsafe(
        `
        UPDATE report_runs
        SET status = 'FAILED',
            error_message = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        runId,
        error instanceof Error ? error.message : String(error),
      );

      throw error;
    }
  }

  async exportRun(input: {
    organizationId: string;
    runId: string;
    format: 'json' | 'csv';
    actorUserId?: string;
  }) {
    await this.assertReportAccess(input.organizationId, input.actorUserId, false);

    const run = await this.getRun(input.organizationId, input.runId);
    const payload = run.payload as Record<string, unknown> | null;

    if (input.format === 'json') {
      return {
        runId: run.id,
        format: 'json',
        content: JSON.stringify(payload ?? {}, null, 2),
      };
    }

    return {
      runId: run.id,
      format: 'csv',
      content: this.flattenToCsv(payload ?? {}),
    };
  }

  async createSchedule(input: {
    organizationId: string;
    template: ReportTemplate;
    cronExpression: string;
    channels: string[];
    maxRunsPerDay: number;
    actorUserId?: string;
  }) {
    await this.assertReportAccess(input.organizationId, input.actorUserId, true);
    await this.onboardingService.assertAdvancedWorkflowEnabled(input.organizationId);
    await this.ensureTables();

    const scheduleId = randomUUID();

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO report_schedules (
        id,
        organization_id,
        template,
        cron_expression,
        channels,
        max_runs_per_day,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      scheduleId,
      input.organizationId,
      input.template,
      input.cronExpression,
      JSON.stringify(input.channels.map((item) => item.trim().toLowerCase()).filter(Boolean)),
      input.maxRunsPerDay,
      input.actorUserId ?? null,
    );

    await this.onboardingService.markMilestone(input.organizationId, 'schedule_first_report');

    return this.listSchedules(input.organizationId, input.actorUserId);
  }

  async listSchedules(organizationId: string, actorUserId?: string) {
    await this.assertReportAccess(organizationId, actorUserId, false);
    await this.ensureTables();

    const rows = await this.prisma.$queryRawUnsafe<ReportScheduleRow[]>(
      `
      SELECT
        id,
        organization_id,
        template,
        cron_expression,
        channels,
        max_runs_per_day,
        last_triggered_at,
        active,
        created_by,
        created_at
      FROM report_schedules
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      organizationId,
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      template: row.template,
      cronExpression: row.cron_expression,
      channels: this.normalizeStringArray(row.channels),
      maxRunsPerDay: row.max_runs_per_day,
      lastTriggeredAt: row.last_triggered_at,
      active: row.active,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  }

  async runDueSchedules() {
    await this.ensureTables();

    const schedules = await this.prisma.$queryRawUnsafe<ReportScheduleRow[]>(
      `
      SELECT
        id,
        organization_id,
        template,
        cron_expression,
        channels,
        max_runs_per_day,
        last_triggered_at,
        active,
        created_by,
        created_at
      FROM report_schedules
      WHERE active = true
      `,
    );

    const now = Date.now();
    const outcomes = [] as Array<{ scheduleId: string; triggered: boolean; reason?: string; runId?: string }>;

    for (const schedule of schedules) {
      const shouldRun = this.isScheduleDue(schedule, now);
      if (!shouldRun) {
        outcomes.push({ scheduleId: schedule.id, triggered: false, reason: 'not_due' });
        continue;
      }

      if (!schedule.created_by) {
        outcomes.push({ scheduleId: schedule.id, triggered: false, reason: 'missing_actor' });
        continue;
      }

      const todaysCountRows = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `
        SELECT COUNT(*)::int AS count
        FROM report_runs
        WHERE organization_id = $1
          AND template = $2
          AND created_at >= date_trunc('day', NOW())
        `,
        schedule.organization_id,
        schedule.template,
      );

      const todaysCount = todaysCountRows[0]?.count ?? 0;
      if (todaysCount >= schedule.max_runs_per_day) {
        outcomes.push({ scheduleId: schedule.id, triggered: false, reason: 'daily_limit_reached' });
        continue;
      }

      const run = await this.generateReport({
        organizationId: schedule.organization_id,
        template: schedule.template,
        actorUserId: schedule.created_by,
      });

      await this.prisma.$executeRawUnsafe(
        `UPDATE report_schedules SET last_triggered_at = NOW() WHERE id = $1`,
        schedule.id,
      );

      const channels = this.normalizeStringArray(schedule.channels);
      if (channels.length > 0) {
        await this.notificationsService.dispatchAlert({
          organizationId: schedule.organization_id,
          title: `Scheduled report: ${schedule.template}`,
          message: `Report run ${run.id} completed and is ready for export.`,
          channels,
        });
      }

      outcomes.push({ scheduleId: schedule.id, triggered: true, runId: run.id });
    }

    return {
      checked: schedules.length,
      triggered: outcomes.filter((item) => item.triggered).length,
      outcomes,
    };
  }

  private async buildPayload(organizationId: string, template: ReportTemplate) {
    if (template === 'executive_summary') {
      return this.analyticsService.getExecutiveSummary({ organizationId });
    }

    if (template === 'revenue_health') {
      const revenue = await this.analyticsService.getRevenueRaw({ organizationId });
      const churn = await this.analyticsService.getChurnRaw({ organizationId });
      const ltv = await this.analyticsService.getLTVRaw({ organizationId });

      return {
        type: template,
        generatedAt: new Date().toISOString(),
        revenue,
        churn,
        ltv,
      };
    }

    const triage = await this.operationsService.listMessageTriage(organizationId, {
      unresolvedOnly: true,
      slaMinutes: 30,
    });

    const orders = await this.operationsService.listOrders(organizationId, {
      operationalState: 'QUEUED',
    });

    return {
      type: template,
      generatedAt: new Date().toISOString(),
      unresolvedMessageCount: triage.filter((item) => !item.resolved).length,
      breachedMessageCount: triage.filter((item) => item.slaBreached).length,
      queuedOrderCount: orders.length,
      sample: {
        triage: triage.slice(0, 20),
        orders: orders.slice(0, 20),
      },
    };
  }

  private async createRun(
    organizationId: string,
    template: ReportTemplate,
    generatedBy: string | null,
  ) {
    const runId = randomUUID();

    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
      INSERT INTO report_runs (id, organization_id, template, status, generated_by)
      VALUES ($1, $2, $3, 'QUEUED', $4)
      RETURNING id
      `,
      runId,
      organizationId,
      template,
      generatedBy,
    );

    return rows[0].id;
  }

  private async updateRunStatus(runId: string, status: ReportStatus) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE report_runs SET status = $2, updated_at = NOW() WHERE id = $1`,
      runId,
      status,
    );
  }

  private async getRun(organizationId: string, runId: string) {
    const rows = await this.prisma.$queryRawUnsafe<ReportRunRow[]>(
      `
      SELECT id, organization_id, template, status, generated_by, payload, error_message, created_at, updated_at
      FROM report_runs
      WHERE id = $1 AND organization_id = $2
      LIMIT 1
      `,
      runId,
      organizationId,
    );

    if (!rows[0]) {
      throw new Error('Report run not found');
    }

    return this.toRunResponse(rows[0]);
  }

  private toRunResponse(row: ReportRunRow) {
    return {
      id: row.id,
      organizationId: row.organization_id,
      template: row.template,
      status: row.status,
      generatedBy: row.generated_by,
      payload: row.payload,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private flattenToCsv(payload: Record<string, unknown>) {
    const rows: Array<{ key: string; value: string }> = [];

    const walk = (prefix: string, value: unknown) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((entry, index) => walk(`${prefix}[${index}]`, entry));
          return;
        }

        Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
          walk(prefix ? `${prefix}.${key}` : key, child);
        });
        return;
      }

      rows.push({ key: prefix, value: value == null ? '' : String(value) });
    };

    walk('', payload);

    const header = 'key,value';
    const body = rows
      .map((entry) => `${this.escapeCsv(entry.key)},${this.escapeCsv(entry.value)}`)
      .join('\n');

    return `${header}\n${body}`;
  }

  private escapeCsv(value: string) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
      .filter((item) => item.length > 0);
  }

  private isScheduleDue(schedule: ReportScheduleRow, now: number) {
    const cron = schedule.cron_expression.trim();

    if (cron === 'HOURLY') {
      if (!schedule.last_triggered_at) {
        return true;
      }
      return now - schedule.last_triggered_at.getTime() >= 60 * 60 * 1000;
    }

    if (cron === 'DAILY') {
      if (!schedule.last_triggered_at) {
        return true;
      }
      return now - schedule.last_triggered_at.getTime() >= 24 * 60 * 60 * 1000;
    }

    if (cron === 'WEEKLY') {
      if (!schedule.last_triggered_at) {
        return true;
      }
      return now - schedule.last_triggered_at.getTime() >= 7 * 24 * 60 * 60 * 1000;
    }

    return false;
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS report_runs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        template TEXT NOT NULL,
        status TEXT NOT NULL,
        generated_by TEXT,
        payload JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        template TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        channels JSONB NOT NULL,
        max_runs_per_day INT NOT NULL,
        last_triggered_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT true,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async assertReportAccess(
    organizationId: string,
    actorUserId: string | undefined,
    mutate: boolean,
  ) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

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
      throw new ForbiddenException('Membership required for report access.');
    }

    const mutatingRoles: MembershipRole[] = [
      MembershipRole.OWNER,
      MembershipRole.ADMIN,
      MembershipRole.DELIVERY_MANAGER,
    ];

    if (mutate && !mutatingRoles.includes(membership.role)) {
      throw new ForbiddenException('Only owner/admin/delivery manager can mutate reports.');
    }
  }
}

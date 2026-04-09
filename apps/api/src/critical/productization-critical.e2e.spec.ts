import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MembershipRole } from '@prisma/client';
import request = require('supertest');
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GovernanceController } from '../governance/governance.controller';
import { GovernanceService } from '../governance/governance.service';
import { ReportsController } from '../reports/reports.controller';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { OperationsService } from '../operations/operations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OnboardingService } from '../onboarding/onboarding.service';

type QualityGateRow = {
  organization_id: string;
  feature: string;
  tests_passed: boolean;
  observability_ready: boolean;
  rollback_ready: boolean;
  updated_by: string;
  updated_at: string;
};

type ReportScheduleRow = {
  id: string;
  organization_id: string;
  template: 'executive_summary' | 'revenue_health' | 'operations_sla';
  cron_expression: string;
  channels: string[];
  max_runs_per_day: number;
  export_format: 'json' | 'csv' | 'pdf';
  last_triggered_at: Date | null;
  active: boolean;
  created_by: string | null;
  created_at: Date;
};

type ReportRunRow = {
  id: string;
  organization_id: string;
  template: 'executive_summary' | 'revenue_health' | 'operations_sla';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  generated_by: string | null;
  payload: Record<string, unknown>;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

describe('Critical productization journeys (e2e)', () => {
  let app: INestApplication;

  const qualityGates: QualityGateRow[] = [];
  const schedules: ReportScheduleRow[] = [];
  const runs: ReportRunRow[] = [];

  const roleByUserId: Record<string, MembershipRole> = {
    'owner-1': MembershipRole.OWNER,
    'admin-1': MembershipRole.ADMIN,
    'delivery-1': MembershipRole.DELIVERY_MANAGER,
    'staff-1': MembershipRole.STAFF,
    'viewer-1': MembershipRole.VIEWER,
    'system-user': MembershipRole.OWNER,
  };

  const prismaMock = {
    membership: {
      findFirst: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const role = roleByUserId[where.userId];
        if (!role) {
          return null;
        }

        return { role };
      }),
    },
    $executeRawUnsafe: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('INSERT INTO governance_quality_gates')) {
        qualityGates.unshift({
          organization_id: params[0] as string,
          feature: params[1] as string,
          tests_passed: params[2] as boolean,
          observability_ready: params[3] as boolean,
          rollback_ready: params[4] as boolean,
          updated_by: params[5] as string,
          updated_at: new Date().toISOString(),
        });
      }

      if (sql.includes('INSERT INTO report_schedules')) {
        schedules.unshift({
          id: params[0] as string,
          organization_id: params[1] as string,
          template: params[2] as ReportScheduleRow['template'],
          cron_expression: params[3] as string,
          channels: JSON.parse((params[4] as string) ?? '[]') as string[],
          max_runs_per_day: params[5] as number,
          export_format: params[6] as ReportScheduleRow['export_format'],
          created_by: (params[7] as string | null) ?? null,
          active: true,
          last_triggered_at: null,
          created_at: new Date(),
        });
      }

      return 1;
    }),
    $queryRawUnsafe: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('FROM governance_quality_gates')) {
        return qualityGates.filter((row) => row.organization_id === params[0]);
      }

      if (sql.includes('FROM report_schedules')) {
        return schedules.filter((row) => row.organization_id === params[0]);
      }

      if (sql.includes('FROM report_runs') && sql.includes('WHERE id = $1 AND organization_id = $2')) {
        return runs.filter((row) => row.id === params[0] && row.organization_id === params[1]);
      }

      if (sql.includes('FROM report_runs') && sql.includes('WHERE organization_id = $1')) {
        return runs.filter((row) => row.organization_id === params[0]);
      }

      return [];
    }),
  } as unknown as PrismaService;

  const billingAccessMock = {
    assertFeatureAccess: jest.fn(async () => true),
  } as unknown as BillingAccessService;

  const onboardingMock = {
    assertAdvancedWorkflowEnabled: jest.fn(async () => true),
    markMilestone: jest.fn(async () => true),
  } as unknown as OnboardingService;

  const analyticsMock = {
    getExecutiveSummary: jest.fn(async () => ({ revenue: 1000 })),
    getRevenueRaw: jest.fn(async () => []),
    getChurnRaw: jest.fn(async () => []),
    getLTVRaw: jest.fn(async () => []),
  } as unknown as AnalyticsService;

  const operationsMock = {
    listMessageTriage: jest.fn(async () => []),
    listOrders: jest.fn(async () => []),
  } as unknown as OperationsService;

  const notificationsMock = {
    dispatchAlert: jest.fn(async () => true),
  } as unknown as NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    qualityGates.splice(0, qualityGates.length);
    schedules.splice(0, schedules.length);
    runs.splice(0, runs.length);

    runs.push({
      id: 'run-1',
      organization_id: 'org-1',
      template: 'executive_summary',
      status: 'COMPLETED',
      generated_by: 'owner-1',
      payload: {
        revenue: 1500000,
        churn: 0.02,
      },
      error_message: null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GovernanceController, ReportsController],
      providers: [
        GovernanceService,
        ReportsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: BillingAccessService,
          useValue: billingAccessMock,
        },
        {
          provide: OnboardingService,
          useValue: onboardingMock,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsMock,
        },
        {
          provide: OperationsService,
          useValue: operationsMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['owner-1', 201],
    ['admin-1', 201],
    ['delivery-1', 403],
    ['staff-1', 403],
    ['viewer-1', 403],
  ])(
    'enforces role-restricted governance mutation for %s',
    async (userId, expectedStatus) => {
      const response = await request(app.getHttpServer())
        .post('/governance/quality-gates')
        .set('x-user-id', userId)
        .send({
          organizationId: 'org-1',
          feature: 'critical-journey-suite',
          testsPassed: true,
          observabilityReady: true,
          rollbackReady: true,
        })
        .expect(expectedStatus);

      if (expectedStatus === 201) {
        expect(response.body[0].feature).toBe('critical-journey-suite');
      }
    },
  );

  it('allows delivery manager to create report schedules with explicit export format', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports/schedules')
      .set('x-user-id', 'delivery-1')
      .send({
        organizationId: 'org-1',
        template: 'executive_summary',
        cronExpression: '0 8 * * *',
        channels: ['email', 'slack'],
        maxRunsPerDay: 2,
        exportFormat: 'pdf',
      })
      .expect(201);

    expect(response.body[0].exportFormat).toBe('pdf');
  });

  it('blocks staff from creating report schedules', async () => {
    await request(app.getHttpServer())
      .post('/reports/schedules')
      .set('x-user-id', 'staff-1')
      .send({
        organizationId: 'org-1',
        template: 'executive_summary',
        cronExpression: '0 8 * * *',
        channels: ['email'],
        maxRunsPerDay: 1,
        exportFormat: 'csv',
      })
      .expect(403);
  });

  it('exports an existing report run in csv format', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/runs/run-1/export')
      .set('x-user-id', 'delivery-1')
      .query({ organizationId: 'org-1', format: 'csv' })
      .expect(200);

    expect(response.body.format).toBe('csv');
    expect(response.body.contentType).toBe('text/csv');
    expect(response.body.content).toContain('key,value');
    expect(response.body.content).toContain('"revenue","1500000"');
  });
});

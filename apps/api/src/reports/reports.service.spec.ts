import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ReportsService } from './reports.service';

describe('ReportsService critical journeys', () => {
  const prismaMock = {
    membership: {
      findFirst: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
    $executeRawUnsafe: jest.fn(),
    integrationSyncLog: { count: jest.fn() },
    recommendation: { count: jest.fn() },
    verifiedMetricSnapshot: { findFirst: jest.fn() },
    dataQualityEvent: { count: jest.fn() },
    copilotMessage: { count: jest.fn() },
    alertEvent: { count: jest.fn() },
    experiment: { count: jest.fn() },
  } as any;

  const analyticsMock = {
    getExecutiveSummary: jest.fn(),
    getRevenueRaw: jest.fn(),
    getChurnRaw: jest.fn(),
    getLTVRaw: jest.fn(),
  } as any;

  const operationsMock = {
    listMessageTriage: jest.fn(),
    listOrders: jest.fn(),
  } as any;

  const notificationsMock = {
    dispatchAlert: jest.fn(),
  } as any;

  const onboardingMock = {
    assertAdvancedWorkflowEnabled: jest.fn(),
    markMilestone: jest.fn(),
  } as any;

  const billingMock = {
    assertFeatureAccess: jest.fn(),
  } as any;

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(
      prismaMock,
      analyticsMock,
      operationsMock,
      notificationsMock,
      onboardingMock,
      billingMock,
    );

    prismaMock.membership.findFirst.mockResolvedValue({ role: 'OWNER' });
    billingMock.assertFeatureAccess.mockResolvedValue(undefined);
    analyticsMock.getExecutiveSummary.mockResolvedValue({ revenue: 1000, topRecommendation: 'Scale retargeting' });
    prismaMock.$executeRawUnsafe.mockResolvedValue(1);
  });

  it('exports report runs in PDF format for automated delivery', async () => {
    prismaMock.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM report_runs')) {
        return [
          {
            id: 'run-1',
            organization_id: 'org-1',
            template: 'executive_summary',
            status: 'COMPLETED',
            generated_by: 'owner-1',
            payload: { revenue: 1000, churn: 0.02 },
            error_message: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }

      return [];
    });

    const exportResult = await service.exportRun({
      organizationId: 'org-1',
      runId: 'run-1',
      format: 'pdf',
      actorUserId: 'owner-1',
    });

    expect(exportResult.format).toBe('pdf');
    expect(exportResult.contentType).toBe('application/pdf');
    expect(exportResult.encoding).toBe('base64');
    expect(typeof exportResult.content).toBe('string');
  });

  it('includes scheduled export format in delivery notification path', async () => {
    prismaMock.$queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM report_schedules')) {
        return [
          {
            id: 'schedule-1',
            organization_id: 'org-1',
            template: 'executive_summary',
            cron_expression: 'HOURLY',
            channels: ['email'],
            max_runs_per_day: 3,
            export_format: 'pdf',
            last_triggered_at: null,
            active: true,
            created_by: 'owner-1',
            created_at: new Date(),
          },
        ];
      }

      if (sql.includes('COUNT(*)::int AS count') && sql.includes('report_runs')) {
        return [{ count: 0 }];
      }

      if (sql.includes('INSERT INTO report_runs')) {
        return [{ id: 'run-1' }];
      }

      if (sql.includes('WHERE id = $1 AND organization_id = $2')) {
        return [
          {
            id: 'run-1',
            organization_id: 'org-1',
            template: 'executive_summary',
            status: 'COMPLETED',
            generated_by: 'owner-1',
            payload: { revenue: 1000 },
            error_message: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
      }

      return [];
    });

    const result = await service.runDueSchedules();

    expect(result.triggered).toBe(1);
    expect(notificationsMock.dispatchAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('format=pdf'),
      }),
    );
  });
});

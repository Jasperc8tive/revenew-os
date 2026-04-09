import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import request = require('supertest');
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController (e2e)', () => {
  let app: INestApplication;

  const reportsServiceMock = {
    listTemplates: jest.fn(),
    listRuns: jest.fn(),
    generateReport: jest.fn(),
    exportRun: jest.fn(),
    createSchedule: jest.fn(),
    listSchedules: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    reportsServiceMock.listTemplates.mockImplementation(async () => ({
      organizationId: 'org-1',
      templates: [{ key: 'executive_summary' }],
    }));

    reportsServiceMock.listRuns.mockImplementation(async () => [{ id: 'run-1', template: 'executive_summary' }]);
    reportsServiceMock.generateReport.mockImplementation(async () => ({ id: 'run-2', status: 'COMPLETED' }));
    reportsServiceMock.exportRun.mockImplementation(async () => ({ runId: 'run-1', format: 'pdf', content: 'JVBERi0xLjQ=', contentType: 'application/pdf', encoding: 'base64' }));
    reportsServiceMock.createSchedule.mockImplementation(async () => [{ id: 'schedule-1', template: 'executive_summary', exportFormat: 'pdf' }]);
    reportsServiceMock.listSchedules.mockImplementation(async () => [{ id: 'schedule-1' }]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reportsServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /reports/templates returns available report templates', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/templates?organizationId=org-1')
      .expect(200);

    expect(response.body.templates[0].key).toBe('executive_summary');
  });

  it('POST /reports/generate creates a report run', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports/generate')
      .send({ organizationId: 'org-1', template: 'executive_summary' })
      .expect(201);

    expect(response.body.status).toBe('COMPLETED');
    expect(reportsServiceMock.generateReport).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'system-user' }),
    );
  });

  it('GET /reports/runs/:id/export returns export payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/runs/run-1/export?organizationId=org-1&format=pdf')
      .expect(200);

    expect(response.body.format).toBe('pdf');
    expect(reportsServiceMock.exportRun).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'system-user' }),
    );
  });

  it('POST /reports/schedules creates report schedule', async () => {
    const response = await request(app.getHttpServer())
      .post('/reports/schedules')
      .send({
        organizationId: 'org-1',
        template: 'executive_summary',
        cronExpression: 'DAILY',
        channels: ['email'],
        maxRunsPerDay: 1,
        exportFormat: 'pdf',
      })
      .expect(201);

    expect(response.body[0].id).toBe('schedule-1');
    expect(response.body[0].exportFormat).toBe('pdf');
    expect(reportsServiceMock.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'system-user' }),
    );
  });

  it('POST /reports/schedules returns 403 when onboarding gate blocks advanced workflow', async () => {
    reportsServiceMock.createSchedule.mockImplementation(async () => {
      throw new ForbiddenException('Advanced workflows are gated.');
    });

    await request(app.getHttpServer())
      .post('/reports/schedules')
      .send({
        organizationId: 'org-1',
        template: 'executive_summary',
        cronExpression: 'DAILY',
        channels: ['email'],
        maxRunsPerDay: 1,
      })
      .expect(403);
  });
});

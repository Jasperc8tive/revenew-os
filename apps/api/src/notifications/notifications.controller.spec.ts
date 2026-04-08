import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { AlertMetric, AlertOperator } from '@prisma/client';
import { AlertRulesService } from './alert-rules.service';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication;

  const alertRulesServiceMock = {
    createRule: jest.fn(),
    listRules: jest.fn(),
    deleteRule: jest.fn(),
    listEvents: jest.fn(),
    evaluateAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: AlertRulesService,
          useValue: alertRulesServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /alerts/rules should create rule', async () => {
    alertRulesServiceMock.createRule.mockImplementation(async () => ({
      id: 'rule-1',
      organizationId: 'org-1',
      metric: AlertMetric.CHURN,
      operator: AlertOperator.GT,
      threshold: 5,
      channels: ['email'],
    }));

    const response = await request(app.getHttpServer())
      .post('/alerts/rules')
      .send({
        organizationId: 'org-1',
        name: 'High churn',
        metric: AlertMetric.CHURN,
        operator: AlertOperator.GT,
        threshold: 5,
        channels: ['email'],
      })
      .expect(201);

    expect(response.body.id).toBe('rule-1');
    expect(alertRulesServiceMock.createRule).toHaveBeenCalledTimes(1);
  });

  it('GET /alerts/rules should list rules', async () => {
    alertRulesServiceMock.listRules.mockImplementation(async () => [{ id: 'rule-1', active: true }]);

    const response = await request(app.getHttpServer())
      .get('/alerts/rules?organizationId=org-1&active=true')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('rule-1');
  });

  it('DELETE /alerts/rules/:id should delete rule', async () => {
    alertRulesServiceMock.deleteRule.mockImplementation(async () => ({ deleted: true, id: 'rule-1' }));

    const response = await request(app.getHttpServer())
      .delete('/alerts/rules/rule-1?organizationId=org-1')
      .expect(200);

    expect(response.body).toMatchObject({ deleted: true, id: 'rule-1' });
  });

  it('GET /alerts/events should return event history', async () => {
    alertRulesServiceMock.listEvents.mockImplementation(async () => [{ id: 'evt-1', status: 'SENT' }]);

    const response = await request(app.getHttpServer())
      .get('/alerts/events?organizationId=org-1&limit=10')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('evt-1');
  });

  it('POST /alerts/evaluate should evaluate all rules', async () => {
    alertRulesServiceMock.evaluateAll.mockImplementation(async () => ({ checked: 2, triggered: 1 }));

    const response = await request(app.getHttpServer()).post('/alerts/evaluate').send({}).expect(201);

    expect(response.body).toMatchObject({ checked: 2, triggered: 1 });
  });
});

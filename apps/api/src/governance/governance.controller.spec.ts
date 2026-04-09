import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

describe('GovernanceController (e2e)', () => {
  let app: INestApplication;

  const serviceMock = {
    listWeeklyReviews: jest.fn(),
    upsertWeeklyReview: jest.fn(),
    listRisks: jest.fn(),
    createRisk: jest.fn(),
    upsertQualityGate: jest.fn(),
    createReleaseRollout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    serviceMock.listWeeklyReviews.mockImplementation(async () => [{ phase: 'phase-4' }]);
    serviceMock.upsertWeeklyReview.mockImplementation(async () => [{ phase: 'phase-4', blocker: null }]);
    serviceMock.listRisks.mockImplementation(async () => [{ title: 'Data lag', level: 'high' }]);
    serviceMock.createRisk.mockImplementation(async () => [{ title: 'Queue pressure' }]);
    serviceMock.upsertQualityGate.mockImplementation(async () => [{ feature: 'forecasting-scenarios', tests_passed: true }]);
    serviceMock.createReleaseRollout.mockImplementation(async () => [{ feature: 'growth-graph', stage: 'canary' }]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GovernanceController],
      providers: [{ provide: GovernanceService, useValue: serviceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /governance/weekly-reviews returns implementation review entries', async () => {
    const response = await request(app.getHttpServer())
      .get('/governance/weekly-reviews?organizationId=org-1')
      .expect(200);

    expect(response.body[0].phase).toBe('phase-4');
  });

  it('POST /governance/risks creates risk register entry', async () => {
    const response = await request(app.getHttpServer())
      .post('/governance/risks')
      .send({
        organizationId: 'org-1',
        title: 'Queue pressure',
        level: 'high',
        owner: 'ops-lead',
        mitigation: 'Scale workers',
      })
      .expect(201);

    expect(response.body[0].title).toBe('Queue pressure');
  });

  it('POST /governance/quality-gates records quality gate checks', async () => {
    const response = await request(app.getHttpServer())
      .post('/governance/quality-gates')
      .send({
        organizationId: 'org-1',
        feature: 'forecasting-scenarios',
        testsPassed: true,
        observabilityReady: true,
        rollbackReady: true,
      })
      .expect(201);

    expect(response.body[0].feature).toBe('forecasting-scenarios');
  });

  it('POST /governance/release-rollouts records rollout stage updates', async () => {
    const response = await request(app.getHttpServer())
      .post('/governance/release-rollouts')
      .send({
        organizationId: 'org-1',
        feature: 'growth-graph',
        stage: 'canary',
        canaryValidated: true,
      })
      .expect(201);

    expect(response.body[0].stage).toBe('canary');
  });
});

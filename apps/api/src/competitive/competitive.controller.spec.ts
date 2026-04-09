import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { CompetitiveController } from './competitive.controller';
import { CompetitiveService } from './competitive.service';

describe('CompetitiveController (e2e)', () => {
  let app: INestApplication;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = {
    createCompetitor: jest.fn(),
    listCompetitors: jest.fn(),
    createSignal: jest.fn(),
    listSignals: jest.fn(),
    getOverview: jest.fn(),
    getSignalTrend: jest.fn(),
    getCompetitorComparison: jest.fn(),
    getActionableDeltas: jest.fn(),
    generateWeeklyBrief: jest.fn(),
    evaluateAlerts: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CompetitiveController],
      providers: [
        {
          provide: CompetitiveService,
          useValue: svc,
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

  it('POST /competitive/competitors creates a competitor', async () => {
    svc.createCompetitor.mockImplementation(async () => ({
      id: 'comp-1',
      organizationId: 'org-1',
      name: 'Acme Retail',
      website: 'https://acme.example',
      industry: 'ECOMMERCE',
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const response = await request(app.getHttpServer())
      .post('/competitive/competitors')
      .send({
        organizationId: 'org-1',
        name: 'Acme Retail',
        website: 'https://acme.example',
        industry: 'ECOMMERCE',
      })
      .expect(201);

    expect(response.body.id).toBe('comp-1');
    expect(response.body.name).toBe('Acme Retail');
  });

  it('GET /competitive/competitors returns competitors list', async () => {
    svc.listCompetitors.mockImplementation(async () => [
      {
        id: 'comp-1',
        organizationId: 'org-1',
        name: 'Acme Retail',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/competitive/competitors?organizationId=org-1')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe('comp-1');
  });

  it('POST /competitive/signals creates a competitor signal', async () => {
    svc.createSignal.mockImplementation(async () => ({
      id: 'signal-1',
      competitorId: 'comp-1',
      signalType: 'TRAFFIC',
      value: '+18%',
      unit: null,
      source: 'SimilarWeb',
      date: '2026-04-07',
      notes: null,
      createdAt: new Date().toISOString(),
    }));

    const response = await request(app.getHttpServer())
      .post('/competitive/signals')
      .send({
        organizationId: 'org-1',
        competitorId: 'comp-1',
        signalType: 'TRAFFIC',
        value: '+18%',
        source: 'SimilarWeb',
        date: '2026-04-07',
      })
      .expect(201);

    expect(response.body.id).toBe('signal-1');
    expect(response.body.signalType).toBe('TRAFFIC');
  });

  it('GET /competitive/signals supports filtering', async () => {
    svc.listSignals.mockImplementation(async () => [
      {
        id: 'signal-1',
        competitorId: 'comp-1',
        signalType: 'HIRING',
        value: '12 open roles',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/competitive/signals?organizationId=org-1&signalType=HIRING&limit=10')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].signalType).toBe('HIRING');
  });

  it('GET /competitive/overview returns aggregate summary', async () => {
    svc.getOverview.mockImplementation(async () => ({
      organizationId: 'org-1',
      competitorCount: 3,
      signalCount: 18,
      signalTypeBreakdown: [
        { signalType: 'TRAFFIC', count: 7 },
        { signalType: 'PRODUCT_LAUNCH', count: 5 },
      ],
      recentSignals: [],
    }));

    const response = await request(app.getHttpServer())
      .get('/competitive/overview?organizationId=org-1')
      .expect(200);

    expect(response.body.competitorCount).toBe(3);
    expect(response.body.signalCount).toBe(18);
    expect(response.body.signalTypeBreakdown).toHaveLength(2);
  });

  it('GET /competitive/trend returns trend buckets and parses days filter', async () => {
    svc.getSignalTrend.mockImplementation(async () => ({
      window: 7,
      buckets: [
        {
          date: '2026-04-01',
          total: 2,
          byType: {
            TRAFFIC: 1,
            HIRING: 1,
          },
        },
      ],
    }));

    const response = await request(app.getHttpServer())
      .get('/competitive/trend?organizationId=org-1&days=7&competitorId=comp-1&signalType=TRAFFIC')
      .expect(200);

    expect(svc.getSignalTrend).toHaveBeenCalledWith('org-1', 7, 'comp-1', 'TRAFFIC');
    expect(response.body.window).toBe(7);
    expect(response.body.buckets).toHaveLength(1);
    expect(response.body.buckets[0].byType.TRAFFIC).toBe(1);
  });

  it('GET /competitive/comparison returns competitor comparison and parses days', async () => {
    svc.getCompetitorComparison.mockImplementation(async () => ({
      days: 30,
      competitors: [
        {
          id: 'comp-1',
          name: 'Acme Retail',
          signalCounts: { TRAFFIC: 3, PRICING: 1 },
          total: 4,
        },
      ],
    }));

    const response = await request(app.getHttpServer())
      .get('/competitive/comparison?organizationId=org-1&days=30')
      .expect(200);

    expect(svc.getCompetitorComparison).toHaveBeenCalledWith('org-1', 30);
    expect(response.body.days).toBe(30);
    expect(response.body.competitors).toHaveLength(1);
    expect(response.body.competitors[0].total).toBe(4);
  });

  it('POST /competitive/brief generates weekly brief', async () => {
    svc.generateWeeklyBrief.mockImplementation(async () => ({
      brief: 'Executive summary text',
      generatedAt: '2026-04-07T12:00:00.000Z',
      signalCount: 6,
    }));

    const response = await request(app.getHttpServer())
      .post('/competitive/brief')
      .send({ organizationId: 'org-1' })
      .expect(200);

    expect(svc.generateWeeklyBrief).toHaveBeenCalledWith('org-1');
    expect(response.body.signalCount).toBe(6);
    expect(response.body.brief).toContain('Executive');
  });

  it('POST /competitive/alerts/evaluate evaluates rules and returns triggers', async () => {
    svc.evaluateAlerts.mockImplementation(async () => ({
      rules: [
        {
          competitorId: 'comp-1',
          competitorName: 'Acme Retail',
          signalType: 'HIRING',
          windowDays: 7,
          threshold: 3,
          actualCount: 5,
          triggered: true,
        },
      ],
      evaluatedAt: '2026-04-07T12:00:00.000Z',
    }));

    const payload = {
      organizationId: 'org-1',
      rules: [
        {
          signalType: 'HIRING',
          windowDays: 7,
          minCount: 3,
          competitorId: 'comp-1',
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/competitive/alerts/evaluate')
      .send(payload)
      .expect(200);

    expect(svc.evaluateAlerts).toHaveBeenCalledWith('org-1', payload.rules);
    expect(response.body.rules).toHaveLength(1);
    expect(response.body.rules[0].triggered).toBe(true);
    expect(response.body.rules[0].actualCount).toBe(5);
  });

  it('GET /competitive/actionable-deltas returns relevance-ranked competitive actions', async () => {
    svc.getActionableDeltas.mockImplementation(async () => ({
      organizationId: 'org-1',
      deltas: [
        {
          signalId: 'signal-1',
          competitorName: 'Acme Retail',
          relevanceScore: 0.91,
          urgency: 'high',
        },
      ],
    }));

    const response = await request(app.getHttpServer())
      .get('/competitive/actionable-deltas?organizationId=org-1&days=14')
      .expect(200);

    expect(svc.getActionableDeltas).toHaveBeenCalledWith('org-1', 14);
    expect(response.body.deltas[0].urgency).toBe('high');
  });
});

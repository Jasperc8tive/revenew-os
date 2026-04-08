import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { ExperimentsController } from './experiments.controller';
import { ExperimentsService } from './experiments.service';

const ORG = 'org-1';
const EXP = 'exp-1';
const VAR_CONTROL = { id: 'var-ctrl', experimentId: EXP, name: 'Control', isControl: true, description: null, createdAt: new Date().toISOString(), results: [] };
const VAR_TREATMENT = { id: 'var-treat', experimentId: EXP, name: 'Treatment A', isControl: false, description: 'Discount offer', createdAt: new Date().toISOString(), results: [] };

const mockExperiment = () => ({
  id: EXP,
  organizationId: ORG,
  title: 'Discount impact test',
  hypothesis: 'Offering a 10% discount increases repeat purchase rate',
  status: 'DRAFT',
  targetMetric: 'REVENUE',
  startDate: null,
  endDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  variants: [VAR_CONTROL, VAR_TREATMENT],
});

describe('ExperimentsController (e2e)', () => {
  let app: INestApplication;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = {
    createExperiment: jest.fn(),
    listExperiments: jest.fn(),
    getExperiment: jest.fn(),
    launchExperiment: jest.fn(),
    completeExperiment: jest.fn(),
    archiveExperiment: jest.fn(),
    updateExperiment: jest.fn(),
    addVariant: jest.fn(),
    recordResult: jest.fn(),
    getExperimentStats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: svc }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── Create ────────────────────────────────────────────────────────────────

  it('POST /experiments creates an experiment and returns it', async () => {
    const exp = mockExperiment();
    svc.createExperiment.mockResolvedValue(exp);

    const res = await request(app.getHttpServer())
      .post('/experiments')
      .send({
        organizationId: ORG,
        title: 'Discount impact test',
        hypothesis: 'Offering a 10% discount increases repeat purchase rate',
      })
      .expect(201);

    expect(res.body.id).toBe(EXP);
    expect(res.body.status).toBe('DRAFT');
    expect(svc.createExperiment).toHaveBeenCalledWith(ORG, {
      title: 'Discount impact test',
      hypothesis: 'Offering a 10% discount increases repeat purchase rate',
    });
  });

  // ── List ──────────────────────────────────────────────────────────────────

  it('GET /experiments lists experiments for org', async () => {
    svc.listExperiments.mockResolvedValue({ experiments: [mockExperiment()], total: 1 });

    const res = await request(app.getHttpServer())
      .get(`/experiments?organizationId=${ORG}`)
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.experiments).toHaveLength(1);
    expect(svc.listExperiments).toHaveBeenCalledWith(ORG, {
      status: undefined,
      metric: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('GET /experiments filters by status', async () => {
    svc.listExperiments.mockResolvedValue({ experiments: [], total: 0 });

    await request(app.getHttpServer())
      .get(`/experiments?organizationId=${ORG}&status=RUNNING`)
      .expect(200);

    expect(svc.listExperiments).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ status: 'RUNNING' }),
    );
  });

  // ── Get ───────────────────────────────────────────────────────────────────

  it('GET /experiments/:id returns experiment detail with variants', async () => {
    svc.getExperiment.mockResolvedValue(mockExperiment());

    const res = await request(app.getHttpServer())
      .get(`/experiments/${EXP}?organizationId=${ORG}`)
      .expect(200);

    expect(res.body.id).toBe(EXP);
    expect(res.body.variants).toHaveLength(2);
  });

  // ── Launch ────────────────────────────────────────────────────────────────

  it('POST /experiments/:id/launch transitions experiment to RUNNING', async () => {
    const launched = { ...mockExperiment(), status: 'RUNNING', startDate: new Date().toISOString() };
    svc.launchExperiment.mockResolvedValue(launched);

    const res = await request(app.getHttpServer())
      .post(`/experiments/${EXP}/launch`)
      .send({ organizationId: ORG })
      .expect(200);

    expect(res.body.status).toBe('RUNNING');
    expect(res.body.startDate).toBeTruthy();
  });

  // ── Complete ──────────────────────────────────────────────────────────────

  it('POST /experiments/:id/complete transitions experiment to COMPLETED', async () => {
    const completed = { ...mockExperiment(), status: 'COMPLETED', endDate: new Date().toISOString() };
    svc.completeExperiment.mockResolvedValue(completed);

    const res = await request(app.getHttpServer())
      .post(`/experiments/${EXP}/complete`)
      .send({ organizationId: ORG })
      .expect(200);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.endDate).toBeTruthy();
  });

  // ── Add Variant ───────────────────────────────────────────────────────────

  it('POST /experiments/:id/variants adds a treatment variant', async () => {
    svc.addVariant.mockResolvedValue(VAR_TREATMENT);

    const res = await request(app.getHttpServer())
      .post(`/experiments/${EXP}/variants`)
      .send({ organizationId: ORG, name: 'Treatment A', description: 'Discount offer', isControl: false })
      .expect(201);

    expect(res.body.name).toBe('Treatment A');
    expect(res.body.isControl).toBe(false);
  });

  // ── Record Result ─────────────────────────────────────────────────────────

  it('POST /experiments/:id/results records a metric result', async () => {
    const result = {
      id: 'res-1',
      variantId: 'var-ctrl',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-07',
      metricValue: 120000,
      sampleSize: 200,
      createdAt: new Date().toISOString(),
    };
    svc.recordResult.mockResolvedValue(result);

    const res = await request(app.getHttpServer())
      .post(`/experiments/${EXP}/results`)
      .send({
        organizationId: ORG,
        variantId: 'var-ctrl',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-07',
        metricValue: 120000,
        sampleSize: 200,
      })
      .expect(201);

    expect(res.body.metricValue).toBe(120000);
    expect(res.body.sampleSize).toBe(200);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  it('GET /experiments/:id/stats returns uplift calculations', async () => {
    const stats = {
      variants: [
        { id: 'var-ctrl', name: 'Control', isControl: true, avgMetricValue: 100000, sampleSize: 200, resultsCount: 2 },
        { id: 'var-treat', name: 'Treatment A', isControl: false, avgMetricValue: 115000, sampleSize: 195, upliftPercent: 15, resultsCount: 2 },
      ],
    };
    svc.getExperimentStats.mockResolvedValue(stats);

    const res = await request(app.getHttpServer())
      .get(`/experiments/${EXP}/stats?organizationId=${ORG}`)
      .expect(200);

    expect(res.body.variants).toHaveLength(2);
    const treatment = res.body.variants.find((v: { isControl: boolean }) => !v.isControl);
    expect(treatment.upliftPercent).toBe(15);
  });
});

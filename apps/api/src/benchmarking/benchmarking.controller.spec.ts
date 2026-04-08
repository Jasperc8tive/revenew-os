import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { AlertMetric, Industry } from '@prisma/client';
import { BenchmarkAggregationService } from './benchmark-aggregation.service';
import { BenchmarkingController } from './benchmarking.controller';
import { BenchmarkingService } from './benchmarking.service';

describe('BenchmarkingController (e2e)', () => {
  let app: INestApplication;

  const benchmarkingServiceMock = {
    getBenchmarks: jest.fn(),
  };

  const benchmarkAggregationServiceMock = {
    aggregate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BenchmarkingController],
      providers: [
        {
          provide: BenchmarkingService,
          useValue: benchmarkingServiceMock,
        },
        {
          provide: BenchmarkAggregationService,
          useValue: benchmarkAggregationServiceMock,
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

  it('GET /benchmarks should return org vs industry metrics', async () => {
    benchmarkingServiceMock.getBenchmarks.mockImplementation(async () => ({
      organizationId: 'org-1',
      industry: Industry.FINTECH,
      metrics: [
        {
          metric: AlertMetric.CAC,
          organizationValue: 13400,
          industryMedian: 9800,
          delta: 3600,
          deltaPct: 36.73,
        },
      ],
    }));

    const response = await request(app.getHttpServer())
      .get('/benchmarks?organizationId=org-1&metric=CAC')
      .expect(200);

    expect(response.body.industry).toBe(Industry.FINTECH);
    expect(response.body.metrics[0].metric).toBe(AlertMetric.CAC);
  });

  it('POST /benchmarks/aggregate should aggregate benchmark rows', async () => {
    benchmarkAggregationServiceMock.aggregate.mockImplementation(async () => ({
      rowCount: 120,
      benchmarkCount: 8,
    }));

    const response = await request(app.getHttpServer())
      .post('/benchmarks/aggregate')
      .send({
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-31T23:59:59.999Z',
      })
      .expect(201);

    expect(response.body).toMatchObject({ rowCount: 120, benchmarkCount: 8 });
  });
});

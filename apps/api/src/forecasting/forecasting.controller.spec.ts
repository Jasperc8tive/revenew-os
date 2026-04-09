import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { ForecastingController } from './forecasting.controller';
import { ForecastingService } from './forecasting.service';

describe('ForecastingController (e2e)', () => {
  let app: INestApplication;

  const forecastingServiceMock = {
    simulate: jest.fn(),
    simulateScenarios: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ForecastingController],
      providers: [
        {
          provide: ForecastingService,
          useValue: forecastingServiceMock,
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

  it('POST /forecasting/simulate returns baseline and scenario series', async () => {
    const mockResult = {
      organizationId: 'org-1',
      months: 6,
      multiplier: 1.1,
      baseline: [
        { period: '2026-05', value: 500000 },
        { period: '2026-06', value: 510000 },
      ],
      scenario: [
        { period: '2026-05', value: 550000 },
        { period: '2026-06', value: 561000 },
      ],
      summary: {
        baselineTotal: 1010000,
        scenarioTotal: 1111000,
        deltaRevenue: 101000,
        deltaRevenuePct: 10,
      },
    };

    forecastingServiceMock.simulate.mockImplementation(async () => mockResult);

    const response = await request(app.getHttpServer())
      .post('/forecasting/simulate')
      .send({ organizationId: 'org-1', months: 6, marketingSpendDeltaPct: 10 })
      .expect(201);

    expect(response.body.baseline).toHaveLength(2);
    expect(response.body.scenario).toHaveLength(2);
    expect(response.body.summary.deltaRevenuePct).toBe(10);
  });

  it('POST /forecasting/simulate rejects invalid months value', async () => {
    await request(app.getHttpServer())
      .post('/forecasting/simulate')
      .send({ organizationId: 'org-1', months: 50 }) // exceeds Max(24)
      .expect(400);
  });

  it('POST /forecasting/scenarios returns multiple confidence-tagged scenarios', async () => {
    forecastingServiceMock.simulateScenarios.mockImplementation(async () => ({
      organizationId: 'org-1',
      scenarios: [
        { name: 'conservative', confidence: 'high', deltaPct: 3.2 },
        { name: 'aggressive', confidence: 'medium', deltaPct: 18.5 },
      ],
      recommendationLinks: [{ id: 'rec-1', recommendation: 'Expand offer bundling' }],
    }));

    const response = await request(app.getHttpServer())
      .post('/forecasting/scenarios')
      .send({ organizationId: 'org-1', months: 6 })
      .expect(201);

    expect(response.body.scenarios).toHaveLength(2);
    expect(response.body.recommendationLinks[0].id).toBe('rec-1');
  });

  it('POST /forecasting/scenarios validates numeric scenario controls', async () => {
    await request(app.getHttpServer())
      .post('/forecasting/scenarios')
      .send({ organizationId: 'org-1', conversionRateDeltaPct: 'bad-value' })
      .expect(400);
  });
});

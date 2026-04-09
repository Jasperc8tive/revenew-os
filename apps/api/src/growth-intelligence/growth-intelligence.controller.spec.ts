import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { GrowthIntelligenceController } from './growth-intelligence.controller';
import { GrowthIntelligenceService } from './growth-intelligence.service';

describe('GrowthIntelligenceController (e2e)', () => {
  let app: INestApplication;

  const serviceMock = {
    buildGraph: jest.fn(),
    getStrategicContext: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    serviceMock.buildGraph.mockImplementation(async () => ({
      organizationId: 'org-1',
      nodes: [{ id: 'org:org-1', type: 'organization', label: 'Org 1' }],
      edges: [],
      summary: { nodeCount: 1, edgeCount: 0, recommendationsLinked: 0 },
    }));

    serviceMock.getStrategicContext.mockImplementation(async () => ({
      organizationId: 'org-1',
      strategicHighlights: [{ id: 'recommendation:1', score: 0.82 }],
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GrowthIntelligenceController],
      providers: [{ provide: GrowthIntelligenceService, useValue: serviceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /growth-intelligence/graph returns graph entities and relationships', async () => {
    const response = await request(app.getHttpServer())
      .get('/growth-intelligence/graph?organizationId=org-1')
      .expect(200);

    expect(response.body.organizationId).toBe('org-1');
    expect(response.body.summary.nodeCount).toBe(1);
  });

  it('GET /growth-intelligence/context returns graph-backed strategic context', async () => {
    const response = await request(app.getHttpServer())
      .get('/growth-intelligence/context?organizationId=org-1')
      .expect(200);

    expect(response.body.strategicHighlights).toHaveLength(1);
  });
});

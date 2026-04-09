import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { RecommendationStatus } from '@prisma/client';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { BillingAccessService } from '../billing/billing-access.service';

describe('RecommendationsController (e2e)', () => {
  let app: INestApplication;

  const recommendationsServiceMock = {
    listRecommendations: jest.fn(),
    evaluateGuardrails: jest.fn(),
    transitionRecommendationStatus: jest.fn(),
  };

  const billingAccessMock = {
    assertFeatureAccess: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    billingAccessMock.assertFeatureAccess.mockImplementation(async () => undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        { provide: RecommendationsService, useValue: recommendationsServiceMock },
        { provide: BillingAccessService, useValue: billingAccessMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /recommendations', () => {
    it('returns the list for the given organization', async () => {
      recommendationsServiceMock.listRecommendations.mockImplementation(async () => [
        { id: 'rec-1', organizationId: 'org-1', recommendation: 'Expand acquisition', status: RecommendationStatus.PENDING },
        { id: 'rec-2', organizationId: 'org-1', recommendation: 'Cut CAC', status: RecommendationStatus.ACCEPTED },
      ]);

      const response = await request(app.getHttpServer())
        .get('/recommendations')
        .query({ organizationId: 'org-1' })
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('rec-1');
    });

    it('enforces analytics.full billing gate', async () => {
      recommendationsServiceMock.listRecommendations.mockImplementation(async () => []);

      await request(app.getHttpServer())
        .get('/recommendations')
        .query({ organizationId: 'org-1' })
        .expect(200);

      expect(billingAccessMock.assertFeatureAccess).toHaveBeenCalledWith('org-1', 'analytics.full');
    });

    it('passes status filter to the service when provided', async () => {
      recommendationsServiceMock.listRecommendations.mockImplementation(async () => []);

      await request(app.getHttpServer())
        .get('/recommendations')
        .query({ organizationId: 'org-1', status: RecommendationStatus.ACCEPTED })
        .expect(200);

      expect(recommendationsServiceMock.listRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ status: RecommendationStatus.ACCEPTED }),
      );
    });

    it('passes limit to the service when provided', async () => {
      recommendationsServiceMock.listRecommendations.mockImplementation(async () => []);

      await request(app.getHttpServer())
        .get('/recommendations')
        .query({ organizationId: 'org-1', limit: 10 })
        .expect(200);

      expect(recommendationsServiceMock.listRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
      );
    });
  });

  describe('PATCH /recommendations/:id/status', () => {
    it('transitions recommendation status and returns result', async () => {
      recommendationsServiceMock.transitionRecommendationStatus.mockImplementation(async () => ({
        id: 'rec-1',
        status: RecommendationStatus.ACCEPTED,
      }));

      const response = await request(app.getHttpServer())
        .patch('/recommendations/rec-1/status')
        .send({ organizationId: 'org-1', status: RecommendationStatus.ACCEPTED })
        .expect(200);

      expect(response.body.status).toBe(RecommendationStatus.ACCEPTED);
    });

    it('enforces analytics.full billing gate before transition', async () => {
      recommendationsServiceMock.transitionRecommendationStatus.mockImplementation(async () => ({ id: 'rec-1' }));

      await request(app.getHttpServer())
        .patch('/recommendations/rec-1/status')
        .send({ organizationId: 'org-1', status: RecommendationStatus.REJECTED })
        .expect(200);

      expect(billingAccessMock.assertFeatureAccess).toHaveBeenCalledWith('org-1', 'analytics.full');
    });

    it('forwards recommendationId from the route param to the service', async () => {
      recommendationsServiceMock.transitionRecommendationStatus.mockImplementation(async () => ({ id: 'rec-99' }));

      await request(app.getHttpServer())
        .patch('/recommendations/rec-99/status')
        .send({ organizationId: 'org-1', status: RecommendationStatus.APPLIED })
        .expect(200);

      expect(recommendationsServiceMock.transitionRecommendationStatus).toHaveBeenCalledWith(
        expect.objectContaining({ recommendationId: 'rec-99' }),
      );
    });

    it('passes impactSummary to the service when provided', async () => {
      recommendationsServiceMock.transitionRecommendationStatus.mockImplementation(async () => ({ id: 'rec-1' }));

      await request(app.getHttpServer())
        .patch('/recommendations/rec-1/status')
        .send({
          organizationId: 'org-1',
          status: RecommendationStatus.APPLIED,
          impactSummary: 'Churn dropped 5% after implementation',
        })
        .expect(200);

      expect(recommendationsServiceMock.transitionRecommendationStatus).toHaveBeenCalledWith(
        expect.objectContaining({ impactSummary: 'Churn dropped 5% after implementation' }),
      );
    });
  });
});

import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { IntegrationProvider, IntegrationStatus, IntegrationSyncStatus } from '@prisma/client';
import request = require('supertest');
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { ConnectorsService } from '../connectors/connectors.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationCryptoService } from './services/integration-crypto.service';
import { IntegrationMonitoringService } from './services/integration-monitoring.service';
import { OnboardingService } from '../onboarding/onboarding.service';

describe('IntegrationsController (e2e)', () => {
  let app: INestApplication;
  const asyncMock = <T = unknown>() => jest.fn<(...args: unknown[]) => Promise<T>>();

  const queueMock = {
    add: asyncMock(),
  };

  const connectorMock = {
    authenticate: asyncMock(),
  };

  const connectorsServiceMock = {
    getConnector: jest.fn(() => connectorMock),
  };

  const billingAccessServiceMock = {
    assertFeatureAccess: jest.fn(async () => undefined),
  };

  const onboardingServiceMock = {
    markMilestone: jest.fn(async () => undefined),
  };

  const prismaMock = {
    integration: {
      upsert: asyncMock(),
      findMany: asyncMock(),
      findFirst: asyncMock(),
      update: asyncMock(),
    },
    integrationCredential: {
      create: asyncMock(),
    },
    integrationSyncLog: {
      create: asyncMock(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    connectorMock.authenticate.mockImplementation(async () => ({
      success: true,
      accessToken: 'validated-access-token',
      refreshToken: 'validated-refresh-token',
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        IntegrationsService,
        IntegrationMonitoringService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConnectorsService,
          useValue: connectorsServiceMock,
        },
        {
          provide: BillingAccessService,
          useValue: billingAccessServiceMock,
        },
        {
          provide: OnboardingService,
          useValue: onboardingServiceMock,
        },
        {
          provide: IntegrationCryptoService,
          useValue: {
            encrypt: (value: string) => `enc(${value})`,
            decrypt: (value: string) => value,
          },
        },
        {
          provide: getQueueToken('integration-sync'),
          useValue: queueMock,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /integrations/connect should create/update an integration', async () => {
    prismaMock.integration.upsert.mockImplementation(async () => ({
      id: 'integration-1',
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integrationCredential.create.mockImplementation(async () => ({}));
    prismaMock.integrationSyncLog.create.mockImplementation(async () => ({}));

    const response = await request(app.getHttpServer())
      .post('/integrations/connect')
      .send({
        organizationId: 'org-1',
        provider: 'GOOGLE_ADS',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'integration-1',
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationStatus.ACTIVE,
      authentication: {
        success: true,
        accessToken: 'validated-access-token',
        refreshToken: 'validated-refresh-token',
      },
    });

    expect(prismaMock.integration.upsert).toHaveBeenCalled();
    expect(prismaMock.integrationCredential.create).toHaveBeenCalled();
    expect(prismaMock.integrationSyncLog.create).toHaveBeenCalled();
  });

  it('GET /integrations should list integrations with health', async () => {
    prismaMock.integration.findMany.mockImplementation(async () => [
      {
        id: 'integration-1',
        provider: IntegrationProvider.GOOGLE_ADS,
        status: IntegrationStatus.ACTIVE,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        syncLogs: [
          {
            status: IntegrationSyncStatus.SUCCESS,
            syncedAt: new Date('2026-01-02T10:00:00.000Z'),
            errorMessage: null,
          },
        ],
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/integrations?organizationId=org-1')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 'integration-1',
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationStatus.ACTIVE,
      lastSyncStatus: IntegrationSyncStatus.SUCCESS,
      health: {
        status: 'healthy',
      },
    });
  });

  it('POST /integrations/:id/sync should enqueue a sync job', async () => {
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      id: 'integration-1',
      organizationId: 'org-1',
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationStatus.ACTIVE,
    }));
    queueMock.add.mockImplementation(async () => ({ id: 'job-1' }));

    const response = await request(app.getHttpServer())
      .post('/integrations/integration-1/sync')
      .send({ organizationId: 'org-1', initiatedBy: 'tester' })
      .expect(201);

    expect(response.body).toEqual({
      integrationId: 'integration-1',
      queued: true,
    });

    expect(queueMock.add).toHaveBeenCalledWith(
      'sync-integration',
      expect.objectContaining({
        organizationId: 'org-1',
        integrationId: 'integration-1',
      }),
      expect.any(Object),
    );
  });

  it('DELETE /integrations/:id should set integration status to inactive', async () => {
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      id: 'integration-1',
      organizationId: 'org-1',
    }));
    prismaMock.integration.update.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.INACTIVE,
    }));

    const response = await request(app.getHttpServer())
      .delete('/integrations/integration-1?organizationId=org-1')
      .expect(200);

    expect(response.body).toEqual({
      id: 'integration-1',
      disconnected: true,
    });
  });
});

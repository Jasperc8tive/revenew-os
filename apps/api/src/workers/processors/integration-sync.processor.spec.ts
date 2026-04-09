import { describe, expect, it, jest } from '@jest/globals';
import { IntegrationProvider, IntegrationStatus, IntegrationSyncStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConnectorsService } from '../../connectors/connectors.service';
import { DataQualityService } from '../../data-quality/data-quality.service';
import { IntegrationCryptoService } from '../../integrations/services/integration-crypto.service';
import { IntegrationSyncProcessor } from './integration-sync.processor';

describe('IntegrationSyncProcessor', () => {
  it('persists normalized marketing records and writes sync log', async () => {
    const asyncMock = <T = unknown>() => jest.fn<(...args: unknown[]) => Promise<T>>();

    const transactionClient = {
      marketingChannel: {
        upsert: asyncMock(),
      },
      marketingCampaign: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      marketingMetric: {
        create: asyncMock(),
      },
      revenueEvent: {
        create: asyncMock(),
      },
      customer: {
        upsert: asyncMock(),
      },
      customerEvent: {
        create: asyncMock(),
      },
      salesPipeline: {
        upsert: asyncMock(),
      },
      dealStage: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      deal: {
        create: asyncMock(),
      },
    };

    transactionClient.marketingChannel.upsert.mockImplementation(async () => ({ id: 'channel-1' }));
    transactionClient.marketingCampaign.findFirst.mockImplementation(async () => null);
    transactionClient.marketingCampaign.create.mockImplementation(async () => ({ id: 'campaign-1' }));
    transactionClient.marketingMetric.create.mockImplementation(async () => ({ id: 'metric-1' }));

    const prismaMock = {
      integrationCredential: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integration: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integrationSyncLog: {
        create: asyncMock(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    };

    prismaMock.integrationCredential.findFirst.mockImplementation(async () => ({
          id: 'credential-1',
          encryptedToken: 'enc(access-token)',
          refreshToken: 'enc(refresh-token)',
          createdAt: new Date(),
        }));
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integration.update.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integrationSyncLog.create.mockImplementation(async () => ({
      id: 'sync-log-1',
      status: IntegrationSyncStatus.SUCCESS,
    }));

    const connector = {
      setCredentials: jest.fn(),
      sync: asyncMock(),
      getCredentialState: jest.fn(() => ({ accessToken: 'access-token', refreshToken: 'refresh-token' })),
    };

    connector.sync.mockImplementation(async () => ({
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationSyncStatus.SUCCESS,
      records: [
        {
          recordType: 'marketingMetric' as const,
          campaignName: 'Growth Campaign',
          channelName: 'Google Ads',
          impressions: 1200,
          clicks: 80,
          cost: 45000,
          conversions: 5,
          date: new Date().toISOString(),
        },
      ],
      syncedAt: new Date().toISOString(),
      health: 'healthy' as const,
    }));

    const connectorsServiceMock = {
      getConnector: jest.fn().mockReturnValue(connector),
    } as unknown as ConnectorsService;

    const cryptoServiceMock = {
      decrypt: jest.fn((value: string) => value.replace('enc(', '').replace(')', '')),
      encrypt: jest.fn((value: string) => `enc(${value})`),
    } as unknown as IntegrationCryptoService;

    const processor = new IntegrationSyncProcessor(
      prismaMock as unknown as PrismaService,
      connectorsServiceMock,
      cryptoServiceMock,
      {
        logValidationIssue: jest.fn(),
      } as unknown as DataQualityService,
    );

    await processor.process({
      data: {
        organizationId: 'org-1',
        integrationId: 'integration-1',
        provider: IntegrationProvider.GOOGLE_ADS,
      },
    } as never);

    expect(connector.setCredentials).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(transactionClient.marketingMetric.create).toHaveBeenCalled();
    expect(prismaMock.integrationSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          status: IntegrationSyncStatus.SUCCESS,
        }),
      }),
    );
  });

  it('writes PARTIAL sync when invalid records are rejected', async () => {
    const asyncMock = <T = unknown>() => jest.fn<(...args: unknown[]) => Promise<T>>();

    const transactionClient = {
      marketingChannel: {
        upsert: asyncMock(),
      },
      marketingCampaign: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      marketingMetric: {
        create: asyncMock(),
      },
      revenueEvent: {
        create: asyncMock(),
      },
      customer: {
        upsert: asyncMock(),
      },
      customerEvent: {
        create: asyncMock(),
      },
      salesPipeline: {
        upsert: asyncMock(),
      },
      dealStage: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      deal: {
        create: asyncMock(),
      },
    };

    transactionClient.marketingChannel.upsert.mockImplementation(async () => ({ id: 'channel-1' }));
    transactionClient.marketingCampaign.findFirst.mockImplementation(async () => null);
    transactionClient.marketingCampaign.create.mockImplementation(async () => ({ id: 'campaign-1' }));
    transactionClient.marketingMetric.create.mockImplementation(async () => ({ id: 'metric-1' }));

    const prismaMock = {
      integrationCredential: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integration: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integrationSyncLog: {
        create: asyncMock(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    };

    prismaMock.integrationCredential.findFirst.mockImplementation(async () => ({
      id: 'credential-1',
      encryptedToken: 'enc(access-token)',
      refreshToken: 'enc(refresh-token)',
      createdAt: new Date(),
    }));
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integration.update.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integrationSyncLog.create.mockImplementation(async () => ({
      id: 'sync-log-1',
      status: IntegrationSyncStatus.PARTIAL,
    }));

    const connector = {
      setCredentials: jest.fn(),
      sync: asyncMock(),
      getCredentialState: jest.fn(() => ({ accessToken: 'access-token', refreshToken: 'refresh-token' })),
    };

    connector.sync.mockImplementation(async () => ({
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationSyncStatus.SUCCESS,
      records: [
        {
          recordType: 'marketingMetric' as const,
          campaignName: 'Growth Campaign',
          channelName: 'Google Ads',
          impressions: 1200,
          clicks: 80,
          cost: 45000,
          conversions: 5,
          date: new Date().toISOString(),
        },
        {
          recordType: 'marketingMetric' as const,
          campaignName: 'Broken Campaign',
          channelName: 'Google Ads',
          impressions: 100,
          clicks: 200,
          cost: 1000,
          conversions: 1,
          date: new Date().toISOString(),
        },
      ],
      syncedAt: new Date().toISOString(),
      health: 'healthy' as const,
    }));

    const connectorsServiceMock = {
      getConnector: jest.fn().mockReturnValue(connector),
    } as unknown as ConnectorsService;

    const cryptoServiceMock = {
      decrypt: jest.fn((value: string) => value.replace('enc(', '').replace(')', '')),
      encrypt: jest.fn((value: string) => `enc(${value})`),
    } as unknown as IntegrationCryptoService;

    const processor = new IntegrationSyncProcessor(
      prismaMock as unknown as PrismaService,
      connectorsServiceMock,
      cryptoServiceMock,
      {
        logValidationIssue: jest.fn(),
      } as unknown as DataQualityService,
    );

    await processor.process({
      data: {
        organizationId: 'org-1',
        integrationId: 'integration-1',
        provider: IntegrationProvider.GOOGLE_ADS,
      },
    } as never);

    expect(transactionClient.marketingMetric.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.integrationSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          status: IntegrationSyncStatus.PARTIAL,
          errorMessage: expect.stringContaining('Validation rejected 1/2 records'),
        }),
      }),
    );
  });

  it('writes FAILED sync when all records are invalid', async () => {
    const asyncMock = <T = unknown>() => jest.fn<(...args: unknown[]) => Promise<T>>();

    const transactionClient = {
      marketingChannel: {
        upsert: asyncMock(),
      },
      marketingCampaign: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      marketingMetric: {
        create: asyncMock(),
      },
      revenueEvent: {
        create: asyncMock(),
      },
      customer: {
        upsert: asyncMock(),
      },
      customerEvent: {
        create: asyncMock(),
      },
      salesPipeline: {
        upsert: asyncMock(),
      },
      dealStage: {
        findFirst: asyncMock(),
        create: asyncMock(),
      },
      deal: {
        create: asyncMock(),
      },
    };

    const prismaMock = {
      integrationCredential: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integration: {
        findFirst: asyncMock(),
        update: asyncMock(),
      },
      integrationSyncLog: {
        create: asyncMock(),
      },
      $transaction: jest.fn(async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
      ),
    };

    prismaMock.integrationCredential.findFirst.mockImplementation(async () => ({
      id: 'credential-1',
      encryptedToken: 'enc(access-token)',
      refreshToken: 'enc(refresh-token)',
      createdAt: new Date(),
    }));
    prismaMock.integration.findFirst.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ACTIVE,
    }));
    prismaMock.integration.update.mockImplementation(async () => ({
      id: 'integration-1',
      status: IntegrationStatus.ERROR,
    }));
    prismaMock.integrationSyncLog.create.mockImplementation(async () => ({
      id: 'sync-log-1',
      status: IntegrationSyncStatus.FAILED,
    }));

    const connector = {
      setCredentials: jest.fn(),
      sync: asyncMock(),
      getCredentialState: jest.fn(() => ({ accessToken: 'access-token', refreshToken: 'refresh-token' })),
    };

    connector.sync.mockImplementation(async () => ({
      provider: IntegrationProvider.GOOGLE_ADS,
      status: IntegrationSyncStatus.SUCCESS,
      records: [
        {
          recordType: 'revenueEvent' as const,
          amount: 0,
          currency: 'NGN',
          eventType: 'payment',
          timestamp: new Date().toISOString(),
        },
      ],
      syncedAt: new Date().toISOString(),
      health: 'healthy' as const,
    }));

    const connectorsServiceMock = {
      getConnector: jest.fn().mockReturnValue(connector),
    } as unknown as ConnectorsService;

    const cryptoServiceMock = {
      decrypt: jest.fn((value: string) => value.replace('enc(', '').replace(')', '')),
      encrypt: jest.fn((value: string) => `enc(${value})`),
    } as unknown as IntegrationCryptoService;

    const processor = new IntegrationSyncProcessor(
      prismaMock as unknown as PrismaService,
      connectorsServiceMock,
      cryptoServiceMock,
      {
        logValidationIssue: jest.fn(),
      } as unknown as DataQualityService,
    );

    await processor.process({
      data: {
        organizationId: 'org-1',
        integrationId: 'integration-1',
        provider: IntegrationProvider.GOOGLE_ADS,
      },
    } as never);

    expect(transactionClient.marketingMetric.create).not.toHaveBeenCalled();
    expect(transactionClient.revenueEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: IntegrationStatus.ERROR,
        }),
      }),
    );
    expect(prismaMock.integrationSyncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrationId: 'integration-1',
          status: IntegrationSyncStatus.FAILED,
          errorMessage: expect.stringContaining('Validation rejected 1/1 records'),
        }),
      }),
    );
  });
});

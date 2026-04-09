import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationStatus, IntegrationSyncStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConnectorsService } from '../connectors/connectors.service';
import { ConnectIntegrationDto } from './dto/connect-integration.dto';
import { IntegrationCryptoService } from './services/integration-crypto.service';
import { IntegrationMonitoringService } from './services/integration-monitoring.service';
import { ConnectorSyncResult } from './types/integration.types';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorsService: ConnectorsService,
    private readonly integrationCryptoService: IntegrationCryptoService,
    private readonly monitoringService: IntegrationMonitoringService,
    @InjectQueue('integration-sync') private readonly integrationSyncQueue: Queue,
  ) {}

  async connect(dto: ConnectIntegrationDto) {
    const encryptedAccessToken = this.integrationCryptoService.encrypt(dto.accessToken);
    const encryptedRefreshToken = dto.refreshToken
      ? this.integrationCryptoService.encrypt(dto.refreshToken)
      : undefined;

    const integration = await this.prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId: dto.organizationId,
          provider: dto.provider,
        },
      },
      update: {
        status: IntegrationStatus.ACTIVE,
        updatedAt: new Date(),
      },
      create: {
        organizationId: dto.organizationId,
        provider: dto.provider,
        status: IntegrationStatus.ACTIVE,
      },
    });

    await this.prisma.integrationCredential.create({
      data: {
        integrationId: integration.id,
        encryptedToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      },
    });

    const connector = this.connectorsService.getConnector(dto.provider);
    const authResult = await connector.authenticate({
      accessToken: dto.accessToken,
      refreshToken: dto.refreshToken,
      metadata: dto.metadata,
    });

    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: authResult.success
          ? IntegrationSyncStatus.SUCCESS
          : IntegrationSyncStatus.FAILED,
        syncedAt: new Date(),
        errorMessage: authResult.errorMessage,
      },
    });

    return {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      authentication: authResult,
    };
  }

  async list(organizationId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: { organizationId },
      include: {
        syncLogs: {
          take: 1,
          orderBy: { syncedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((integration) => {
      const lastResult: ConnectorSyncResult | undefined = integration.syncLogs[0]
        ? {
            provider: integration.provider,
            status: integration.syncLogs[0].status,
            records: [],
            syncedAt: integration.syncLogs[0].syncedAt.toISOString(),
            health:
              integration.syncLogs[0].status === IntegrationSyncStatus.FAILED
                ? ('error' as const)
                : ('healthy' as const),
            errorMessage: integration.syncLogs[0].errorMessage ?? undefined,
          }
        : undefined;

      return {
        id: integration.id,
        provider: integration.provider,
        status: integration.status,
        connectedAt: integration.createdAt.toISOString(),
        lastSyncAt: integration.syncLogs[0]?.syncedAt?.toISOString(),
        lastSyncStatus: integration.syncLogs[0]?.status,
        health: this.monitoringService.evaluateHealth(lastResult),
      };
    });
  }

  async disconnect(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        organizationId,
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found.');
    }

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: IntegrationStatus.INACTIVE,
        updatedAt: new Date(),
      },
    });

    return {
      id: integrationId,
      disconnected: true,
    };
  }

  async enqueueSync(organizationId: string, integrationId: string, initiatedBy?: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, organizationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found.');
    }

    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Only active integrations can be synced.');
    }

    await this.integrationSyncQueue.add(
      'sync-integration',
      {
        organizationId,
        integrationId,
        provider: integration.provider,
        initiatedBy,
      },
      {
        jobId: `sync:${organizationId}:${integrationId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30_000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return {
      integrationId,
      queued: true,
    };
  }
}

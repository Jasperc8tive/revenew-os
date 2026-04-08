import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  CampaignStatus,
  CurrencyCode,
  CustomerEventType,
  DealStageType,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationSyncStatus,
  MarketingChannelType,
  Prisma,
  RevenueEventType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConnectorsService } from '../../connectors/connectors.service';
import { DataQualityService } from '../../data-quality/data-quality.service';
import { IntegrationCryptoService } from '../../integrations/services/integration-crypto.service';
import {
  ConnectorSyncResult,
  NormalizedCustomerEvent,
  NormalizedMarketingMetric,
  NormalizedRecord,
  NormalizedRecordValidationSummary,
  NormalizedRevenueEvent,
  NormalizedSalesPipelineEvent,
} from '../../integrations/types/integration.types';

@Injectable()
@Processor('integration-sync')
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorsService: ConnectorsService,
    private readonly cryptoService: IntegrationCryptoService,
    private readonly dataQualityService: DataQualityService,
  ) {
    super();
  }

  async process(
    job: Job<{ organizationId: string; integrationId: string; provider: IntegrationProvider }>,
  ) {
    const connector = this.connectorsService.getConnector(job.data.provider);
    const credential = await this.prisma.integrationCredential.findFirst({
      where: {
        integrationId: job.data.integrationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!credential) {
      throw new Error(`No credentials found for integration ${job.data.integrationId}.`);
    }

    const decryptedAccessToken = this.cryptoService.decrypt(credential.encryptedToken);
    const decryptedRefreshToken = credential.refreshToken
      ? this.cryptoService.decrypt(credential.refreshToken)
      : undefined;

    connector.setCredentials({
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
    });

    const result = await connector.sync();
    const validationSummary = this.validateRecords(result.records);
    const filteredRecords = result.records.filter((_, index) =>
      !validationSummary.issues.some((issue) => issue.index === index),
    );

    const finalStatus =
      result.records.length > 0 && filteredRecords.length === 0
        ? IntegrationSyncStatus.FAILED
        : validationSummary.rejected > 0 && result.status === IntegrationSyncStatus.SUCCESS
          ? IntegrationSyncStatus.PARTIAL
          : result.status;

    const finalResult: ConnectorSyncResult = {
      ...result,
      status: finalStatus,
      records: filteredRecords,
      errorMessage: this.buildResultMessage(result.errorMessage, validationSummary),
    };
    const updatedCredentials = connector.getCredentialState();

    if (
      updatedCredentials?.accessToken &&
      (updatedCredentials.accessToken !== decryptedAccessToken ||
        updatedCredentials.refreshToken !== decryptedRefreshToken)
    ) {
      await this.prisma.integrationCredential.update({
        where: {
          id: credential.id,
        },
        data: {
          encryptedToken: this.cryptoService.encrypt(updatedCredentials.accessToken),
          refreshToken: updatedCredentials.refreshToken
            ? this.cryptoService.encrypt(updatedCredentials.refreshToken)
            : null,
          updatedAt: new Date(),
        },
      });
    }

    try {
      if (finalResult.status !== IntegrationSyncStatus.FAILED) {
        await this.persistRecords(
          job.data.organizationId,
          job.data.integrationId,
          job.data.provider,
          finalResult.records,
        );
      }

      await this.prisma.integration.update({
        where: { id: job.data.integrationId },
        data: {
          status:
            finalResult.status === IntegrationSyncStatus.FAILED
              ? IntegrationStatus.ERROR
              : IntegrationStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });

      await this.writeSyncLog(job.data.integrationId, finalResult);

      if (validationSummary.rejected > 0) {
        await this.dataQualityService.logValidationIssue({
          organizationId: job.data.organizationId,
          integrationId: job.data.integrationId,
          rejectedCount: validationSummary.rejected,
          totalCount: validationSummary.total,
          issues: validationSummary.issues,
        });

        this.logger.warn(
          `Validation rejected ${validationSummary.rejected}/${validationSummary.total} records for integration ${job.data.integrationId}`,
        );
      }

      return finalResult;
    } catch (error) {
      const failureResult: ConnectorSyncResult = {
        provider: job.data.provider,
        status: IntegrationSyncStatus.FAILED,
        records: [],
        syncedAt: new Date().toISOString(),
        health: 'error',
        errorMessage: error instanceof Error ? error.message : 'Failed to persist sync result.',
      };

      await this.prisma.integration.update({
        where: { id: job.data.integrationId },
        data: {
          status: IntegrationStatus.ERROR,
          updatedAt: new Date(),
        },
      });

      await this.writeSyncLog(job.data.integrationId, failureResult);

      throw error;
    }
  }

  private async writeSyncLog(integrationId: string, result: ConnectorSyncResult) {
    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId,
        status: result.status,
        syncedAt: new Date(result.syncedAt),
        errorMessage: result.errorMessage,
      },
    });
  }

  private async persistRecords(
    organizationId: string,
    integrationId: string,
    provider: IntegrationProvider,
    records: NormalizedRecord[],
  ) {
    await this.prisma.$transaction(async (transaction) => {
      for (const record of records) {
        switch (record.recordType) {
          case 'marketingMetric':
            await this.persistMarketingMetric(transaction, organizationId, integrationId, record);
            break;
          case 'revenueEvent':
            await this.persistRevenueEvent(transaction, organizationId, provider, record);
            break;
          case 'customerEvent':
            await this.persistCustomerEvent(transaction, organizationId, provider, record);
            break;
          case 'salesPipelineEvent':
            await this.persistSalesPipelineEvent(transaction, organizationId, record);
            break;
        }
      }
    });
  }

  private validateRecords(records: NormalizedRecord[]): NormalizedRecordValidationSummary {
    const issues: NormalizedRecordValidationSummary['issues'] = [];
    const seenRecordKeys = new Set<string>();

    records.forEach((record, index) => {
      const duplicateKey = this.getDuplicateKey(record);
      if (seenRecordKeys.has(duplicateKey)) {
        issues.push({
          index,
          recordType: record.recordType,
          reason: 'Duplicate record detected in sync batch',
        });
        return;
      }
      seenRecordKeys.add(duplicateKey);

      const reason = this.validateRecord(record);
      if (reason) {
        issues.push({
          index,
          recordType: record.recordType,
          reason,
        });
      }
    });

    return {
      total: records.length,
      accepted: records.length - issues.length,
      rejected: issues.length,
      issues,
    };
  }

  private validateRecord(record: NormalizedRecord): string | null {
    if (record.recordType === 'marketingMetric') {
      if (!record.channelName.trim() || !record.campaignName.trim()) {
        return 'Marketing metric must include non-empty channel and campaign names';
      }

      if (
        !this.isNonNegativeNumber(record.impressions) ||
        !this.isNonNegativeNumber(record.clicks) ||
        !this.isNonNegativeNumber(record.cost) ||
        !this.isNonNegativeNumber(record.conversions)
      ) {
        return 'Marketing metric numeric fields must be finite and non-negative';
      }

      if (record.clicks > record.impressions) {
        return 'Clicks cannot exceed impressions';
      }

      if (record.conversions > record.clicks) {
        return 'Conversions cannot exceed clicks';
      }

      if (!this.isValidTimestamp(record.date)) {
        return 'Marketing metric date is invalid';
      }

      return null;
    }

    if (record.recordType === 'revenueEvent') {
      if (!record.eventType.trim()) {
        return 'Revenue event type is required';
      }

      if (!record.currency.trim()) {
        return 'Revenue event currency is required';
      }

      if (!Number.isFinite(record.amount) || record.amount <= 0) {
        return 'Revenue event amount must be a positive number';
      }

      if (!this.isValidTimestamp(record.timestamp)) {
        return 'Revenue event timestamp is invalid';
      }

      return null;
    }

    if (record.recordType === 'customerEvent') {
      if (!record.customerExternalId.trim()) {
        return 'Customer event must include a customer external id';
      }

      if (!record.eventType.trim()) {
        return 'Customer event type is required';
      }

      if (!this.isValidTimestamp(record.timestamp)) {
        return 'Customer event timestamp is invalid';
      }

      return null;
    }

    if (!record.pipelineName.trim() || !record.stageName.trim()) {
      return 'Sales pipeline event must include pipeline and stage names';
    }

    if (!this.isNonNegativeNumber(record.value)) {
      return 'Sales pipeline value must be finite and non-negative';
    }

    if (!Number.isFinite(record.probability) || record.probability < 0 || record.probability > 1) {
      return 'Sales pipeline probability must be between 0 and 1';
    }

    if (record.closeDate && !this.isValidTimestamp(record.closeDate)) {
      return 'Sales pipeline closeDate is invalid';
    }

    return null;
  }

  private isNonNegativeNumber(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  private isValidTimestamp(value: string): boolean {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return false;
    }

    const now = Date.now();
    const maxFutureDriftMs = 24 * 60 * 60 * 1000;
    return timestamp <= now + maxFutureDriftMs;
  }

  private getDuplicateKey(record: NormalizedRecord): string {
    if (record.recordType === 'marketingMetric') {
      return [
        record.recordType,
        record.channelName,
        record.campaignName,
        record.date,
        record.impressions,
        record.clicks,
        record.cost,
        record.conversions,
      ].join('|');
    }

    if (record.recordType === 'revenueEvent') {
      return [
        record.recordType,
        record.customerExternalId ?? '',
        record.amount,
        record.currency,
        record.eventType,
        record.timestamp,
      ].join('|');
    }

    if (record.recordType === 'customerEvent') {
      return [
        record.recordType,
        record.customerExternalId,
        record.eventType,
        record.timestamp,
      ].join('|');
    }

    return [
      record.recordType,
      record.pipelineName,
      record.stageName,
      record.value,
      record.probability,
      record.closeDate ?? '',
    ].join('|');
  }

  private buildResultMessage(
    initialMessage: string | undefined,
    validationSummary: NormalizedRecordValidationSummary,
  ): string | undefined {
    const validationMessage =
      validationSummary.rejected > 0
        ? `Validation rejected ${validationSummary.rejected}/${validationSummary.total} records`
        : undefined;

    if (initialMessage && validationMessage) {
      return `${initialMessage}; ${validationMessage}`;
    }

    return initialMessage ?? validationMessage;
  }

  private async persistMarketingMetric(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    integrationId: string,
    record: NormalizedMarketingMetric,
  ) {
    const channel = await transaction.marketingChannel.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: record.channelName,
        },
      },
      update: {
        integrationId,
      },
      create: {
        organizationId,
        integrationId,
        name: record.channelName,
        type: this.mapMarketingChannelType(record.channelName),
      },
    });

    const existingCampaign = await transaction.marketingCampaign.findFirst({
      where: {
        organizationId,
        channelId: channel.id,
        name: record.campaignName,
      },
    });

    const campaign =
      existingCampaign ??
      (await transaction.marketingCampaign.create({
        data: {
          organizationId,
          channelId: channel.id,
          name: record.campaignName,
          status: CampaignStatus.ACTIVE,
        },
      }));

    await transaction.marketingMetric.create({
      data: {
        organizationId,
        campaignId: campaign.id,
        impressions: record.impressions,
        clicks: record.clicks,
        cost: record.cost,
        conversions: record.conversions,
        date: new Date(record.date),
      },
    });
  }

  private async persistRevenueEvent(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    provider: IntegrationProvider,
    record: NormalizedRevenueEvent,
  ) {
    const customer = record.customerExternalId
      ? await this.findOrCreateCustomer(transaction, organizationId, provider, record.customerExternalId)
      : null;

    await transaction.revenueEvent.create({
      data: {
        organizationId,
        customerId: customer?.id,
        amount: record.amount,
        currency: this.mapCurrencyCode(record.currency),
        eventType: this.mapRevenueEventType(record.eventType),
        timestamp: new Date(record.timestamp),
      },
    });
  }

  private async persistCustomerEvent(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    provider: IntegrationProvider,
    record: NormalizedCustomerEvent,
  ) {
    const customer = await this.findOrCreateCustomer(
      transaction,
      organizationId,
      provider,
      record.customerExternalId,
    );

    await transaction.customerEvent.create({
      data: {
        organizationId,
        customerId: customer.id,
        eventType: this.mapCustomerEventType(record.eventType),
        metadata: (record.metadata as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        timestamp: new Date(record.timestamp),
      },
    });
  }

  private async persistSalesPipelineEvent(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    record: NormalizedSalesPipelineEvent,
  ) {
    const pipeline = await transaction.salesPipeline.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: record.pipelineName,
        },
      },
      update: {},
      create: {
        organizationId,
        name: record.pipelineName,
      },
    });

    const stageType = this.mapDealStageType(record.stageName);
    const existingStage = await transaction.dealStage.findFirst({
      where: {
        pipelineId: pipeline.id,
        type: stageType,
      },
    });

    const stage =
      existingStage ??
      (await transaction.dealStage.create({
        data: {
          pipelineId: pipeline.id,
          name: record.stageName,
          type: stageType,
          sequence: this.mapDealStageSequence(stageType),
        },
      }));

    await transaction.deal.create({
      data: {
        organizationId,
        pipelineId: pipeline.id,
        stageId: stage.id,
        value: record.value,
        stage: stage.type,
        probability: record.probability,
        closeDate: record.closeDate ? new Date(record.closeDate) : undefined,
      },
    });
  }

  private async findOrCreateCustomer(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    provider: IntegrationProvider,
    customerExternalId: string,
  ) {
    const email = this.buildIntegrationCustomerEmail(provider, customerExternalId);

    return transaction.customer.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email,
        },
      },
      update: {},
      create: {
        organizationId,
        email,
        acquisitionChannel: provider,
      },
    });
  }

  private buildIntegrationCustomerEmail(provider: IntegrationProvider, externalId: string) {
    const normalizedId =
      externalId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'external-customer';

    return `${normalizedId}@${provider.toLowerCase()}.integration.local`;
  }

  private mapMarketingChannelType(channelName: string): MarketingChannelType {
    const normalizedName = channelName.toLowerCase();

    if (normalizedName.includes('google') || normalizedName.includes('search')) {
      return MarketingChannelType.PAID_SEARCH;
    }

    if (
      normalizedName.includes('meta') ||
      normalizedName.includes('facebook') ||
      normalizedName.includes('instagram') ||
      normalizedName.includes('tiktok') ||
      normalizedName.includes('linkedin')
    ) {
      return MarketingChannelType.PAID_SOCIAL;
    }

    if (normalizedName.includes('mail') || normalizedName.includes('email')) {
      return MarketingChannelType.EMAIL;
    }

    if (
      normalizedName.includes('sms') ||
      normalizedName.includes('termii') ||
      normalizedName.includes('twilio')
    ) {
      return MarketingChannelType.SMS;
    }

    if (normalizedName.includes('whatsapp')) {
      return MarketingChannelType.WHATSAPP;
    }

    return MarketingChannelType.OTHER;
  }

  private mapRevenueEventType(eventType: string): RevenueEventType {
    switch (eventType.toUpperCase()) {
      case RevenueEventType.SUBSCRIPTION_STARTED:
        return RevenueEventType.SUBSCRIPTION_STARTED;
      case RevenueEventType.SUBSCRIPTION_RENEWED:
        return RevenueEventType.SUBSCRIPTION_RENEWED;
      case RevenueEventType.UPGRADE:
        return RevenueEventType.UPGRADE;
      case RevenueEventType.DOWNGRADE:
        return RevenueEventType.DOWNGRADE;
      case RevenueEventType.REFUND:
        return RevenueEventType.REFUND;
      default:
        return RevenueEventType.ONE_TIME_PURCHASE;
    }
  }

  private mapCustomerEventType(eventType: string): CustomerEventType {
    switch (eventType.toUpperCase()) {
      case CustomerEventType.SIGNUP:
        return CustomerEventType.SIGNUP;
      case CustomerEventType.LOGIN:
        return CustomerEventType.LOGIN;
      case CustomerEventType.PAGE_VIEW:
        return CustomerEventType.PAGE_VIEW;
      case CustomerEventType.PURCHASE:
        return CustomerEventType.PURCHASE;
      case CustomerEventType.RENEWAL:
        return CustomerEventType.RENEWAL;
      case CustomerEventType.CHURN:
        return CustomerEventType.CHURN;
      default:
        return CustomerEventType.CUSTOM;
    }
  }

  private mapCurrencyCode(currency: string): CurrencyCode {
    switch (currency.toUpperCase()) {
      case CurrencyCode.USD:
        return CurrencyCode.USD;
      case CurrencyCode.GBP:
        return CurrencyCode.GBP;
      case CurrencyCode.EUR:
        return CurrencyCode.EUR;
      default:
        return CurrencyCode.NGN;
    }
  }

  private mapDealStageType(stageName: string): DealStageType {
    switch (stageName.toUpperCase()) {
      case DealStageType.LEAD:
        return DealStageType.LEAD;
      case DealStageType.PROPOSAL:
        return DealStageType.PROPOSAL;
      case DealStageType.NEGOTIATION:
        return DealStageType.NEGOTIATION;
      case DealStageType.WON:
        return DealStageType.WON;
      case DealStageType.LOST:
        return DealStageType.LOST;
      default:
        return DealStageType.QUALIFIED;
    }
  }

  private mapDealStageSequence(stageType: DealStageType): number {
    switch (stageType) {
      case DealStageType.LEAD:
        return 1;
      case DealStageType.QUALIFIED:
        return 2;
      case DealStageType.PROPOSAL:
        return 3;
      case DealStageType.NEGOTIATION:
        return 4;
      case DealStageType.WON:
        return 5;
      case DealStageType.LOST:
        return 6;
    }
  }
}

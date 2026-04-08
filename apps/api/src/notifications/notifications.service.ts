import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider, IntegrationStatus, MembershipRole } from '@prisma/client';
import {
  BaseIntegrationConnector,
  ConnectorDispatchPayload,
} from '../connectors/base/base-integration.connector';
import { ConnectorsService } from '../connectors/connectors.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { IntegrationCryptoService } from '../integrations/services/integration-crypto.service';

interface AlertDispatchPayload {
  organizationId: string;
  title: string;
  message: string;
  channels: string[];
}

interface DeliveryResult {
  channel: string;
  status: 'sent' | 'failed' | 'skipped';
  sentAt: string;
  error?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectorsService: ConnectorsService,
    private readonly integrationCryptoService: IntegrationCryptoService,
  ) {}

  async dispatchAlert(payload: AlertDispatchPayload) {
    const deliveries: DeliveryResult[] = await Promise.all(
      payload.channels.map((channel) =>
        this.dispatchChannel(channel, payload),
      ),
    );

    return {
      organizationId: payload.organizationId,
      title: payload.title,
      message: payload.message,
      deliveries,
    };
  }

  private async dispatchChannel(
    channel: string,
    payload: AlertDispatchPayload,
  ): Promise<DeliveryResult> {
    const sentAt = new Date().toISOString();

    if (channel === 'email') {
      return this.sendEmailToOrgOwner(payload.organizationId, payload.title, payload.message, sentAt);
    }

    if (channel === 'sms') {
      return this.sendSmsToOrgOwner(payload.organizationId, `${payload.title}: ${payload.message}`, sentAt);
    }

    if (channel.startsWith('sms:')) {
      const phone = channel.slice(4).trim();

      if (!phone) {
        return this.sendSmsToOrgOwner(payload.organizationId, `${payload.title}: ${payload.message}`, sentAt);
      }

      return this.sendSms(payload.organizationId, phone, `${payload.title}: ${payload.message}`, sentAt);
    }

    return { channel, status: 'skipped', sentAt };
  }

  private async sendEmailToOrgOwner(
    organizationId: string,
    subject: string,
    text: string,
    sentAt: string,
  ): Promise<DeliveryResult> {
    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, role: MembershipRole.OWNER },
      include: { user: { select: { email: true } } },
    });

    if (!membership) {
      return { channel: 'email', status: 'skipped', sentAt, error: 'No owner found for org' };
    }

    return this.sendEmail(organizationId, membership.user.email, subject, text, sentAt);
  }

  private async sendEmail(
    organizationId: string,
    to: string,
    subject: string,
    text: string,
    sentAt: string,
  ): Promise<DeliveryResult> {
    try {
      await this.dispatchWithConnector(
        organizationId,
        IntegrationProvider.SENDGRID,
        {
          kind: 'email',
          to,
          subject,
          text,
          fromEmail: process.env.SENDGRID_FROM_EMAIL,
        },
        'email',
      );

      return {
        channel: 'email',
        status: 'sent',
        sentAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = this.isConfigurationError(message) ? 'skipped' : 'failed';
      this.logger.error(`SendGrid dispatch failed: ${message}`);
      return { channel: 'email', status, sentAt, error: message };
    }
  }

  private async sendSms(
    organizationId: string,
    phone: string,
    message: string,
    sentAt: string,
  ): Promise<DeliveryResult> {
    const channel = `sms:${phone}`;

    try {
      await this.dispatchWithConnector(
        organizationId,
        IntegrationProvider.TERMII,
        {
          kind: 'sms',
          to: phone,
          message,
          senderId: process.env.TERMII_SENDER_ID,
        },
        channel,
      );

      return { channel, status: 'sent', sentAt };
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      const status = this.isConfigurationError(messageText) ? 'skipped' : 'failed';
      this.logger.error(`Termii dispatch failed: ${messageText}`);
      return { channel, status, sentAt, error: messageText };
    }
  }

  private async sendSmsToOrgOwner(
    organizationId: string,
    message: string,
    sentAt: string,
  ): Promise<DeliveryResult> {
    const ownerPhoneNumber = await this.getOwnerPhoneNumber(organizationId);

    if (!ownerPhoneNumber) {
      return {
        channel: 'sms',
        status: 'skipped',
        sentAt,
        error: 'No owner phone number found for org',
      };
    }

    return this.sendSms(organizationId, ownerPhoneNumber, message, sentAt);
  }

  private async getOwnerPhoneNumber(organizationId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ phoneNumber: string | null }>>`
      SELECT u."phoneNumber"
      FROM "memberships" m
      INNER JOIN "users" u ON u.id = m."userId"
      WHERE m."organizationId" = ${organizationId}
        AND m.role = ${MembershipRole.OWNER}
      ORDER BY m."createdAt" ASC
      LIMIT 1
    `;

    const phoneNumber = rows[0]?.phoneNumber?.trim();
    return phoneNumber && phoneNumber.length > 0 ? phoneNumber : null;
  }

  private async dispatchWithConnector(
    organizationId: string,
    provider: IntegrationProvider,
    payload: ConnectorDispatchPayload,
    channel: string,
  ) {
    const connector = await this.getHydratedConnector(provider, organizationId);

    try {
      return await connector.dispatch(payload);
    } catch (error) {
      throw new Error(
        `${provider} dispatch failed for ${channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async getHydratedConnector(
    provider: IntegrationProvider,
    organizationId?: string,
  ): Promise<BaseIntegrationConnector> {
    const connector = this.connectorsService.getConnector(provider);

    const integration = organizationId
      ? await this.prisma.integration.findFirst({
          where: {
            organizationId,
            provider,
            status: IntegrationStatus.ACTIVE,
          },
          include: {
            credentials: {
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        })
      : null;

    const credential = integration?.credentials[0];

    if (credential) {
      connector.setCredentials({
        accessToken: this.integrationCryptoService.decrypt(credential.encryptedToken),
        refreshToken: credential.refreshToken
          ? this.integrationCryptoService.decrypt(credential.refreshToken)
          : undefined,
        metadata: this.getFallbackMetadata(provider),
      });

      return connector;
    }

    const fallbackAccessToken = this.getFallbackAccessToken(provider);
    if (!fallbackAccessToken) {
      throw new Error(`${provider} connector is not configured for alert delivery.`);
    }

    connector.setCredentials({
      accessToken: fallbackAccessToken,
      metadata: this.getFallbackMetadata(provider),
    });

    return connector;
  }

  private getFallbackAccessToken(provider: IntegrationProvider): string | undefined {
    if (provider === IntegrationProvider.SENDGRID) {
      return process.env.SENDGRID_API_KEY;
    }

    if (provider === IntegrationProvider.TERMII) {
      return process.env.TERMII_API_KEY;
    }

    return undefined;
  }

  private getFallbackMetadata(provider: IntegrationProvider): Record<string, unknown> | undefined {
    if (provider === IntegrationProvider.SENDGRID) {
      return {
        fromEmail: process.env.SENDGRID_FROM_EMAIL ?? 'alerts@revenewos.com',
      };
    }

    if (provider === IntegrationProvider.TERMII) {
      return {
        senderId: process.env.TERMII_SENDER_ID ?? 'RevenewOS',
      };
    }

    return undefined;
  }

  private isConfigurationError(message: string): boolean {
    return (
      message.includes('not configured') ||
      message.includes('Missing access token') ||
      message.includes('from email is not configured')
    );
  }
}

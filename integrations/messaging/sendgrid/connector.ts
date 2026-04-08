import { IntegrationProvider } from '@prisma/client';
import {
  BaseIntegrationConnector,
  ConnectorDispatchPayload,
  ConnectorDispatchResult,
} from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class SendGridConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.SENDGRID, 'messaging');
  }

  async dispatch(payload: ConnectorDispatchPayload): Promise<ConnectorDispatchResult> {
    if (payload.kind !== 'email') {
      throw new Error('SendGrid connector only supports email dispatch.');
    }

    const fromEmail =
      payload.fromEmail ??
      this.getMetadataValue<string>('fromEmail') ??
      process.env.SENDGRID_FROM_EMAIL;

    if (!fromEmail) {
      throw new Error('SendGrid from email is not configured.');
    }

    const response = await this.httpClient.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: fromEmail },
        subject: payload.subject,
        content: [{ type: 'text/plain', value: payload.text }],
      },
      {
        headers: {
          ...this.buildBearerHeaders(),
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      provider: this.getProvider(),
      sentAt: new Date().toISOString(),
      providerMessageId: response.headers['x-message-id'] as string | undefined,
    };
  }

  protected async ingest() {
    const response = await this.authenticatedGet<Array<{
      date?: string;
      stats?: Array<{ metrics?: { requests?: number; delivered?: number } }>;
    }>>('https://api.sendgrid.com/v3/stats', { limit: 30 });

    return (response ?? []).flatMap((entry, index) => {
      const delivered = entry.stats?.[0]?.metrics?.delivered ?? 0;
      if (delivered === 0) {
        return [];
      }

      return [
        normalizeCustomerEvent({
          customerExternalId: `sendgrid-contact-${index + 1}`,
          eventType: 'CUSTOM',
          metadata: { channel: 'email', delivered },
          timestamp: entry.date ? new Date(entry.date).toISOString() : new Date().toISOString(),
        }),
      ];
    });
  }
}

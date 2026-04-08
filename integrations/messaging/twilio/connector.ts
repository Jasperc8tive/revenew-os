import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class TwilioConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.TWILIO, 'messaging');
  }

  protected async ingest() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    if (!accountSid) {
      throw new Error('TWILIO_ACCOUNT_SID is required for Twilio sync.');
    }

    const response = await this.httpClient.get<{
      messages?: Array<{ to?: string; direction?: string; date_sent?: string }>;
    }>(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      headers: this.buildBearerHeaders(),
      params: {
        PageSize: 50,
      },
    });

    return (response.data.messages ?? []).map((message, index) =>
      normalizeCustomerEvent({
        customerExternalId: message.to ?? `twilio-contact-${index + 1}`,
        eventType: 'CUSTOM',
        metadata: {
          channel: 'sms',
          direction: message.direction,
        },
        timestamp: message.date_sent ? new Date(message.date_sent).toISOString() : new Date().toISOString(),
      }),
    );
  }
}

import { IntegrationProvider } from '@prisma/client';
import {
  BaseIntegrationConnector,
  ConnectorDispatchPayload,
  ConnectorDispatchResult,
} from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class TermiiConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.TERMII, 'messaging');
  }

  async dispatch(payload: ConnectorDispatchPayload): Promise<ConnectorDispatchResult> {
    if (payload.kind !== 'sms') {
      throw new Error('Termii connector only supports SMS dispatch.');
    }

    const senderId =
      payload.senderId ??
      this.getMetadataValue<string>('senderId') ??
      process.env.TERMII_SENDER_ID ??
      'RevenewOS';

    const response = await this.httpClient.post(
      'https://api.ng.termii.com/api/sms/send',
      {
        to: payload.to,
        from: senderId,
        sms: payload.message,
        type: 'plain',
        channel: 'generic',
        api_key: this.getAccessTokenOrThrow(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return {
      provider: this.getProvider(),
      sentAt: new Date().toISOString(),
      providerMessageId: response.data?.message_id as string | undefined,
    };
  }

  protected async ingest() {
    const response = await this.httpClient.get<{
      data?: Array<{ to?: string; type?: string; sent_at?: string }>;
    }>('https://api.ng.termii.com/api/sms/inbox', {
      headers: this.buildBearerHeaders(),
      params: {
        page: 1,
      },
    });

    return (response.data.data ?? []).map((message, index) =>
      normalizeCustomerEvent({
        customerExternalId: message.to ?? `termii-contact-${index + 1}`,
        eventType: 'CUSTOM',
        metadata: {
          channel: message.type ?? 'sms',
        },
        timestamp: message.sent_at ? new Date(message.sent_at).toISOString() : new Date().toISOString(),
      }),
    );
  }
}

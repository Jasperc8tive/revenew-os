import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from '../../../apps/api/src/connectors/base/base-integration.connector';
import { normalizeCustomerEvent } from '../../../apps/api/src/connectors/normalizers/integration-normalizers';

export class MailchimpConnector extends BaseIntegrationConnector {
  constructor() {
    super(IntegrationProvider.MAILCHIMP, 'messaging');
  }

  protected async ingest() {
    const dataCenter = process.env.MAILCHIMP_DATA_CENTER;
    if (!dataCenter) {
      throw new Error('MAILCHIMP_DATA_CENTER is required for Mailchimp sync.');
    }

    const response = await this.authenticatedGet<{
      campaigns?: Array<{ id?: string; send_time?: string; status?: string }>;
    }>(`https://${dataCenter}.api.mailchimp.com/3.0/campaigns`, { count: 50 });

    return (response.campaigns ?? []).map((campaign, index) =>
      normalizeCustomerEvent({
        customerExternalId: campaign.id ?? `mailchimp-contact-${index + 1}`,
        eventType: 'CUSTOM',
        metadata: { channel: 'newsletter', status: campaign.status },
        timestamp: campaign.send_time ?? new Date().toISOString(),
      }),
    );
  }
}

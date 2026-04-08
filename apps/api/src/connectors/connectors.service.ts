import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { BaseIntegrationConnector } from './base/base-integration.connector';
import { ConnectorRegistry } from './registry/connector-registry';
import { AmplitudeConnector } from '../../../../integrations/analytics/amplitude/connector';
import { GoogleAnalyticsConnector } from '../../../../integrations/analytics/google_analytics/connector';
import { MixpanelConnector } from '../../../../integrations/analytics/mixpanel/connector';
import { PostHogConnector } from '../../../../integrations/analytics/posthog/connector';
import { HubSpotConnector } from '../../../../integrations/crm/hubspot/connector';
import { PipedriveConnector } from '../../../../integrations/crm/pipedrive/connector';
import { SalesforceConnector } from '../../../../integrations/crm/salesforce/connector';
import { ZohoConnector } from '../../../../integrations/crm/zoho/connector';
import { BigQueryConnector } from '../../../../integrations/data_warehouse/bigquery/connector';
import { DatabricksConnector } from '../../../../integrations/data_warehouse/databricks/connector';
import { RedshiftConnector } from '../../../../integrations/data_warehouse/redshift/connector';
import { SnowflakeConnector } from '../../../../integrations/data_warehouse/snowflake/connector';
import { GoogleAdsConnector } from '../../../../integrations/marketing/google_ads/connector';
import { LinkedInAdsConnector } from '../../../../integrations/marketing/linkedin_ads/connector';
import { MetaAdsConnector } from '../../../../integrations/marketing/meta_ads/connector';
import { TikTokAdsConnector } from '../../../../integrations/marketing/tiktok_ads/connector';
import { MailchimpConnector } from '../../../../integrations/messaging/mailchimp/connector';
import { SendGridConnector } from '../../../../integrations/messaging/sendgrid/connector';
import { TermiiConnector } from '../../../../integrations/messaging/termii/connector';
import { TwilioConnector } from '../../../../integrations/messaging/twilio/connector';
import { FlutterwaveConnector } from '../../../../integrations/payments/flutterwave/connector';
import { MonnifyConnector } from '../../../../integrations/payments/monnify/connector';
import { PaystackConnector } from '../../../../integrations/payments/paystack/connector';
import { StripeConnector } from '../../../../integrations/payments/stripe/connector';

@Injectable()
export class ConnectorsService {
	constructor(private readonly connectorRegistry: ConnectorRegistry) {
		this.registerDefaults();
	}

	getConnector(provider: IntegrationProvider): BaseIntegrationConnector {
		const connector = this.connectorRegistry.get(provider);

		if (!connector) {
			throw new NotFoundException(`Connector for provider ${provider} is not registered.`);
		}

		return connector;
	}

	listConnectors(): BaseIntegrationConnector[] {
		return this.connectorRegistry.getAll();
	}

	private registerDefaults(): void {
		if (this.connectorRegistry.getAll().length > 0) {
			return;
		}

		[
			new GoogleAdsConnector(),
			new MetaAdsConnector(),
			new TikTokAdsConnector(),
			new LinkedInAdsConnector(),
			new PaystackConnector(),
			new FlutterwaveConnector(),
			new StripeConnector(),
			new MonnifyConnector(),
			new HubSpotConnector(),
			new SalesforceConnector(),
			new ZohoConnector(),
			new PipedriveConnector(),
			new GoogleAnalyticsConnector(),
			new MixpanelConnector(),
			new AmplitudeConnector(),
			new PostHogConnector(),
			new TwilioConnector(),
			new TermiiConnector(),
			new SendGridConnector(),
			new MailchimpConnector(),
			new SnowflakeConnector(),
			new BigQueryConnector(),
			new RedshiftConnector(),
			new DatabricksConnector(),
		].forEach((connector) => this.connectorRegistry.register(connector));
	}
}

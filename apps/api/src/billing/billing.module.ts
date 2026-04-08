import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingController } from './billing.controller';
import { BillingWebhooksController } from './billing.webhooks.controller';
import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PaystackProvider } from './providers/paystack.provider';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { StripeProvider } from './providers/stripe.provider';
import { BillingAccessService } from './billing-access.service';

@Module({
	imports: [ConfigModule],
	controllers: [BillingController, BillingWebhooksController],
	providers: [
		BillingService,
		SubscriptionService,
		InvoiceService,
		PaymentService,
		PaystackProvider,
		FlutterwaveProvider,
		StripeProvider,
		BillingAccessService,
	],
	exports: [BillingService, SubscriptionService, InvoiceService, PaymentService, BillingAccessService],
})
export class BillingModule {}

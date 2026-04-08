import { Body, Controller, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('webhooks/billing')
export class BillingWebhooksController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':provider')
  @HttpCode(200)
  receiveWebhook(
    @Param('provider') provider: 'paystack' | 'flutterwave' | 'stripe',
    @Body() payload: Record<string, unknown>,
    @Headers('x-paystack-signature') paystackSig?: string,
    @Headers('verif-hash') flutterwaveSig?: string,
    @Headers('stripe-signature') stripeSig?: string,
    @Query('signature') fallbackSignature?: string,
  ) {
    const signature = paystackSig ?? flutterwaveSig ?? stripeSig ?? fallbackSignature ?? '';
    return this.paymentService.processWebhook(provider, payload, signature);
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import { BillingService } from './billing.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { UpgradeDto } from './dto/upgrade.dto';
import { CancelDto } from './dto/cancel.dto';
import { PaymentService } from './payment.service';
import { SubscriptionService } from './subscription.service';

@Controller('billing')
@UseGuards(JwtGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription')
  async getSubscription(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    const orgId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      organizationId,
    );

    const subscription = await this.subscriptionService.getCurrentSubscription(orgId);
    return {
      organizationId: orgId,
      subscription,
    };
  }

  @Post('subscribe')
  async subscribe(@Req() req: Request, @Body() body: SubscribeDto) {
    const organizationId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.subscriptionService.createSubscription({
      organizationId,
      tier: body.tier,
      billingInterval: this.billingService.normalizeBillingInterval(body.billingInterval),
      paymentProvider: body.paymentProvider,
      billingEmail: body.billingEmail,
    });
  }

  @Post('upgrade')
  async upgrade(@Req() req: Request, @Body() body: UpgradeDto) {
    const organizationId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.subscriptionService.changePlan({
      organizationId,
      targetTier: body.targetTier,
      billingInterval: body.billingInterval,
      paymentProvider: body.paymentProvider,
    });
  }

  @Post('cancel')
  async cancel(@Req() req: Request, @Body() body: CancelDto) {
    const organizationId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.subscriptionService.cancelSubscription(organizationId, body.reason);
  }

  @Get('invoices')
  async invoices(@Req() req: Request, @Query('organizationId') organizationId?: string) {
    const orgId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      organizationId,
    );

    const invoices = await this.billingService.getInvoices(orgId);
    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      organizationName: invoice.organization.name,
      plan: invoice.subscription.plan.name,
      amount: Number(invoice.amount),
      amountDisplay: this.billingService.formatNaira(Number(invoice.amount)),
      billingPeriod: invoice.subscription.billingInterval,
      paymentStatus: invoice.status,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
    }));
  }

  @Post('renew')
  async renew(@Req() req: Request, @Body('organizationId') organizationId?: string) {
    const orgId = await this.billingService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      organizationId,
    );

    return this.subscriptionService.renewSubscription(orgId);
  }

  @Post(':provider/verify')
  async verify(
    @Param('provider') provider: 'paystack' | 'flutterwave' | 'stripe',
    @Body('reference') reference: string,
  ) {
    return this.paymentService.verifyPayment(provider, reference);
  }

  @Post('webhooks/:provider')
  @HttpCode(200)
  async webhook(
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

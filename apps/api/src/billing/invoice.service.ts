import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, Subscription } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoiceForSubscription(params: {
    organizationId: string;
    subscription: Subscription;
    amount: number;
    dueDate?: Date;
  }) {
    const invoiceNumber = await this.generateInvoiceNumber(params.organizationId);

    return this.prisma.invoice.create({
      data: {
        organizationId: params.organizationId,
        subscriptionId: params.subscription.id,
        invoiceNumber,
        amount: new Prisma.Decimal(params.amount),
        dueDate: params.dueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: InvoiceStatus.ISSUED,
      },
      include: {
        subscription: {
          include: { plan: true },
        },
        organization: true,
      },
    });
  }

  async markInvoicePaid(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });
  }

  async listInvoices(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId },
      include: {
        subscription: {
          include: { plan: true },
        },
        organization: true,
        payments: true,
      },
      orderBy: { issuedAt: 'desc' },
    });
  }

  private async generateInvoiceNumber(organizationId: string) {
    const monthStamp = new Date().toISOString().slice(0, 7).replace('-', '');
    const prefix = `INV-${monthStamp}`;
    const count = await this.prisma.invoice.count({
      where: {
        organizationId,
        invoiceNumber: {
          startsWith: prefix,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
}

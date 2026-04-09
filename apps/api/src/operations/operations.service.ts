import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerEventType, Prisma } from '@prisma/client';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateOrderDto } from './dto/create-order.dto';

function toObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  resolveOrganizationId(userId?: string, fallbackOrganizationId?: string) {
    return this.billingService.resolveOrganizationId(userId, fallbackOrganizationId);
  }

  async listOrders(organizationId: string, status?: string) {
    const events = await this.prisma.customerEvent.findMany({
      where: {
        organizationId,
        eventType: CustomerEventType.PURCHASE,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 200,
    });

    const mapped = events.map((event) => {
      const metadata = toObject(event.metadata);
      return {
        id: event.id,
        organizationId: event.organizationId,
        customerEmail: event.customer.email,
        status: String(metadata.orderStatus ?? 'PENDING'),
        totalAmount: Number(metadata.totalAmount ?? 0),
        currency: String(metadata.currency ?? 'NGN'),
        source: String(metadata.source ?? 'manual'),
        notes: metadata.notes ? String(metadata.notes) : null,
        items: Array.isArray(metadata.items) ? metadata.items : [],
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    });

    return status ? mapped.filter((order) => order.status === status) : mapped;
  }

  async createOrder(organizationId: string, dto: CreateOrderDto) {
    const customer = await this.prisma.customer.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: dto.customerEmail,
        },
      },
      create: {
        organizationId,
        email: dto.customerEmail,
      },
      update: {},
    });

    const event = await this.prisma.customerEvent.create({
      data: {
        organizationId,
        customerId: customer.id,
        eventType: CustomerEventType.PURCHASE,
        metadata: {
          orderStatus: 'PENDING',
          totalAmount: dto.totalAmount,
          currency: dto.currency ?? 'NGN',
          source: dto.source ?? 'manual',
          notes: dto.notes ?? null,
          items: dto.items ?? [],
        } as Prisma.InputJsonValue,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    return {
      id: event.id,
      organizationId,
      customerEmail: event.customer.email,
      status: 'PENDING',
      totalAmount: dto.totalAmount,
      currency: dto.currency ?? 'NGN',
      source: dto.source ?? 'manual',
      notes: dto.notes ?? null,
      items: dto.items ?? [],
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };
  }

  async updateOrderStatus(organizationId: string, orderId: string, status: string) {
    const event = await this.prisma.customerEvent.findFirst({
      where: {
        id: orderId,
        organizationId,
        eventType: CustomerEventType.PURCHASE,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Order not found');
    }

    const metadata = toObject(event.metadata);
    const mergedMetadata: Prisma.InputJsonValue = {
      ...metadata,
      orderStatus: status,
      statusUpdatedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.customerEvent.update({
      where: {
        id: event.id,
      },
      data: {
        metadata: mergedMetadata,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    const updatedMetadata = toObject(updated.metadata);

    return {
      id: updated.id,
      organizationId,
      customerEmail: updated.customer.email,
      status: String(updatedMetadata.orderStatus ?? status),
      totalAmount: Number(updatedMetadata.totalAmount ?? 0),
      currency: String(updatedMetadata.currency ?? 'NGN'),
      source: String(updatedMetadata.source ?? 'manual'),
      notes: updatedMetadata.notes ? String(updatedMetadata.notes) : null,
      items: Array.isArray(updatedMetadata.items) ? updatedMetadata.items : [],
      createdAt: updated.timestamp,
      updatedAt: new Date(),
    };
  }

  async listMessages(organizationId: string, resolved?: boolean) {
    const events = await this.prisma.customerEvent.findMany({
      where: {
        organizationId,
        eventType: CustomerEventType.CUSTOM,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 300,
    });

    const mapped = events
      .map((event) => {
        const metadata = toObject(event.metadata);
        return {
          id: event.id,
          organizationId: event.organizationId,
          customerEmail: event.customer.email,
          channel: String(metadata.channel ?? 'whatsapp'),
          body: String(metadata.body ?? ''),
          source: String(metadata.source ?? 'inbox'),
          resolved: Boolean(metadata.resolved ?? false),
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };
      })
      .filter((message) => message.body.length > 0);

    if (typeof resolved === 'boolean') {
      return mapped.filter((message) => message.resolved === resolved);
    }

    return mapped;
  }

  async createMessage(organizationId: string, dto: CreateMessageDto) {
    const customer = await this.prisma.customer.upsert({
      where: {
        organizationId_email: {
          organizationId,
          email: dto.customerEmail,
        },
      },
      create: {
        organizationId,
        email: dto.customerEmail,
      },
      update: {},
    });

    const event = await this.prisma.customerEvent.create({
      data: {
        organizationId,
        customerId: customer.id,
        eventType: CustomerEventType.CUSTOM,
        metadata: {
          channel: dto.channel ?? 'whatsapp',
          body: dto.body,
          source: dto.source ?? 'inbox',
          resolved: false,
        } as Prisma.InputJsonValue,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    return {
      id: event.id,
      organizationId,
      customerEmail: event.customer.email,
      channel: dto.channel ?? 'whatsapp',
      body: dto.body,
      source: dto.source ?? 'inbox',
      resolved: false,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };
  }

  async resolveMessage(organizationId: string, messageId: string) {
    const event = await this.prisma.customerEvent.findFirst({
      where: {
        id: messageId,
        organizationId,
        eventType: CustomerEventType.CUSTOM,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Message not found');
    }

    const metadata = toObject(event.metadata);
    const mergedMetadata: Prisma.InputJsonValue = {
      ...metadata,
      resolved: true,
      resolvedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.customerEvent.update({
      where: {
        id: event.id,
      },
      data: {
        metadata: mergedMetadata,
      },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    const updatedMetadata = toObject(updated.metadata);

    return {
      id: updated.id,
      organizationId,
      customerEmail: updated.customer.email,
      channel: String(updatedMetadata.channel ?? 'whatsapp'),
      body: String(updatedMetadata.body ?? ''),
      source: String(updatedMetadata.source ?? 'inbox'),
      resolved: Boolean(updatedMetadata.resolved ?? true),
      createdAt: updated.timestamp,
      updatedAt: new Date(),
    };
  }
}

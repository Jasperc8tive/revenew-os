import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerEventType, Prisma } from '@prisma/client';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateOrderDto } from './dto/create-order.dto';

function toObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

const ORDER_STATUS_FLOW: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['FULFILLED', 'CANCELED'],
  FULFILLED: [],
  CANCELED: [],
};

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly onboardingService: OnboardingService,
  ) {}

  resolveOrganizationId(userId?: string, fallbackOrganizationId?: string) {
    return this.billingService.resolveOrganizationId(userId, fallbackOrganizationId);
  }

  async listOrders(
    organizationId: string,
    filters?: {
      status?: string;
      operationalState?: string;
      assigneeId?: string;
      customerEmail?: string;
      sourceConversationId?: string;
    },
  ) {
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
        operationalState: String(metadata.operationalState ?? 'UNASSIGNED'),
        assigneeId: metadata.assigneeId ? String(metadata.assigneeId) : null,
        totalAmount: Number(metadata.totalAmount ?? 0),
        currency: String(metadata.currency ?? 'NGN'),
        source: String(metadata.source ?? 'manual'),
        sourceMessageId: metadata.sourceMessageId ? String(metadata.sourceMessageId) : null,
        sourceConversationId: metadata.sourceConversationId ? String(metadata.sourceConversationId) : null,
        notes: metadata.notes ? String(metadata.notes) : null,
        items: Array.isArray(metadata.items) ? metadata.items : [],
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
    });

    return mapped.filter((order) => {
      if (filters?.status && order.status !== filters.status) {
        return false;
      }

      if (filters?.operationalState && order.operationalState !== filters.operationalState) {
        return false;
      }

      if (filters?.assigneeId && order.assigneeId !== filters.assigneeId) {
        return false;
      }

      if (filters?.customerEmail && order.customerEmail.toLowerCase() !== filters.customerEmail.toLowerCase()) {
        return false;
      }

      if (
        filters?.sourceConversationId &&
        order.sourceConversationId !== filters.sourceConversationId
      ) {
        return false;
      }

      return true;
    });
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
          operationalState: dto.assigneeId ? 'QUEUED' : 'UNASSIGNED',
          assigneeId: dto.assigneeId ?? null,
          totalAmount: dto.totalAmount,
          currency: dto.currency ?? 'NGN',
          source: dto.source ?? 'manual',
          sourceMessageId: dto.sourceMessageId ?? null,
          sourceConversationId: dto.sourceConversationId ?? null,
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

    const response = {
      id: event.id,
      organizationId,
      customerEmail: event.customer.email,
      status: 'PENDING',
      operationalState: dto.assigneeId ? 'QUEUED' : 'UNASSIGNED',
      assigneeId: dto.assigneeId ?? null,
      totalAmount: dto.totalAmount,
      currency: dto.currency ?? 'NGN',
      source: dto.source ?? 'manual',
      sourceMessageId: dto.sourceMessageId ?? null,
      sourceConversationId: dto.sourceConversationId ?? null,
      notes: dto.notes ?? null,
      items: dto.items ?? [],
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };

    await this.onboardingService.markMilestone(organizationId, 'create_first_order');
    return response;
  }

  async updateOrderStatus(
    organizationId: string,
    orderId: string,
    status: string,
    options?: { operationalState?: string; assigneeId?: string },
  ) {
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
    const previousStatus = String(metadata.orderStatus ?? 'PENDING');

    if (previousStatus !== status) {
      const allowedTransitions = ORDER_STATUS_FLOW[previousStatus] ?? [];
      if (!allowedTransitions.includes(status)) {
        throw new BadRequestException(
          `Invalid order status transition from ${previousStatus} to ${status}.`,
        );
      }
    }

    const mergedMetadata: Prisma.InputJsonValue = {
      ...metadata,
      orderStatus: status,
      operationalState: options?.operationalState ?? metadata.operationalState ?? 'UNASSIGNED',
      assigneeId: options?.assigneeId ?? metadata.assigneeId ?? null,
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
      operationalState: String(updatedMetadata.operationalState ?? 'UNASSIGNED'),
      assigneeId: updatedMetadata.assigneeId ? String(updatedMetadata.assigneeId) : null,
      totalAmount: Number(updatedMetadata.totalAmount ?? 0),
      currency: String(updatedMetadata.currency ?? 'NGN'),
      source: String(updatedMetadata.source ?? 'manual'),
      sourceMessageId: updatedMetadata.sourceMessageId
        ? String(updatedMetadata.sourceMessageId)
        : null,
      sourceConversationId: updatedMetadata.sourceConversationId
        ? String(updatedMetadata.sourceConversationId)
        : null,
      notes: updatedMetadata.notes ? String(updatedMetadata.notes) : null,
      items: Array.isArray(updatedMetadata.items) ? updatedMetadata.items : [],
      createdAt: updated.timestamp,
      updatedAt: new Date(),
    };
  }

  async assignOrder(organizationId: string, orderId: string, assigneeId: string) {
    await this.onboardingService.assertAdvancedWorkflowEnabled(organizationId);

    return this.updateOrderStatus(organizationId, orderId, 'CONFIRMED', {
      operationalState: 'QUEUED',
      assigneeId,
    });
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
          providerDirection: String(metadata.providerDirection ?? 'inbound'),
          providerStatus: metadata.providerStatus ? String(metadata.providerStatus) : null,
          providerEventId: metadata.providerEventId ? String(metadata.providerEventId) : null,
          orderId: metadata.orderId ? String(metadata.orderId) : null,
          linkedCustomerId: metadata.linkedCustomerId ? String(metadata.linkedCustomerId) : null,
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

  async listMessageTriage(
    organizationId: string,
    input?: {
      slaMinutes?: number;
      unresolvedOnly?: boolean;
    },
  ) {
    const slaMinutes = Math.max(input?.slaMinutes ?? 30, 1);
    const now = Date.now();
    const messages = await this.listMessages(
      organizationId,
      input?.unresolvedOnly ? false : undefined,
    );

    return messages.map((message) => {
      const ageMinutes = Math.max(Math.floor((now - new Date(message.createdAt).getTime()) / 60000), 0);
      const slaBreached = !message.resolved && ageMinutes > slaMinutes;

      return {
        ...message,
        slaMinutes,
        ageMinutes,
        slaBreached,
        queueState: message.resolved
          ? 'resolved'
          : slaBreached
            ? 'needs_attention'
            : 'in_queue',
      };
    });
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
          providerDirection: 'inbound',
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
      providerDirection: 'inbound',
      resolved: false,
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
    };
  }

  async resolveMessage(organizationId: string, messageId: string, resolved = true) {
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
      resolved,
      resolvedAt: resolved ? new Date().toISOString() : null,
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

    const response = {
      id: updated.id,
      organizationId,
      customerEmail: updated.customer.email,
      channel: String(updatedMetadata.channel ?? 'whatsapp'),
      body: String(updatedMetadata.body ?? ''),
      source: String(updatedMetadata.source ?? 'inbox'),
      providerDirection: String(updatedMetadata.providerDirection ?? 'inbound'),
      providerStatus: updatedMetadata.providerStatus ? String(updatedMetadata.providerStatus) : null,
      providerEventId: updatedMetadata.providerEventId ? String(updatedMetadata.providerEventId) : null,
      orderId: updatedMetadata.orderId ? String(updatedMetadata.orderId) : null,
      linkedCustomerId: updatedMetadata.linkedCustomerId ? String(updatedMetadata.linkedCustomerId) : null,
      resolved: Boolean(updatedMetadata.resolved ?? resolved),
      createdAt: updated.timestamp,
      updatedAt: new Date(),
    };

    if (resolved) {
      await this.onboardingService.markMilestone(organizationId, 'resolve_first_message');
    }

    return response;
  }

  async createOrderFromMessage(
    organizationId: string,
    messageId: string,
    input: { totalAmount: number; currency?: string; notes?: string; assigneeId?: string },
  ) {
    await this.onboardingService.assertAdvancedWorkflowEnabled(organizationId);

    const message = await this.prisma.customerEvent.findFirst({
      where: {
        id: messageId,
        organizationId,
        eventType: CustomerEventType.CUSTOM,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const order = await this.createOrder(organizationId, {
      customerEmail: message.customer.email,
      totalAmount: input.totalAmount,
      currency: input.currency,
      source: 'message_action',
      notes: input.notes,
      assigneeId: input.assigneeId,
      sourceMessageId: messageId,
      sourceConversationId: `conversation:${message.customer.id}`,
      items: [],
    });

    const messageMetadata = toObject(message.metadata);
    await this.prisma.customerEvent.update({
      where: { id: message.id },
      data: {
        metadata: {
          ...messageMetadata,
          orderId: order.id,
          linkedCustomerId: message.customer.id,
          resolved: true,
          resolvedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      messageId,
      order,
      linkedCustomerId: message.customer.id,
    };
  }

  async reconcileProviderEvent(
    organizationId: string,
    messageId: string,
    input: {
      direction: 'inbound' | 'outbound';
      providerStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
      providerEventId: string;
    },
  ) {
    const message = await this.prisma.customerEvent.findFirst({
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

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const metadata = toObject(message.metadata);
    const merged: Prisma.InputJsonValue = {
      ...metadata,
      providerDirection: input.direction,
      providerStatus: input.providerStatus,
      providerEventId: input.providerEventId,
      providerUpdatedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.customerEvent.update({
      where: { id: message.id },
      data: {
        metadata: merged,
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
      providerDirection: String(updatedMetadata.providerDirection ?? input.direction),
      providerStatus: String(updatedMetadata.providerStatus ?? input.providerStatus),
      providerEventId: String(updatedMetadata.providerEventId ?? input.providerEventId),
      resolved: Boolean(updatedMetadata.resolved ?? false),
      createdAt: updated.timestamp,
      updatedAt: new Date(),
    };
  }
}

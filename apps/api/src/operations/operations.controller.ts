import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { ListTriageDto } from './dto/list-triage.dto';
import { MessageActionCreateOrderDto } from './dto/message-action-create-order.dto';
import { ReconcileProviderEventDto } from './dto/reconcile-provider-event.dto';
import { ResolveMessageDto } from './dto/resolve-message.dto';
import { AssignOrderDto } from './dto/assign-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OperationsService } from './operations.service';

@UseGuards(JwtGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('orders')
  async listOrders(
    @Req() req: Request,
    @Query() query: ListOrdersDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      query.organizationId,
    );

    return this.operationsService.listOrders(orgId, {
      status: query.status,
      operationalState: query.operationalState,
      assigneeId: query.assigneeId,
      customerEmail: query.customerEmail,
      sourceConversationId: query.sourceConversationId,
    });
  }

  @Post('orders')
  async createOrder(@Req() req: Request, @Body() body: CreateOrderDto) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.createOrder(orgId, body);
  }

  @Patch('orders/:id/status')
  async updateOrderStatus(
    @Req() req: Request,
    @Param('id') orderId: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.updateOrderStatus(orgId, orderId, body.status, {
      operationalState: body.operationalState,
      assigneeId: body.assigneeId,
    });
  }

  @Patch('orders/:id/assign')
  async assignOrder(
    @Req() req: Request,
    @Param('id') orderId: string,
    @Body() body: AssignOrderDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.assignOrder(orgId, orderId, body.assigneeId);
  }

  @Get('messages')
  async listMessages(
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
    @Query('resolved') resolved?: string,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      organizationId,
    );

    const resolvedFlag =
      typeof resolved === 'string' ? resolved.toLowerCase() === 'true' : undefined;

    return this.operationsService.listMessages(orgId, resolvedFlag);
  }

  @Post('messages')
  async createMessage(@Req() req: Request, @Body() body: CreateMessageDto) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.createMessage(orgId, body);
  }

  @Patch('messages/:id/resolve')
  async resolveMessage(
    @Req() req: Request,
    @Param('id') messageId: string,
    @Body() body: ResolveMessageDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.resolveMessage(orgId, messageId, body.resolved ?? true);
  }

  @Get('messages/triage')
  async listMessageTriage(@Req() req: Request, @Query() query: ListTriageDto) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      query.organizationId,
    );

    return this.operationsService.listMessageTriage(orgId, {
      slaMinutes: query.slaMinutes,
      unresolvedOnly: query.unresolvedOnly,
    });
  }

  @Post('messages/:id/actions/create-order')
  async createOrderFromMessage(
    @Req() req: Request,
    @Param('id') messageId: string,
    @Body() body: MessageActionCreateOrderDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.createOrderFromMessage(orgId, messageId, {
      totalAmount: body.totalAmount,
      currency: body.currency,
      notes: body.notes,
      assigneeId: body.assigneeId,
    });
  }

  @Patch('messages/:id/provider-status')
  async reconcileProviderEvent(
    @Req() req: Request,
    @Param('id') messageId: string,
    @Body() body: ReconcileProviderEventDto,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      body.organizationId,
    );

    return this.operationsService.reconcileProviderEvent(orgId, messageId, {
      direction: body.direction,
      providerStatus: body.providerStatus,
      providerEventId: body.providerEventId,
    });
  }
}

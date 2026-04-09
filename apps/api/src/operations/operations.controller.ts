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
import { ResolveMessageDto } from './dto/resolve-message.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OperationsService } from './operations.service';

@UseGuards(JwtGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Get('orders')
  async listOrders(
    @Req() req: Request,
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
  ) {
    const orgId = await this.operationsService.resolveOrganizationId(
      (req as Request & { user?: { id?: string } }).user?.id,
      organizationId,
    );

    return this.operationsService.listOrders(orgId, status);
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

    return this.operationsService.updateOrderStatus(orgId, orderId, body.status);
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

    return this.operationsService.resolveMessage(orgId, messageId);
  }
}

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import request = require('supertest');
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

describe('OperationsController (e2e)', () => {
  let app: INestApplication;

  const operationsServiceMock = {
    resolveOrganizationId: jest.fn(),
    listOrders: jest.fn(),
    createOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    assignOrder: jest.fn(),
    listMessages: jest.fn(),
    createMessage: jest.fn(),
    resolveMessage: jest.fn(),
    listMessageTriage: jest.fn(),
    createOrderFromMessage: jest.fn(),
    reconcileProviderEvent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    operationsServiceMock.resolveOrganizationId.mockImplementation(async () => 'org-1');
    operationsServiceMock.listOrders.mockImplementation(async () => [{ id: 'order-1', status: 'PENDING' }]);
    operationsServiceMock.createOrder.mockImplementation(async () => ({ id: 'order-1' }));
    operationsServiceMock.updateOrderStatus.mockImplementation(async () => ({ id: 'order-1', status: 'CONFIRMED' }));
    operationsServiceMock.assignOrder.mockImplementation(async () => ({ id: 'order-1', assigneeId: 'agent-1' }));
    operationsServiceMock.listMessages.mockImplementation(async () => [{ id: 'message-1', resolved: false }]);
    operationsServiceMock.createMessage.mockImplementation(async () => ({ id: 'message-1' }));
    operationsServiceMock.resolveMessage.mockImplementation(async () => ({ id: 'message-1', resolved: true }));
    operationsServiceMock.listMessageTriage.mockImplementation(async () => [{ id: 'message-1', slaBreached: true }]);
    operationsServiceMock.createOrderFromMessage.mockImplementation(async () => ({ order: { id: 'order-2' } }));
    operationsServiceMock.reconcileProviderEvent.mockImplementation(async () => ({ id: 'message-1', providerStatus: 'delivered' }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OperationsController],
      providers: [{ provide: OperationsService, useValue: operationsServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /operations/orders supports status filter', async () => {
    const response = await request(app.getHttpServer())
      .get('/operations/orders?organizationId=org-1&status=PENDING')
      .expect(200);

    expect(response.body[0].id).toBe('order-1');
  });

  it('PATCH /operations/orders/:id/assign assigns an order', async () => {
    const response = await request(app.getHttpServer())
      .patch('/operations/orders/order-1/assign')
      .send({ organizationId: 'org-1', assigneeId: 'agent-1' })
      .expect(200);

    expect(response.body.assigneeId).toBe('agent-1');
  });

  it('GET /operations/messages/triage returns queue triage view', async () => {
    const response = await request(app.getHttpServer())
      .get('/operations/messages/triage?organizationId=org-1&slaMinutes=30&unresolvedOnly=true')
      .expect(200);

    expect(response.body[0].slaBreached).toBe(true);
  });

  it('POST /operations/messages/:id/actions/create-order creates order from message', async () => {
    const response = await request(app.getHttpServer())
      .post('/operations/messages/message-1/actions/create-order')
      .send({ organizationId: 'org-1', totalAmount: 15000, currency: 'NGN' })
      .expect(201);

    expect(response.body.order.id).toBe('order-2');
  });

  it('PATCH /operations/messages/:id/provider-status reconciles provider delivery status', async () => {
    const response = await request(app.getHttpServer())
      .patch('/operations/messages/message-1/provider-status')
      .send({
        organizationId: 'org-1',
        direction: 'outbound',
        providerStatus: 'delivered',
        providerEventId: 'evt-1',
      })
      .expect(200);

    expect(response.body.providerStatus).toBe('delivered');
  });

  it('PATCH /operations/orders/:id/assign returns 403 when onboarding gate blocks advanced workflow', async () => {
    operationsServiceMock.assignOrder.mockImplementation(async () => {
      throw new ForbiddenException('Advanced workflows are gated.');
    });

    await request(app.getHttpServer())
      .patch('/operations/orders/order-1/assign')
      .send({ organizationId: 'org-1', assigneeId: 'agent-1' })
      .expect(403);
  });

  it('POST /operations/messages/:id/actions/create-order returns 403 when onboarding gate blocks advanced workflow', async () => {
    operationsServiceMock.createOrderFromMessage.mockImplementation(async () => {
      throw new ForbiddenException('Advanced workflows are gated.');
    });

    await request(app.getHttpServer())
      .post('/operations/messages/message-1/actions/create-order')
      .send({ organizationId: 'org-1', totalAmount: 15000, currency: 'NGN' })
      .expect(403);
  });
});

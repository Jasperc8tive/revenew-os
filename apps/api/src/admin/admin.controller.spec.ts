import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MembershipRole } from '@prisma/client';
import request = require('supertest');
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('AdminController (e2e)', () => {
  let app: INestApplication;

  const adminServiceMock = {
    listMembers: jest.fn(),
    updateMemberRole: jest.fn(),
    getWorkspaceSettings: jest.fn(),
    upsertWorkspaceSettings: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    adminServiceMock.listMembers.mockImplementation(async () => [
      {
        id: 'membership-1',
        role: MembershipRole.OWNER,
        user: { id: 'user-1', email: 'owner@example.com', phoneNumber: '+2348011111111' },
      },
    ]);

    adminServiceMock.updateMemberRole.mockImplementation(async () => ({
      id: 'membership-2',
      role: MembershipRole.DELIVERY_MANAGER,
      user: { id: 'user-2', email: 'ops@example.com', phoneNumber: null },
    }));

    adminServiceMock.getWorkspaceSettings.mockImplementation(async () => ({
      organizationId: 'org-1',
      organizationDefaults: { defaultCurrency: 'NGN' },
      preferences: { notifications: { email: true } },
    }));

    adminServiceMock.upsertWorkspaceSettings.mockImplementation(async () => ({
      organizationId: 'org-1',
      organizationDefaults: { defaultCurrency: 'USD' },
      preferences: { notifications: { email: false } },
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: adminServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /admin/members returns workspace members', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/members?organizationId=org-1')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].role).toBe(MembershipRole.OWNER);
  });

  it('PATCH /admin/members/:id/role updates member role', async () => {
    const response = await request(app.getHttpServer())
      .patch('/admin/members/membership-2/role')
      .send({ organizationId: 'org-1', role: MembershipRole.DELIVERY_MANAGER })
      .expect(200);

    expect(response.body.role).toBe(MembershipRole.DELIVERY_MANAGER);
    expect(adminServiceMock.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'system-user' }),
    );
  });

  it('GET /admin/settings returns workspace settings', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/settings?organizationId=org-1')
      .expect(200);

    expect(response.body.organizationDefaults.defaultCurrency).toBe('NGN');
  });

  it('PUT /admin/settings upserts workspace settings', async () => {
    const response = await request(app.getHttpServer())
      .put('/admin/settings')
      .send({
        organizationId: 'org-1',
        organizationDefaults: { defaultCurrency: 'USD' },
        preferences: { notifications: { email: false } },
      })
      .expect(200);

    expect(response.body.organizationDefaults.defaultCurrency).toBe('USD');
    expect(adminServiceMock.upsertWorkspaceSettings).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'system-user' }),
    );
  });
});

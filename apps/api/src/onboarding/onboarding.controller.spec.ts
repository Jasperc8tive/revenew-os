import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

describe('OnboardingController (e2e)', () => {
  let app: INestApplication;

  const onboardingServiceMock = {
    getProgress: jest.fn(),
    updateStep: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    onboardingServiceMock.getProgress.mockImplementation(async () => ({
      organizationId: 'org-1',
      checklist: { connect_integration: true },
      progress: { completed: 1, total: 7, percent: 14 },
      gates: { advancedWorkflowsEnabled: false, blockedReasons: ['setup_billing'] },
    }));

    onboardingServiceMock.updateStep.mockImplementation(async () => ({
      organizationId: 'org-1',
      checklist: { connect_integration: true, setup_billing: true },
      progress: { completed: 2, total: 7, percent: 29 },
      gates: { advancedWorkflowsEnabled: false, blockedReasons: ['invite_team'] },
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [{ provide: OnboardingService, useValue: onboardingServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /onboarding/progress returns persisted checklist progress', async () => {
    const response = await request(app.getHttpServer())
      .get('/onboarding/progress?organizationId=org-1')
      .expect(200);

    expect(response.body.organizationId).toBe('org-1');
    expect(response.body.progress.total).toBe(7);
  });

  it('PATCH /onboarding/steps/:step updates checklist step completion', async () => {
    const response = await request(app.getHttpServer())
      .patch('/onboarding/steps/setup_billing?organizationId=org-1')
      .send({ completed: true })
      .expect(200);

    expect(response.body.checklist.setup_billing).toBe(true);
    expect(onboardingServiceMock.updateStep).toHaveBeenCalledWith('org-1', 'setup_billing', true);
  });

  it('GET /onboarding/gates returns onboarding gate status', async () => {
    const response = await request(app.getHttpServer())
      .get('/onboarding/gates?organizationId=org-1')
      .expect(200);

    expect(response.body.gates.advancedWorkflowsEnabled).toBe(false);
    expect(response.body.progress.completed).toBe(1);
  });
});

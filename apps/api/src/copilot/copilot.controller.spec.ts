import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request = require('supertest');
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

describe('CopilotController (e2e)', () => {
  let app: INestApplication;

  const copilotServiceMock = {
    createConversation: jest.fn(),
    getConversation: jest.fn(),
    chat: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CopilotController],
      providers: [
        {
          provide: CopilotService,
          useValue: copilotServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /copilot/conversations creates a conversation', async () => {
    copilotServiceMock.createConversation.mockImplementation(async () => ({
      id: 'conv-1',
      organizationId: 'org-1',
      title: 'Growth Copilot Session',
      messages: [],
    }));

    const response = await request(app.getHttpServer())
      .post('/copilot/conversations')
      .send({ organizationId: 'org-1' })
      .expect(201);

    expect(response.body.id).toBe('conv-1');
  });

  it('GET /copilot/conversations/:id returns conversation messages', async () => {
    copilotServiceMock.getConversation.mockImplementation(async () => ({
      id: 'conv-1',
      organizationId: 'org-1',
      messages: [
        {
          id: 'msg-1',
          role: 'USER',
          content: 'How can we improve conversion?',
        },
      ],
    }));

    const response = await request(app.getHttpServer())
      .get('/copilot/conversations/conv-1?organizationId=org-1')
      .expect(200);

    expect(response.body.messages).toHaveLength(1);
  });

  it('POST /copilot/conversations/:id/messages returns assistant response payload', async () => {
    copilotServiceMock.chat.mockImplementation(async () => ({
      conversationId: 'conv-1',
      messages: [
        { id: 'msg-user', role: 'USER', content: 'Prompt' },
        { id: 'msg-assistant', role: 'ASSISTANT', content: 'Actionable recommendation' },
      ],
    }));

    const response = await request(app.getHttpServer())
      .post('/copilot/conversations/conv-1/messages')
      .send({ organizationId: 'org-1', content: 'What should we do next week?' })
      .expect(201);

    expect(response.body.messages[1].role).toBe('ASSISTANT');
  });
});

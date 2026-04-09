import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeAll, beforeEach, afterAll, describe, expect, it, jest } from '@jest/globals';
import { CopilotRole, MembershipRole, RecommendationStatus } from '@prisma/client';
import request = require('supertest');
import { AnalyticsService } from '../analytics/analytics.service';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import * as LlmAdapterModule from './llm-adapter';
import { GovernanceController } from '../governance/governance.controller';
import { GovernanceService } from '../governance/governance.service';
import { GrowthIntelligenceService } from '../growth-intelligence/growth-intelligence.service';

type ConversationRecord = {
  id: string;
  organizationId: string;
  title: string;
};

type MessageRecord = {
  id: string;
  conversationId: string;
  role: CopilotRole;
  content: string;
  contextSnapshot?: unknown;
  createdAt: Date;
};

describe('Copilot -> Governance chain (e2e)', () => {
  let app: INestApplication;

  const conversations = new Map<string, ConversationRecord>();
  const messages: MessageRecord[] = [];
  const qualityGates: Array<Record<string, unknown>> = [];

  const prismaMock = {
    organization: {
      findUnique: jest.fn(async () => ({ id: 'org-1', name: 'Org One', industry: 'retail' })),
    },
    verifiedMetricSnapshot: {
      findMany: jest.fn(async () => [
        {
          id: 'm1',
          metricKey: 'revenue',
          sampleSize: 180,
          windowType: 'DAILY',
          metricValue: 120000,
        },
      ]),
    },
    recommendation: {
      findMany: jest.fn(async () => [
        {
          id: 'rec-1',
          recommendation: 'Increase retargeting spend by 10%',
          status: RecommendationStatus.PENDING,
          priority: 1,
          confidenceScore: 0.84,
          traceId: 'trace-1',
          createdAt: new Date(),
        },
      ]),
    },
    experiment: {
      findMany: jest.fn(async () => []),
    },
    competitorSignal: {
      findMany: jest.fn(async () => []),
    },
    membership: {
      findFirst: jest.fn(async ({ where }: { where: { userId: string } }) => {
        if (where.userId === 'staff-1') {
          return { role: MembershipRole.STAFF };
        }

        return { role: MembershipRole.OWNER };
      }),
    },
    copilotConversation: {
      create: jest.fn(async ({ data }: { data: { organizationId: string; title: string } }) => {
        const id = `conv-${conversations.size + 1}`;
        const row: ConversationRecord = {
          id,
          organizationId: data.organizationId,
          title: data.title,
        };
        conversations.set(id, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where, include }: any) => {
        const row = conversations.get(where.id);
        if (!row || row.organizationId !== where.organizationId) {
          return null;
        }

        if (include?.messages) {
          return {
            ...row,
            messages: messages
              .filter((m) => m.conversationId === row.id)
              .map((m) => ({ role: m.role, content: m.content })),
          };
        }

        return {
          ...row,
          messages: messages
            .filter((m) => m.conversationId === row.id)
            .map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
        };
      }),
    },
    copilotMessage: {
      create: jest.fn(async ({ data }: { data: { conversationId: string; role: CopilotRole; content: string; contextSnapshot: unknown } }) => {
        const row: MessageRecord = {
          id: `msg-${messages.length + 1}`,
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          contextSnapshot: data.contextSnapshot,
          createdAt: new Date(),
        };
        messages.push(row);
        return {
          id: row.id,
          role: row.role,
          content: row.content,
          createdAt: row.createdAt,
        };
      }),
    },
    $executeRawUnsafe: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('INSERT INTO governance_quality_gates')) {
        qualityGates.unshift({
          organization_id: params[0],
          feature: params[1],
          tests_passed: params[2],
          observability_ready: params[3],
          rollback_ready: params[4],
          updated_by: params[5],
          updated_at: new Date().toISOString(),
        });
      }
      return 1;
    }),
    $queryRawUnsafe: jest.fn(async (sql: string, orgId: string) => {
      if (sql.includes('FROM governance_quality_gates')) {
        return qualityGates.filter((row) => row.organization_id === orgId);
      }
      return [];
    }),
  } as unknown as PrismaService;

  const billingMock = {
    assertFeatureAccess: jest.fn(async () => true),
  } as unknown as BillingAccessService;

  const analyticsMock = {
    getExecutiveSummary: jest.fn(async () => ({
      organizationId: 'org-1',
      revenue: 500000,
      growthRate: 0.12,
      topRecommendation: 'Increase retargeting spend by 10%',
    })),
  } as unknown as AnalyticsService;

  const generateFn = jest.fn(async () => [
    'Situation: Conversion plateau identified.',
    'Risks: Delayed optimization can reduce margin.',
    'Action Plan:\n1. Increase retargeting spend by 10%.\n2. Re-score cohort signals.\n3. Track daily ROI for 7 days.',
    'Evidence: recommendation rec-1 confidence 0.84.',
    'Fallback: Use baseline allocation if CPA increases >8%.',
  ].join('\n\n'));

  beforeAll(async () => {
    jest.spyOn(LlmAdapterModule, 'createLlmAdapter').mockReturnValue({
      generate: generateFn,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CopilotController, GovernanceController],
      providers: [
        CopilotService,
        GovernanceService,
        GrowthIntelligenceService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: BillingAccessService,
          useValue: billingMock,
        },
        {
          provide: AnalyticsService,
          useValue: analyticsMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    conversations.clear();
    messages.splice(0, messages.length);
    qualityGates.splice(0, qualityGates.length);
  });

  afterAll(async () => {
    await app.close();
  });

  it('chains graph context into copilot recommendation and owner governance gate update', async () => {
    const createConversation = await request(app.getHttpServer())
      .post('/copilot/conversations')
      .send({ organizationId: 'org-1', title: 'Chain test' })
      .expect(201);

    const conversationId = createConversation.body.id;

    const copilotReply = await request(app.getHttpServer())
      .post(`/copilot/conversations/${conversationId}/messages`)
      .send({
        organizationId: 'org-1',
        content: 'Give me the next best growth action this week.',
      })
      .expect(201);

    expect(copilotReply.body.messages[1].content).toContain('Action Plan');

    const contextSnapshot = messages.find((m) => m.role === CopilotRole.USER)?.contextSnapshot as {
      strategicContext?: unknown;
    };
    expect(contextSnapshot?.strategicContext).toBeDefined();

    const gateResponse = await request(app.getHttpServer())
      .post('/governance/quality-gates')
      .set('x-user-id', 'owner-1')
      .set('x-user-role', `${MembershipRole.OWNER}`)
      .send({
        organizationId: 'org-1',
        feature: 'copilot-graph-loop',
        testsPassed: true,
        observabilityReady: true,
        rollbackReady: true,
      })
      .expect(201);

    expect(gateResponse.body[0].feature).toBe('copilot-graph-loop');
  });

  it('blocks staff from governance quality gate mutation', async () => {
    await request(app.getHttpServer())
      .post('/governance/quality-gates')
      .set('x-user-id', 'staff-1')
      .set('x-user-role', `${MembershipRole.STAFF}`)
      .send({
        organizationId: 'org-1',
        feature: 'copilot-graph-loop',
        testsPassed: true,
        observabilityReady: true,
        rollbackReady: true,
      })
      .expect(403);
  });
});

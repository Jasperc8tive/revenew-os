import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeAll, beforeEach, afterAll, describe, expect, it, jest } from '@jest/globals';
import {
  DataQualityEventType,
  DataQualitySeverity,
  DataQualitySource,
  Prisma,
} from '@prisma/client';
import request = require('supertest');
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { DataQualityController } from './data-quality.controller';
import { DataQualityService } from './data-quality.service';

type StoredEvent = {
  id: string;
  organizationId: string;
  integrationId: string | null;
  dedupeKey: string | null;
  eventType: DataQualityEventType;
  severity: DataQualitySeverity;
  source: DataQualitySource;
  code: string;
  message: string;
  details: Prisma.JsonValue | null;
  occurredAt: Date;
  createdAt: Date;
};

describe('DataQualityController (e2e)', () => {
  let app: INestApplication;

  const organizationId = 'org-dq-e2e';
  const events = new Map<string, StoredEvent>();

  const buildCompositeKey = (orgId: string, code: string, dedupeKey: string | null) =>
    `${orgId}:${code}:${dedupeKey ?? '__none__'}`;

  const dailyMetricRows = Array.from({ length: 8 }, (_, index) => {
    const date = new Date('2026-04-01T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + index);
    const isLatest = index === 7;

    return {
      organizationId,
      date,
      revenue: new Prisma.Decimal(isLatest ? 1000000 : 100000),
      cac: new Prisma.Decimal(5000),
      ltv: new Prisma.Decimal(45000),
      churn: new Prisma.Decimal(0.02),
    };
  });

  const prismaMock = {
    dailyMetrics: {
      findMany: jest.fn(async () => dailyMetricRows),
    },
    dataQualityEvent: {
      findMany: jest.fn(async (args: { where?: any; orderBy?: any; take?: number }) => {
        const filtered = [...events.values()]
          .filter((row) => row.organizationId === args.where?.organizationId)
          .filter((row) => (args.where?.eventType ? row.eventType === args.where.eventType : true))
          .filter((row) => (args.where?.severity ? row.severity === args.where.severity : true))
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

        if (typeof args.take === 'number') {
          return filtered.slice(0, args.take);
        }

        return filtered;
      }),
      upsert: jest.fn(async (args: { where: any; create: any; update: any }) => {
        const composite = args.where.organizationId_code_dedupeKey;
        const key = buildCompositeKey(
          composite.organizationId,
          composite.code,
          composite.dedupeKey,
        );
        const existing = events.get(key);

        if (existing) {
          const updated: StoredEvent = {
            ...existing,
            ...args.update,
            occurredAt: args.update.occurredAt ?? existing.occurredAt,
          };
          events.set(key, updated);
          return updated;
        }

        const created: StoredEvent = {
          id: `event-${events.size + 1}`,
          organizationId: args.create.organizationId,
          integrationId: args.create.integrationId ?? null,
          dedupeKey: args.create.dedupeKey ?? null,
          eventType: args.create.eventType,
          severity: args.create.severity,
          source: args.create.source,
          code: args.create.code,
          message: args.create.message,
          details: (args.create.details ?? null) as Prisma.JsonValue | null,
          occurredAt: new Date(),
          createdAt: new Date(),
        };
        events.set(key, created);
        return created;
      }),
    },
  } as unknown as PrismaService;

  const billingAccessMock = {
    assertFeatureAccess: jest.fn(async () => true),
  } as unknown as BillingAccessService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DataQualityController],
      providers: [
        DataQualityService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: BillingAccessService,
          useValue: billingAccessMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: false, whitelist: true }));
    await app.init();
  });

  beforeEach(() => {
    events.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('parses string limit into numeric take for events listing', async () => {
    const key = buildCompositeKey(organizationId, 'ANOMALY_REVENUE', 'rev:2026-04-07:30');
    events.set(key, {
      id: 'seed-1',
      organizationId,
      integrationId: null,
      dedupeKey: 'rev:2026-04-07:30',
      eventType: DataQualityEventType.ANOMALY,
      severity: DataQualitySeverity.MEDIUM,
      source: DataQualitySource.ANALYTICS,
      code: 'ANOMALY_REVENUE',
      message: 'Revenue anomaly',
      details: null,
      occurredAt: new Date('2026-04-07T00:00:00.000Z'),
      createdAt: new Date('2026-04-07T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .get('/data-quality/events')
      .query({ organizationId, eventType: 'ANOMALY', limit: '10' })
      .expect(200);

    const findManyCalls = (prismaMock.dataQualityEvent.findMany as jest.Mock).mock.calls;
    const firstQuery = findManyCalls[0]?.[0] as { take?: number };

    expect(findManyCalls).toHaveLength(1);
    expect(firstQuery).toEqual(expect.objectContaining({ take: 10 }));
    expect(typeof firstQuery.take).toBe('number');
  });

  it('prevents duplicate anomaly rows across repeated scans', async () => {
    await request(app.getHttpServer())
      .post('/data-quality/anomalies/scan')
      .query({ organizationId, lookbackDays: 30 })
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post('/data-quality/anomalies/scan')
      .query({ organizationId, lookbackDays: 30 })
      .send({})
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/data-quality/events')
      .query({ organizationId, eventType: 'ANOMALY', limit: 50 })
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].code).toBe('ANOMALY_REVENUE');
    expect(response.body[0].dedupeKey).toBe('revenue:2026-04-08:30');
    expect(prismaMock.dataQualityEvent.upsert).toHaveBeenCalledTimes(2);
  });
});

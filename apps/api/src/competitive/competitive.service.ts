import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Competitor, CompetitorSignal, CompetitorSignalType, Prisma } from '@prisma/client';
import { BillingAccessService } from '../billing/billing-access.service';
import { createLlmAdapter, LlmMessage } from '../copilot/llm-adapter';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CompetitiveAlertEvalRule,
  CompetitorComparisonEntry,
  CreateCompetitorInput,
  CreateCompetitorSignalInput,
  ListCompetitorSignalsFilters,
  TrendBucket,
} from './competitive.types';

@Injectable()
export class CompetitiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async createCompetitor(organizationId: string, input: CreateCompetitorInput): Promise<Competitor> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    if (!input.name?.trim()) {
      throw new BadRequestException('Competitor name is required');
    }

    try {
      return await this.prisma.competitor.create({
        data: {
          organizationId,
          name: input.name.trim(),
          website: input.website?.trim() || null,
          industry: input.industry ?? null,
          notes: input.notes?.trim() || null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('A competitor with this name already exists');
      }
      throw err;
    }
  }

  async listCompetitors(organizationId: string): Promise<Competitor[]> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    return this.prisma.competitor.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createSignal(
    organizationId: string,
    input: CreateCompetitorSignalInput,
  ): Promise<CompetitorSignal> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const competitor = await this.prisma.competitor.findUnique({
      where: { id: input.competitorId },
    });

    if (!competitor) {
      throw new NotFoundException('Competitor not found');
    }

    if (competitor.organizationId !== organizationId) {
      throw new ForbiddenException('Not authorized to add signal for this competitor');
    }

    if (!input.value?.trim()) {
      throw new BadRequestException('Signal value is required');
    }

    const signalDate = new Date(input.date);
    if (Number.isNaN(signalDate.getTime())) {
      throw new BadRequestException('Invalid signal date');
    }

    const existing = await this.prisma.competitorSignal.findFirst({
      where: {
        competitorId: input.competitorId,
        signalType: input.signalType,
        value: input.value.trim(),
        source: input.source?.trim() || null,
        date: signalDate,
      },
    });

    if (existing) {
      return existing;
    }

    const relevanceScore = this.computeSignalRelevanceScore(input.signalType, input.source, input.notes);

    return this.prisma.competitorSignal.create({
      data: {
        competitorId: input.competitorId,
        signalType: input.signalType,
        value: input.value.trim(),
        unit: input.unit?.trim() || null,
        source: input.source?.trim() || null,
        date: signalDate,
        notes: this.attachSignalMeta(input.notes, relevanceScore),
      },
    });
  }

  async listSignals(
    organizationId: string,
    filters: ListCompetitorSignalsFilters,
  ): Promise<Array<CompetitorSignal & { competitor: { id: string; name: string } }>> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const where: Prisma.CompetitorSignalWhereInput = {
      competitor: { organizationId },
    };

    if (filters.competitorId) {
      where.competitorId = filters.competitorId;
    }

    if (filters.signalType) {
      where.signalType = filters.signalType;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    return this.prisma.competitorSignal.findMany({
      where,
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  async getOverview(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const [competitorCount, signalCount, recentSignals, signalTypeBreakdownRaw] = await Promise.all([
      this.prisma.competitor.count({ where: { organizationId } }),
      this.prisma.competitorSignal.count({ where: { competitor: { organizationId } } }),
      this.prisma.competitorSignal.findMany({
        where: { competitor: { organizationId } },
        include: {
          competitor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      this.prisma.competitorSignal.groupBy({
        by: ['signalType'],
        where: { competitor: { organizationId } },
        _count: { signalType: true },
      }),
    ]);

    const signalTypeBreakdown = signalTypeBreakdownRaw.map((item) => ({
      signalType: item.signalType,
      count: item._count.signalType,
    }));

    return {
      organizationId,
      competitorCount,
      signalCount,
      signalTypeBreakdown,
      recentSignals,
    };
  }

  async getSignalTrend(
    organizationId: string,
    days = 30,
    competitorId?: string,
    signalType?: CompetitorSignalType,
  ): Promise<{ window: number; buckets: TrendBucket[] }> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Prisma.CompetitorSignalWhereInput = {
      competitor: { organizationId },
      date: { gte: startDate },
    };
    if (competitorId) where.competitorId = competitorId;
    if (signalType) where.signalType = signalType;

    const signals = await this.prisma.competitorSignal.findMany({
      where,
      select: { date: true, signalType: true },
      orderBy: { date: 'asc' },
    });

    const bucketMap = new Map<string, TrendBucket>();
    for (const signal of signals) {
      const dateKey = signal.date.toISOString().slice(0, 10);
      if (!bucketMap.has(dateKey)) {
        bucketMap.set(dateKey, { date: dateKey, total: 0, byType: {} });
      }
      const bucket = bucketMap.get(dateKey)!;
      bucket.total += 1;
      bucket.byType[signal.signalType] = (bucket.byType[signal.signalType] ?? 0) + 1;
    }

    const buckets = Array.from(bucketMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return { window: days, buckets };
  }

  async getCompetitorComparison(
    organizationId: string,
    days = 30,
  ): Promise<{ days: number; competitors: CompetitorComparisonEntry[] }> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [competitors, signals] = await Promise.all([
      this.prisma.competitor.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.competitorSignal.findMany({
        where: {
          competitor: { organizationId },
          date: { gte: startDate },
        },
        select: { competitorId: true, signalType: true },
      }),
    ]);

    const countMap = new Map<string, Partial<Record<CompetitorSignalType, number>>>();
    for (const signal of signals) {
      if (!countMap.has(signal.competitorId)) {
        countMap.set(signal.competitorId, {});
      }
      const counts = countMap.get(signal.competitorId)!;
      counts[signal.signalType] = (counts[signal.signalType] ?? 0) + 1;
    }

    const entries: CompetitorComparisonEntry[] = competitors.map((comp) => {
      const signalCounts = countMap.get(comp.id) ?? {};
      const total = Object.values(signalCounts).reduce((sum, n) => sum + n, 0);
      return { id: comp.id, name: comp.name, signalCounts, total };
    });

    return { days, competitors: entries };
  }

  async getActionableDeltas(organizationId: string, days = 14) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const since = new Date();
    since.setDate(since.getDate() - days);

    const signals = await this.prisma.competitorSignal.findMany({
      where: {
        competitor: { organizationId },
        date: { gte: since },
      },
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }],
      take: 100,
    });

    const deltas = signals
      .map((signal) => {
        const relevanceScore = this.computeSignalRelevanceScore(signal.signalType, signal.source, signal.notes);
        const urgency = relevanceScore >= 0.85 ? 'high' : relevanceScore >= 0.7 ? 'medium' : 'low';

        return {
          signalId: signal.id,
          competitorId: signal.competitor.id,
          competitorName: signal.competitor.name,
          signalType: signal.signalType,
          observedValue: signal.value,
          observedAt: signal.date.toISOString(),
          relevanceScore,
          urgency,
          suggestedAction:
            signal.signalType === CompetitorSignalType.PRODUCT_LAUNCH
              ? 'Review feature parity and position differentiators in campaign messaging.'
              : signal.signalType === CompetitorSignalType.AD_SPEND
                ? 'Audit paid channel efficiency and protect high-intent cohorts.'
                : signal.signalType === CompetitorSignalType.HIRING
                  ? 'Track category expansion risk and update account defense plan.'
                  : 'Monitor signal trajectory and incorporate into weekly strategy sync.',
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);

    return {
      organizationId,
      windowDays: days,
      deltas,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateWeeklyBrief(
    organizationId: string,
  ): Promise<{ brief: string; generatedAt: string; signalCount: number }> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSignals = await this.prisma.competitorSignal.findMany({
      where: {
        competitor: { organizationId },
        date: { gte: sevenDaysAgo },
      },
      include: { competitor: { select: { name: true } } },
      orderBy: { date: 'desc' },
    });

    if (recentSignals.length === 0) {
      return {
        brief:
          'No competitor signals logged in the last 7 days. Add signals via the Competitive Intelligence dashboard to generate a brief.',
        generatedAt: new Date().toISOString(),
        signalCount: 0,
      };
    }

    const signalLines = recentSignals
      .map(
        (s) =>
          `- ${s.competitor.name} | ${s.signalType} | ${s.value}${s.unit ? ' ' + s.unit : ''}` +
          ` | ${s.date.toISOString().slice(0, 10)}${s.source ? ' (source: ' + s.source + ')' : ''}`,
      )
      .join('\n');

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'You are a competitive intelligence analyst for a Nigerian SMB SaaS platform. ' +
          'Analyze the provided competitor signals from the past 7 days and produce a concise weekly brief.\n' +
          'Format your response as:\n' +
          '1. Executive Summary (2-3 sentences)\n' +
          '2. Key Signals by Competitor (bullet points)\n' +
          '3. Strategic Implications (what should this business watch out for or act on?)\n' +
          '4. Recommended Actions (1-3 specific, actionable steps)\n' +
          'Keep it under 300 words. Be direct and actionable.',
      },
      {
        role: 'user',
        content: `Competitor signals logged in the past 7 days:\n\n${signalLines}\n\nGenerate the weekly competitive intelligence brief including competitive deltas and action priorities.`,
      },
    ];

    const adapter = createLlmAdapter();
    const brief = await adapter.generate({ messages });

    return { brief, generatedAt: new Date().toISOString(), signalCount: recentSignals.length };
  }

  async evaluateAlerts(
    organizationId: string,
    rules: CompetitiveAlertEvalRule[],
  ): Promise<{
    rules: Array<{
      competitorId: string | null;
      competitorName: string | null;
      signalType: CompetitorSignalType;
      windowDays: number;
      threshold: number;
      actualCount: number;
      triggered: boolean;
    }>;
    evaluatedAt: string;
  }> {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const results = await Promise.all(
      rules.map(async (rule) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - rule.windowDays);

        const where: Prisma.CompetitorSignalWhereInput = {
          competitor: { organizationId },
          signalType: rule.signalType,
          date: { gte: startDate },
        };

        let competitorName: string | null = null;
        if (rule.competitorId) {
          where.competitorId = rule.competitorId;
          const comp = await this.prisma.competitor.findUnique({
            where: { id: rule.competitorId },
            select: { name: true },
          });
          competitorName = comp?.name ?? null;
        }

        const actualCount = await this.prisma.competitorSignal.count({ where });

        return {
          competitorId: rule.competitorId ?? null,
          competitorName,
          signalType: rule.signalType,
          windowDays: rule.windowDays,
          threshold: rule.minCount,
          actualCount,
          triggered: actualCount >= rule.minCount,
        };
      }),
    );

    return { rules: results, evaluatedAt: new Date().toISOString() };
  }

  private computeSignalRelevanceScore(
    signalType: CompetitorSignalType,
    source?: string | null,
    notes?: string | null,
  ) {
    const baseWeight: Record<CompetitorSignalType, number> = {
      TRAFFIC: 0.8,
      HIRING: 0.68,
      AD_SPEND: 0.86,
      PRODUCT_LAUNCH: 0.92,
      OTHER: 0.55,
    };

    const sourceBoost = source ? 0.05 : 0;
    const notesBoost = notes && notes.toLowerCase().includes('verified') ? 0.08 : 0;
    return Number(Math.min(baseWeight[signalType] + sourceBoost + notesBoost, 1).toFixed(4));
  }

  private attachSignalMeta(notes: string | undefined, relevanceScore: number) {
    const normalizedNotes = notes?.trim();
    const marker = `[relevance:${relevanceScore.toFixed(2)}]`;

    if (!normalizedNotes) {
      return marker;
    }

    if (normalizedNotes.includes('[relevance:')) {
      return normalizedNotes;
    }

    return `${normalizedNotes} ${marker}`;
  }
}

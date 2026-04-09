import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BillingAccessService } from '../billing/billing-access.service';

export interface GraphNode {
  id: string;
  type: 'organization' | 'metric' | 'recommendation' | 'experiment' | 'competitor_signal';
  label: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation:
    | 'has_metric'
    | 'informs'
    | 'tests'
    | 'impacts'
    | 'competes_with'
    | 'supports_recommendation';
  weight?: number;
}

@Injectable()
export class GrowthIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async buildGraph(organizationId: string) {
    await this.billingAccessService.assertFeatureAccess(organizationId, 'analytics.full');

    const [organization, metrics, recommendations, experiments, signals] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, industry: true },
      }),
      this.prisma.verifiedMetricSnapshot.findMany({
        where: { organizationId },
        orderBy: { verifiedAt: 'desc' },
        take: 10,
      }),
      this.prisma.recommendation.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.experiment.findMany({
        where: { organizationId },
        include: {
          variants: {
            include: {
              results: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.competitorSignal.findMany({
        where: { competitor: { organizationId } },
        include: {
          competitor: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    const orgNodeId = `org:${organizationId}`;
    const nodes: GraphNode[] = [
      {
        id: orgNodeId,
        type: 'organization',
        label: organization?.name ?? organizationId,
        metadata: {
          industry: organization?.industry ?? null,
        },
      },
    ];

    const edges: GraphEdge[] = [];

    metrics.forEach((metric) => {
      const nodeId = `metric:${metric.id}`;
      const score = Number(metric.sampleSize ?? 0) >= 100 ? 0.9 : Number(metric.sampleSize ?? 0) >= 25 ? 0.7 : 0.5;
      nodes.push({
        id: nodeId,
        type: 'metric',
        label: metric.metricKey,
        score,
        metadata: {
          windowType: metric.windowType,
          value: Number(metric.metricValue),
          sampleSize: metric.sampleSize,
        },
      });
      edges.push({ source: orgNodeId, target: nodeId, relation: 'has_metric', weight: score });
    });

    recommendations.forEach((recommendation) => {
      const nodeId = `recommendation:${recommendation.id}`;
      const score = recommendation.confidenceScore ? Number(recommendation.confidenceScore) : 0.5;
      nodes.push({
        id: nodeId,
        type: 'recommendation',
        label: recommendation.recommendation,
        score,
        metadata: {
          status: recommendation.status,
          priority: recommendation.priority,
        },
      });
      edges.push({ source: orgNodeId, target: nodeId, relation: 'informs', weight: score });
    });

    experiments.forEach((experiment) => {
      const nodeId = `experiment:${experiment.id}`;
      const variantCount = experiment.variants.length;
      const totalSamples = experiment.variants
        .flatMap((variant) => variant.results)
        .reduce((sum, result) => sum + result.sampleSize, 0);
      const score = totalSamples > 500 ? 0.9 : totalSamples > 100 ? 0.75 : 0.55;

      nodes.push({
        id: nodeId,
        type: 'experiment',
        label: experiment.title,
        score,
        metadata: {
          status: experiment.status,
          targetMetric: experiment.targetMetric,
          variants: variantCount,
          sampleSize: totalSamples,
        },
      });

      edges.push({ source: orgNodeId, target: nodeId, relation: 'tests', weight: score });

      recommendations.slice(0, 3).forEach((recommendation) => {
        edges.push({
          source: nodeId,
          target: `recommendation:${recommendation.id}`,
          relation: 'supports_recommendation',
          weight: score,
        });
      });
    });

    signals.forEach((signal) => {
      const nodeId = `signal:${signal.id}`;
      const relevance = this.computeSignalRelevance(signal.signalType, signal.source, signal.notes);
      nodes.push({
        id: nodeId,
        type: 'competitor_signal',
        label: `${signal.competitor.name} ${signal.signalType}`,
        score: relevance,
        metadata: {
          competitorId: signal.competitor.id,
          value: signal.value,
          date: signal.date.toISOString(),
          source: signal.source,
        },
      });

      edges.push({ source: orgNodeId, target: nodeId, relation: 'competes_with', weight: relevance });
      recommendations.slice(0, 2).forEach((recommendation) => {
        edges.push({
          source: nodeId,
          target: `recommendation:${recommendation.id}`,
          relation: 'impacts',
          weight: relevance,
        });
      });
    });

    return {
      organizationId,
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
      summary: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        recommendationsLinked: recommendations.length,
      },
    };
  }

  async getStrategicContext(organizationId: string) {
    const graph = await this.buildGraph(organizationId);
    const highSignalNodes = graph.nodes
      .filter((node) => (node.score ?? 0) >= 0.75)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 8);

    return {
      organizationId,
      generatedAt: graph.generatedAt,
      graphSummary: graph.summary,
      strategicHighlights: highSignalNodes.map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        score: node.score ?? 0,
      })),
    };
  }

  private computeSignalRelevance(
    signalType: string,
    source: string | null,
    notes: string | null,
  ) {
    const signalWeights: Record<string, number> = {
      PRODUCT_LAUNCH: 0.95,
      AD_SPEND: 0.85,
      TRAFFIC: 0.8,
      HIRING: 0.7,
      OTHER: 0.5,
    };

    const sourceBoost = source ? 0.05 : 0;
    const notesBoost = notes && notes.toLowerCase().includes('high confidence') ? 0.1 : 0;

    return Math.min((signalWeights[signalType] ?? 0.55) + sourceBoost + notesBoost, 1);
  }
}

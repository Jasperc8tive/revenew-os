import { Injectable } from '@nestjs/common';
import { forecastRevenue, ForecastPoint } from '../../../../packages/analytics/src';
import { BillingAccessService } from '../billing/billing-access.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SimulateDto } from './dto/simulate.dto';

@Injectable()
export class ForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccessService: BillingAccessService,
  ) {}

  async simulate(input: SimulateDto) {
    await this.billingAccessService.assertFeatureAccess(input.organizationId, 'forecasting.advanced');

    const months = input.months ?? 12;
    const historicalData = await this.buildHistoricalSeries(input.organizationId);

    // Baseline: plain trend extrapolation from historical data
    const baseline = forecastRevenue(historicalData, months);

    // Scenario: apply compound revenue multiplier from input levers
    const multiplier = this.computeMultiplier(
      input.marketingSpendDeltaPct ?? 0,
      input.pricingDeltaPct ?? 0,
      input.churnDeltaPct ?? 0,
    );
    const scenario = baseline.map((point: ForecastPoint) => ({
      period: point.period,
      value: Number((point.value * multiplier).toFixed(2)),
    }));

    const baselineTotal = baseline.reduce((sum: number, p: ForecastPoint) => sum + p.value, 0);
    const scenarioTotal = scenario.reduce((sum: number, p: ForecastPoint) => sum + p.value, 0);
    const deltaRevenue = Number((scenarioTotal - baselineTotal).toFixed(2));
    const deltaRevenuePct =
      baselineTotal === 0 ? 0 : Number(((deltaRevenue / baselineTotal) * 100).toFixed(2));

    return {
      organizationId: input.organizationId,
      months,
      multiplier: Number(multiplier.toFixed(4)),
      baseline,
      scenario,
      summary: {
        baselineTotal: Number(baselineTotal.toFixed(2)),
        scenarioTotal: Number(scenarioTotal.toFixed(2)),
        deltaRevenue,
        deltaRevenuePct,
      },
    };
  }

  async simulateScenarios(input: SimulateDto) {
    const base = await this.simulate(input);

    const scenarioInputs = [
      {
        name: 'conservative',
        marketingSpendDeltaPct: Math.min((input.marketingSpendDeltaPct ?? 0) - 5, input.marketingSpendDeltaPct ?? 0),
        pricingDeltaPct: (input.pricingDeltaPct ?? 0) - 2,
        churnDeltaPct: (input.churnDeltaPct ?? 0) + 2,
        conversionRateDeltaPct: (input.conversionRateDeltaPct ?? 0) - 3,
        averageOrderValueDeltaPct: (input.averageOrderValueDeltaPct ?? 0) - 2,
      },
      {
        name: 'base',
        marketingSpendDeltaPct: input.marketingSpendDeltaPct ?? 0,
        pricingDeltaPct: input.pricingDeltaPct ?? 0,
        churnDeltaPct: input.churnDeltaPct ?? 0,
        conversionRateDeltaPct: input.conversionRateDeltaPct ?? 0,
        averageOrderValueDeltaPct: input.averageOrderValueDeltaPct ?? 0,
      },
      {
        name: 'aggressive',
        marketingSpendDeltaPct: (input.marketingSpendDeltaPct ?? 0) + 8,
        pricingDeltaPct: (input.pricingDeltaPct ?? 0) + 3,
        churnDeltaPct: Math.max((input.churnDeltaPct ?? 0) - 4, -20),
        conversionRateDeltaPct: (input.conversionRateDeltaPct ?? 0) + 5,
        averageOrderValueDeltaPct: (input.averageOrderValueDeltaPct ?? 0) + 4,
      },
    ];

    const scenarios = scenarioInputs.map((scenario) => {
      const multiplier = this.computeMultiplier(
        scenario.marketingSpendDeltaPct,
        scenario.pricingDeltaPct,
        scenario.churnDeltaPct,
      );

      const conversionFactor = 1 + scenario.conversionRateDeltaPct / 100;
      const aovFactor = 1 + scenario.averageOrderValueDeltaPct / 100;
      const scenarioMultiplier = Math.max(0, multiplier * conversionFactor * aovFactor);

      const scenarioSeries = base.baseline.map((point) => ({
        period: point.period,
        value: Number((point.value * scenarioMultiplier).toFixed(2)),
      }));

      const total = scenarioSeries.reduce((sum, point) => sum + point.value, 0);
      const baselineTotal = base.summary.baselineTotal;
      const deltaPct = baselineTotal === 0 ? 0 : Number((((total - baselineTotal) / baselineTotal) * 100).toFixed(2));
      const confidence = this.estimateScenarioConfidence(Math.abs(deltaPct));

      return {
        ...scenario,
        multiplier: Number(scenarioMultiplier.toFixed(4)),
        confidence,
        series: scenarioSeries,
        total: Number(total.toFixed(2)),
        deltaPct,
      };
    });

    const recommendationLinks = await this.prisma.recommendation.findMany({
      where: { organizationId: input.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        recommendation: true,
        confidenceScore: true,
        status: true,
      },
    });

    return {
      organizationId: input.organizationId,
      months: base.months,
      baseline: base,
      scenarios,
      interpretability: {
        topDrivers: [
          { driver: 'marketing_spend', impactDirection: 'positive' },
          { driver: 'conversion_rate', impactDirection: 'positive' },
          { driver: 'churn_rate', impactDirection: 'negative' },
          { driver: 'average_order_value', impactDirection: 'positive' },
        ],
      },
      recommendationLinks,
    };
  }

  private async buildHistoricalSeries(organizationId: string): Promise<ForecastPoint[]> {
    const rows = await this.prisma.monthlyMetrics.findMany({
      where: { organizationId },
      orderBy: { monthStart: 'asc' },
      select: { monthStart: true, revenue: true },
    });

    return rows.map((row) => ({
      period: row.monthStart.toISOString().slice(0, 7),
      value: Number(row.revenue),
    }));
  }

  /**
   * Compound multiplier combining three revenue levers.
   * Marketing spend increase → proportional revenue lift (simplified 1:1 pass-through).
   * Pricing delta → direct ARR multiplier.
   * Churn delta → inverse multiplier (higher churn = lower retention = lower revenue).
   */
  private computeMultiplier(
    marketingSpendDeltaPct: number,
    pricingDeltaPct: number,
    churnDeltaPct: number,
  ): number {
    const marketing = 1 + marketingSpendDeltaPct / 100;
    const pricing = 1 + pricingDeltaPct / 100;
    const churn = 1 - churnDeltaPct / 100;
    return Math.max(0, marketing * pricing * churn);
  }

  private estimateScenarioConfidence(deltaPctAbs: number) {
    if (deltaPctAbs <= 10) {
      return 'high';
    }

    if (deltaPctAbs <= 25) {
      return 'medium';
    }

    return 'low';
  }
}

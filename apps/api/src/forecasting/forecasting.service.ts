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
}

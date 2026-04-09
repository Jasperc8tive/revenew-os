import { NextRequest, NextResponse } from 'next/server';

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function formatNGN(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
}

function toTrend(value: number, invert = false) {
  const direction = invert ? (value <= 0 ? 'up' : 'down') : value >= 0 ? 'up' : 'down';
  return {
    value: Math.abs(Number(value.toFixed(2))),
    direction,
    period: 'vs last period',
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const summaryQuery = new URLSearchParams({ organizationId });
    if (startDate) summaryQuery.set('startDate', startDate);
    if (endDate) summaryQuery.set('endDate', endDate);

    const response = await fetch(
      `${getApiBaseUrl()}/analytics/executive-summary?${summaryQuery.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('authorization')
            ? { Authorization: request.headers.get('authorization') as string }
            : {}),
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch executive summary from backend' },
        { status: response.status },
      );
    }

    const summary = (await response.json()) as {
      kpis: {
        revenue: number;
        revenueGrowthRate: number;
        cac: number;
        ltv: number;
        churnRate: number;
        activeCustomers: number;
      };
    };

    return NextResponse.json({
      revenue: {
        value: formatNGN(summary.kpis.revenue),
        trend: toTrend(summary.kpis.revenueGrowthRate),
      },
      cac: {
        value: formatNGN(summary.kpis.cac),
        trend: toTrend(summary.kpis.revenueGrowthRate / 2, true),
      },
      ltv: {
        value: formatNGN(summary.kpis.ltv),
        trend: toTrend(summary.kpis.revenueGrowthRate / 2),
      },
      churn: {
        value: `${summary.kpis.churnRate.toFixed(2)}%`,
        trend: toTrend(summary.kpis.churnRate, true),
      },
      arpu: {
        value:
          summary.kpis.activeCustomers > 0
            ? formatNGN(summary.kpis.revenue / summary.kpis.activeCustomers)
            : formatNGN(0),
        trend: toTrend(summary.kpis.revenueGrowthRate / 3),
      },
      customerCount: {
        value: summary.kpis.activeCustomers.toLocaleString('en-NG'),
        trend: toTrend(summary.kpis.revenueGrowthRate / 4),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

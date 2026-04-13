import { NextRequest, NextResponse } from 'next/server';

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
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
      range: {
        endDate: string;
      };
      kpis: {
        revenue: number;
        ltvToCacRatio: number;
      };
      verifiedMetrics: Array<{
        windowStart: string;
        metricValue: number;
      }>;
      marketingPerformance: {
        byChannel: Array<{
          key: string;
          cac: number;
          newCustomers: number;
        }>;
      };
    };

    const revenueData = summary.verifiedMetrics.length
      ? summary.verifiedMetrics
          .slice()
          .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime())
          .map((metric) => ({
            date: new Date(metric.windowStart).toLocaleDateString('en-NG', {
              month: 'short',
              day: 'numeric',
            }),
            revenue: Number(metric.metricValue),
          }))
      : [
          {
            date: new Date(summary.range.endDate).toLocaleDateString('en-NG', {
              month: 'short',
              day: 'numeric',
            }),
            revenue: summary.kpis.revenue,
          },
        ];

    return NextResponse.json({
      revenueData,
      cacLtvData: summary.marketingPerformance.byChannel.map((channel) => ({
        period: channel.key,
        cac: Number(channel.cac.toFixed(2)),
        ltv: Number((summary.kpis.ltvToCacRatio * channel.cac).toFixed(2)),
      })),
      pipelineData: summary.marketingPerformance.byChannel.map((channel) => ({
        stage: channel.key,
        count: channel.newCustomers,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

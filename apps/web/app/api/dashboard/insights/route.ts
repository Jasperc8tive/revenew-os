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
      evidenceCards: Array<{
        id: string;
        title: string;
        description: string;
        impact: 'high' | 'medium' | 'low';
      }>;
    };

    const insights = summary.evidenceCards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      impact: card.impact,
      action: 'Review recommendation details',
    }));

    return NextResponse.json(insights);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

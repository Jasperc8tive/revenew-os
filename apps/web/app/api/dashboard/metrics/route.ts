import { NextRequest, NextResponse } from 'next/server';
import { mockMetrics } from '@/utils/mockData';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Query parameters: startDate, endDate, metric, segment, status
    // In a real app, these would be used to filter data
    void searchParams;

    // In a real app, you'd filter data based on these parameters
    // For now, we'll just return the mock metrics
    const filteredMetrics = {
      ...mockMetrics,
      // Apply filters if needed
      ...(status === 'demo' && { revenue: { ...mockMetrics.revenue, value: '$125K' } }),
    };

    return NextResponse.json(filteredMetrics);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

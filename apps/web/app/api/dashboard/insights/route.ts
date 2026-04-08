import { NextRequest, NextResponse } from 'next/server';
import { mockInsights } from '@/utils/mockData';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Query parameters: startDate, endDate
    // In a real app, these would be used to generate insights
    void searchParams;

    // In a real app, you'd generate insights based on the date range
    // For now, return mock insights
    return NextResponse.json(mockInsights);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

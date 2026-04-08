import { NextRequest, NextResponse } from 'next/server';
import {
  mockRevenueData,
  mockCACLTVData,
  mockPipelineData,
} from '@/utils/mockData';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Query parameters: startDate, endDate
    // In a real app, these would be used to filter data
    void searchParams;

    // In a real app, you'd filter chart data based on date range
    // For now, return mock chart data
    return NextResponse.json({
      revenueData: mockRevenueData,
      cacLtvData: mockCACLTVData,
      pipelineData: mockPipelineData,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

import { useEffect, useState } from 'react';
import { useDashboardStore } from '@/lib/store/dashboardStore';

export interface DashboardMetrics {
  revenue: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
  cac: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
  ltv: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
  churn: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
  arpu: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
  customerCount: { value: string; trend: { value: number; direction: 'up' | 'down'; period: string } };
}

export interface DashboardData {
  metrics: DashboardMetrics;
  revenueData: Array<{ date: string; revenue: number }>;
  cacLtvData: Array<{ period: string; cac: number; ltv: number }>;
  pipelineData: Array<{ stage: string; count: number }>;
  insights: Array<{ id: string; title: string; description: string; impact: 'high' | 'medium' | 'low'; action: string }>;
}

// Hook to fetch dashboard metrics
export function useDashboardMetrics() {
  const { filters, setLoading, setError } = useDashboardStore();
  const [data, setData] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString(),
          ...(filters.metric && { metric: filters.metric }),
          ...(filters.segment && { segment: filters.segment }),
          ...(filters.status && { status: filters.status }),
        });

        const response = await fetch(`/api/dashboard/metrics?${params}`);
        if (!response.ok) throw new Error('Failed to fetch metrics');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [filters, setLoading, setError]);

  return data;
}

// Hook to fetch revenue chart data
export function useDashboardCharts() {
  const { filters, setLoading, setError } = useDashboardStore();
  const [data, setData] = useState<{
    revenueData: Array<{ date: string; revenue: number }>;
    cacLtvData: Array<{ period: string; cac: number; ltv: number }>;
    pipelineData: Array<{ stage: string; count: number }>;
  } | null>(null);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString(),
        });

        const response = await fetch(`/api/dashboard/charts?${params}`);
        if (!response.ok) throw new Error('Failed to fetch chart data');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchCharts();
  }, [filters, setLoading, setError]);

  return data;
}

// Hook to fetch AI insights
export function useDashboardInsights() {
  const { filters, setLoading, setError } = useDashboardStore();
  const [data, setData] = useState<Array<{ id: string; title: string; description: string; impact: 'high' | 'medium' | 'low'; action: string }> | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString(),
        });

        const response = await fetch(`/api/dashboard/insights?${params}`);
        if (!response.ok) throw new Error('Failed to fetch insights');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [filters, setLoading, setError]);

  return data;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, AlertMetric, BenchmarkResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const metricOptions: AlertMetric[] = ['CAC', 'LTV', 'CHURN', 'REVENUE'];

function formatMetric(metric: AlertMetric, value: number) {
  if (metric === 'CHURN') {
    return `${(value * 100).toFixed(2)}%`;
  }

  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value)}`;
}

export default function BenchmarkingPage() {
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [metric, setMetric] = useState<AlertMetric>('CAC');
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBenchmarks = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.benchmarks.get(organizationId, metric);
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load benchmarks');
    } finally {
      setLoading(false);
    }
  }, [organizationId, metric]);

  useEffect(() => {
    if (!authLoading) {
      void loadBenchmarks();
    }
  }, [authLoading, loadBenchmarks]);

  const selectedMetricRow = useMemo(() => {
    return data?.metrics.find((entry) => entry.metric === metric) ?? null;
  }, [data, metric]);

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading benchmarks...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Sign in to view industry benchmarks.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Growth Intelligence Benchmarking</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Compare your performance to industry peers.
          </p>
        </div>
        <button
          onClick={() => void loadBenchmarks()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {metricOptions.map((option) => (
          <button
            key={option}
            onClick={() => setMetric(option)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              option === metric
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">{error}</div>
      )}

      {selectedMetricRow && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Your {metric}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatMetric(metric, selectedMetricRow.organizationValue)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Industry Median</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {formatMetric(metric, selectedMetricRow.industryMedian)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Delta vs Median</p>
            <p className={`mt-2 text-2xl font-semibold ${selectedMetricRow.delta > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {selectedMetricRow.delta > 0 ? '+' : ''}
              {selectedMetricRow.deltaPct.toFixed(2)}%
            </p>
            <p className="mt-1 text-xs text-slate-500">Sample size: {selectedMetricRow.sampleCount}</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Metric Distribution</h2>
        {selectedMetricRow ? (
          <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <p>P25: {formatMetric(metric, selectedMetricRow.p25)}</p>
            <p>Median: {formatMetric(metric, selectedMetricRow.industryMedian)}</p>
            <p>P75: {formatMetric(metric, selectedMetricRow.p75)}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No benchmark data available yet. Run benchmark aggregation first.</p>
        )}
      </div>
    </div>
  );
}

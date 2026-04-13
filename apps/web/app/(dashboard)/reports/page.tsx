'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ExecutiveSummary } from '@/lib/api';
import { formatNGN } from '@/utils/currency';
import { useAuth } from '@/hooks/useAuth';

type ReportCard = {
  icon: string;
  title: string;
  description: string;
};

const REPORT_CARDS: ReportCard[] = [
  {
    icon: '📊',
    title: 'Executive Summary',
    description: 'KPIs at a glance — revenue, growth rate, LTV, and CAC consolidated for leadership.',
  },
  {
    icon: '📈',
    title: 'Acquisition Report',
    description: 'Channel performance breakdown, cost per acquisition, and marketing spend efficiency.',
  },
  {
    icon: '🔄',
    title: 'Retention Analysis',
    description: 'Churn rate trends, customer lifetime value cohorts, and win-back opportunities.',
  },
  {
    icon: '🔮',
    title: 'Pipeline Report',
    description: 'Deal forecasts, conversion rates by stage, and expected revenue for the quarter.',
  },
  {
    icon: '✅',
    title: 'Data Quality Report',
    description: 'Integration health, anomaly events, validation failures, and data freshness scores.',
  },
  {
    icon: '⚙️',
    title: 'Custom Report',
    description: 'Build your own report by selecting metrics, time ranges, and segmentation filters.',
  },
];

function formatMetricValue(key: string, value: number): string {
  const pctKeys = ['revenueGrowthRate', 'churnRate', 'ltvToCacRatio'];
  if (pctKeys.includes(key)) {
    return `${value.toFixed(2)}%`;
  }
  const countKeys = ['activeCustomers'];
  if (countKeys.includes(key)) {
    return value.toLocaleString();
  }
  return formatNGN(value);
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    revenue: 'Revenue',
    revenueGrowthRate: 'Revenue Growth Rate',
    cac: 'Customer Acquisition Cost',
    ltv: 'Lifetime Value',
    ltvToCacRatio: 'LTV : CAC Ratio',
    churnRate: 'Churn Rate',
    activeCustomers: 'Active Customers',
    pipelineValue: 'Pipeline Value',
  };
  return labels[key] ?? key;
}

const KEY_KPI_KEYS = ['revenue', 'cac', 'ltv', 'churnRate', 'activeCustomers'] as const;

export default function ReportsPage() {
  const { organizationId, isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.analytics.getExecutiveSummary(organizationId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading) {
      void loadData();
    }
  }, [authLoading, loadData]);

  if (authLoading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-600 dark:text-slate-400">
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-amber-800 dark:text-amber-300">
        You need an authenticated session with an organization to view reports.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Revenue reports, KPI summaries, and data exports"
      />

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Key Metrics Summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Key Metrics</h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {KEY_KPI_KEYS.map((k) => (
              <div key={k} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {KEY_KPI_KEYS.map((key) => {
              const value = summary.kpis[key];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{metricLabel(key)}</p>
                  <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
                    {formatMetricValue(key, value)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">No metrics available.</p>
        )}

        {summary && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Period:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {new Date(summary.range.startDate).toLocaleDateString()} –{' '}
              {new Date(summary.range.endDate).toLocaleDateString()}
            </span>
            {summary.confidence && (
              <>
                <span className="mx-1">·</span>
                <span>Confidence:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {(summary.confidence.score * 100).toFixed(0)}%
                </span>
              </>
            )}
          </div>
        )}
      </section>

      {/* Report Types Grid */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Generate Reports</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_CARDS.map((card) => (
            <article
              key={card.title}
              className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl" role="img" aria-label={card.title}>
                  {card.icon}
                </span>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{card.title}</h3>
              </div>
              <p className="flex-1 text-sm text-slate-600 dark:text-slate-400">{card.description}</p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Generate
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Verified Metrics Table */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Verified Data Points</h2>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : summary && summary.verifiedMetrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Metric
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Window
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Value
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Sample Size
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Verified At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.verifiedMetrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white capitalize">
                      {metric.metricKey.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {metric.windowType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {metric.metricValue.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {metric.sampleSize.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(metric.verifiedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            No verified metrics available for this period.
          </div>
        )}
      </section>
    </div>
  );
}

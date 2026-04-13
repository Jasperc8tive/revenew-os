'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ExecutiveSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatNGN } from '@/utils/currency';

export default function AnalyticsPage() {
  const { organizationId } = useAuth();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.analytics.getExecutiveSummary(organizationId);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Revenue KPIs, growth trends, and data quality insights"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Revenue KPIs, growth trends, and data quality insights"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
        />
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-6 shadow-sm">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue KPIs, growth trends, and data quality insights"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}
      />

      {/* Suppression Banner */}
      {summary?.suppression ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-400 mb-1">
            Data Suppressed — {summary.suppression.reason.replace(/_/g, ' ')}
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">{summary.suppression.message}</p>
        </div>
      ) : null}

      {/* KPI Cards */}
      {summary ? (
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Key Performance Indicators</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.revenue)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenue Growth</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.revenueGrowthRate >= 0 ? '+' : ''}
                {summary.kpis.revenueGrowthRate.toFixed(1)}%
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">CAC</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.cac)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">LTV</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.ltv)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">LTV : CAC Ratio</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.ltvToCacRatio.toFixed(2)}x
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Churn Rate</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.churnRate.toFixed(1)}%
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Customers</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.activeCustomers.toLocaleString()}
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Pipeline Value</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.pipelineValue)}</p>
            </article>
          </div>
        </section>
      ) : null}

      {/* Top Recommendation */}
      {summary?.topRecommendation ? (
        <section className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide font-semibold text-indigo-600 dark:text-indigo-400 mb-2">Top Recommendation</p>
          <p className="text-sm text-slate-800 dark:text-slate-200">{summary.topRecommendation}</p>
        </section>
      ) : null}

      {/* Confidence Score */}
      {summary ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Data Confidence</h2>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full border-4 border-indigo-500 dark:border-indigo-400 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {Math.round(summary.confidence.score * 100)}%
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <p>
                <span className="font-medium text-slate-800 dark:text-slate-200">Data points:</span>{' '}
                {summary.confidence.diagnostics.dataPoints.toLocaleString()}
              </p>
              <p>
                <span className="font-medium text-slate-800 dark:text-slate-200">Anomalies (7d):</span>{' '}
                {summary.confidence.diagnostics.anomalyEventsLast7Days}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(
              [
                ['Volume', summary.confidence.components.volume],
                ['Consistency', summary.confidence.components.consistency],
                ['Variance', summary.confidence.components.variance],
                ['Anomaly', summary.confidence.components.anomaly],
                ['Freshness', summary.confidence.components.freshness],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {Math.round(value * 100)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Evidence Cards */}
      {summary && summary.evidenceCards.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Evidence Cards</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {summary.evidenceCards.map((card) => {
              const impactColors =
                card.impact === 'high'
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : card.impact === 'medium'
                    ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300';

              return (
                <article
                  key={card.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{card.title}</h3>
                    <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${impactColors}`}>
                      {card.impact.charAt(0).toUpperCase() + card.impact.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{card.description}</p>
                  {card.evidence.length > 0 ? (
                    <ul className="space-y-1">
                      {card.evidence.map((ev, idx) => (
                        <li key={idx} className="flex justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">{ev.label}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{ev.value}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Confidence: {Math.round(card.confidenceScore * 100)}%
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Verified Metrics Table */}
      {summary && summary.verifiedMetrics.length > 0 ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-4">Verified Metrics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-3 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Metric</th>
                  <th className="pb-3 text-right text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Value</th>
                  <th className="pb-3 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium pl-4">Window</th>
                  <th className="pb-3 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium pl-4">Date Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.verifiedMetrics.map((metric) => (
                  <tr key={metric.id}>
                    <td className="py-3 text-slate-900 dark:text-white font-medium">{metric.metricKey}</td>
                    <td className="py-3 text-right text-slate-900 dark:text-white">{formatNGN(metric.metricValue)}</td>
                    <td className="py-3 pl-4">
                      <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {metric.windowType}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(metric.windowStart).toLocaleDateString('en-NG')} —{' '}
                      {new Date(metric.windowEnd).toLocaleDateString('en-NG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Empty state */}
      {!summary ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300">No analytics data available yet. Connect integrations to start seeing insights.</p>
        </div>
      ) : null}
    </div>
  );
}

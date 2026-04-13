'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ExecutiveSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatNGN } from '@/utils/currency';

function RetentionHealthBadge({ churnRate }: { churnRate: number }) {
  if (churnRate < 5) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Healthy
      </span>
    );
  }
  if (churnRate <= 10) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        Monitor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900 px-3 py-1 text-sm font-semibold text-red-700 dark:text-red-300">
      <span className="h-2 w-2 rounded-full bg-red-500" />
      At Risk
    </span>
  );
}

export default function RetentionPage() {
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
        setError(err instanceof Error ? err.message : 'Failed to load retention data');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Retention"
          description="Churn analysis, LTV trends, and retention signals"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Retention' }]}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading retention data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Retention"
          description="Churn analysis, LTV trends, and retention signals"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Retention' }]}
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
        title="Retention"
        description="Churn analysis, LTV trends, and retention signals"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Retention' }]}
      />

      {/* Summary Cards */}
      {summary ? (
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Retention Overview</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Churn Rate</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.churnRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Monthly churn</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">LTV</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.ltv)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lifetime value</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">CAC</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.cac)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Acquisition cost</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">LTV : CAC Ratio</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.ltvToCacRatio.toFixed(2)}x
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Efficiency ratio</p>
            </article>
          </div>
        </section>
      ) : null}

      {/* Retention Health */}
      {summary ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-4">Retention Health</h2>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <RetentionHealthBadge churnRate={summary.kpis.churnRate} />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {summary.kpis.churnRate < 5
                ? 'Churn is below 5%. Your retention is strong — focus on maintaining current engagement strategies.'
                : summary.kpis.churnRate <= 10
                  ? 'Churn is between 5–10%. Monitor closely and investigate leading indicators before it worsens.'
                  : 'Churn exceeds 10%. Immediate intervention is recommended — review win-back campaigns and root causes.'}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className={`rounded-lg border p-3 ${summary.kpis.churnRate < 5 ? 'border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Healthy</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Churn &lt; 5%</p>
            </div>
            <div className={`rounded-lg border p-3 ${summary.kpis.churnRate >= 5 && summary.kpis.churnRate <= 10 ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Monitor</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Churn 5–10%</p>
            </div>
            <div className={`rounded-lg border p-3 ${summary.kpis.churnRate > 10 ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">At Risk</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">Churn &gt; 10%</p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Evidence Cards */}
      {summary && summary.evidenceCards.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Retention Intelligence</h2>
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
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-4">Verified Retention Metrics</h2>
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
          <p className="text-sm text-slate-600 dark:text-slate-300">No retention data available yet. Connect integrations to start tracking customer retention signals.</p>
        </div>
      ) : null}
    </div>
  );
}

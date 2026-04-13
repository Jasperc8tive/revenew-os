'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ExecutiveSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatNGN } from '@/utils/currency';

export default function AcquisitionPage() {
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
        setError(err instanceof Error ? err.message : 'Failed to load acquisition data');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  const bestChannel = useMemo(() => {
    if (!summary) return null;
    const channels = summary.marketingPerformance.byChannel.filter((c) => c.cac > 0);
    if (channels.length === 0) return null;
    return channels.reduce((best, c) => (c.cac < best.cac ? c : best));
  }, [summary]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Acquisition"
          description="Marketing channel performance and customer acquisition costs"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Acquisition' }]}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300">Loading acquisition data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Acquisition"
          description="Marketing channel performance and customer acquisition costs"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Acquisition' }]}
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
        title="Acquisition"
        description="Marketing channel performance and customer acquisition costs"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Acquisition' }]}
      />

      {/* Summary Cards */}
      {summary ? (
        <section className="space-y-4">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Acquisition Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total CAC</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatNGN(summary.kpis.cac)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Blended across all channels</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Customers</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.activeCustomers.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Currently active</p>
            </article>
            <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Revenue Growth Rate</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {summary.kpis.revenueGrowthRate >= 0 ? '+' : ''}
                {summary.kpis.revenueGrowthRate.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Period over period</p>
            </article>
          </div>
        </section>
      ) : null}

      {/* Best Channel Callout */}
      {bestChannel ? (
        <section className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
            Best Performing Channel
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200">
            <span className="font-semibold">{bestChannel.key}</span> has the lowest CAC at{' '}
            <span className="font-semibold">{formatNGN(bestChannel.cac)}</span> per customer, with{' '}
            {bestChannel.newCustomers.toLocaleString()} new customers acquired.
          </p>
        </section>
      ) : null}

      {/* Channel Performance Table */}
      {summary ? (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
          <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-4">Channel Performance</h2>
          {summary.marketingPerformance.byChannel.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No channel data available. Connect marketing integrations to track channel performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Channel</th>
                    <th className="pb-3 text-right text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">Spend</th>
                    <th className="pb-3 text-right text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">New Customers</th>
                    <th className="pb-3 text-right text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-medium">CAC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summary.marketingPerformance.byChannel.map((channel) => (
                    <tr key={channel.key} className={bestChannel?.key === channel.key ? 'bg-emerald-50 dark:bg-emerald-950/40' : ''}>
                      <td className="py-3 text-slate-900 dark:text-white font-medium">
                        {channel.key}
                        {bestChannel?.key === channel.key ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                            Best
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 text-right text-slate-700 dark:text-slate-300">{formatNGN(channel.spend)}</td>
                      <td className="py-3 text-right text-slate-700 dark:text-slate-300">
                        {channel.newCustomers.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-slate-900 dark:text-white font-medium">{formatNGN(channel.cac)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* Alerts */}
      {summary && summary.alerts.length > 0 ? (
        <section className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-3">Acquisition Alerts</h2>
          <ul className="space-y-2">
            {summary.alerts.map((alert, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                {alert}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Empty state */}
      {!summary ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <p className="text-sm text-slate-600 dark:text-slate-300">No acquisition data available yet. Connect marketing integrations to start tracking channel performance.</p>
        </div>
      ) : null}
    </div>
  );
}

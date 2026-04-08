'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { api, ExecutiveSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

function formatNaira(value: number) {
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export default function CommandCenterPage() {
  const { organizationId, isLoading: authLoading, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [qualitySummary, setQualitySummary] = useState<Awaited<ReturnType<typeof api.dataQuality.getSummary>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const summaryResult = await api.analytics.getExecutiveSummary(organizationId);
      setSummary(summaryResult);

      try {
        const dataQualityResult = await api.dataQuality.getSummary(organizationId);
        setQualitySummary(dataQualityResult);
      } catch {
        setQualitySummary(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load executive summary');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading) {
      void loadSummary();
    }
  }, [authLoading, loadSummary]);

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading command center...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Sign in to access the Growth Command Center.
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 space-y-3">
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          {error ?? 'Unable to load command center data.'}
        </div>
        <button
          onClick={() => void loadSummary()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Executive Command Center</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            One-screen growth signal stack for leadership.
          </p>
        </div>
        <button
          onClick={() => void loadSummary()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {summary.alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="mb-2 inline-flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Attention Needed
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {summary.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Revenue" value={formatNaira(summary.kpis.revenue)} icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard title="CAC" value={formatNaira(summary.kpis.cac)} icon={<Target className="h-5 w-5" />} />
        <MetricCard title="LTV" value={formatNaira(summary.kpis.ltv)} icon={<TrendingUp className="h-5 w-5" />} />
        <MetricCard title="Churn" value={formatPercent(summary.kpis.churnRate)} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recommendations</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{summary.topRecommendation}</p>
          </div>

          {summary.suppression ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
              <p className="font-semibold">Recommendation Suppressed</p>
              <p className="mt-1">{summary.suppression.message}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {summary.evidenceCards.map((card) => (
              <div key={card.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <InsightCard
                  title={card.title}
                  description={card.description}
                  impact={card.impact}
                  confidenceScore={card.confidenceScore}
                />
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {card.evidence.map((entry) => (
                    <li key={`${card.id}-${entry.label}`}>{entry.label}: {entry.value}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reliability Signals</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <p>Confidence: {(summary.confidence.score * 100).toFixed(1)}%</p>
            <p>Volume: {(summary.confidence.components.volume * 100).toFixed(0)}%</p>
            <p>Consistency: {(summary.confidence.components.consistency * 100).toFixed(0)}%</p>
            <p>Variance: {(summary.confidence.components.variance * 100).toFixed(0)}%</p>
            <p>Anomaly: {(summary.confidence.components.anomaly * 100).toFixed(0)}%</p>
            <p>Freshness: {(summary.confidence.components.freshness * 100).toFixed(0)}%</p>
            <p>Data points: {summary.confidence.diagnostics.dataPoints}</p>
            <p>Anomalies (7d): {summary.confidence.diagnostics.anomalyEventsLast7Days}</p>
            <hr className="my-2 border-slate-200 dark:border-slate-700" />
            <p>Data quality events: {qualitySummary?.totals.totalEvents ?? 0}</p>
            <p>Validation logs: {qualitySummary?.totals.validationEvents ?? 0}</p>
            <p>Anomaly logs: {qualitySummary?.totals.anomalyEvents ?? 0}</p>
            <p>LTV:CAC: {summary.kpis.ltvToCacRatio.toFixed(2)}x</p>
            <p>Growth: {formatPercent(summary.kpis.revenueGrowthRate)}</p>
            <p>Active Customers: {summary.kpis.activeCustomers}</p>
            <p>Pipeline Value: {formatNaira(summary.kpis.pipelineValue)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verified Metric Provenance</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Deterministic snapshots used for recommendation orchestration in this window.
        </p>

        {summary.verifiedMetrics.length === 0 ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            No verified metric snapshots available for this time range.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <th className="px-2 py-2 font-semibold">Metric</th>
                  <th className="px-2 py-2 font-semibold">Value</th>
                  <th className="px-2 py-2 font-semibold">Formula</th>
                  <th className="px-2 py-2 font-semibold">Sample Size</th>
                  <th className="px-2 py-2 font-semibold">Source Tables</th>
                  <th className="px-2 py-2 font-semibold">Quality Flags</th>
                  <th className="px-2 py-2 font-semibold">Verified At</th>
                </tr>
              </thead>
              <tbody>
                {summary.verifiedMetrics.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-slate-100 align-top dark:border-slate-800">
                    <td className="px-2 py-2 font-medium uppercase tracking-wide text-slate-800 dark:text-slate-100">
                      {snapshot.metricKey}
                    </td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{snapshot.metricValue.toFixed(4)}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{snapshot.formulaVersion}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{snapshot.sampleSize}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">{snapshot.sourceTables.join(', ')}</td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">
                      {snapshot.dataQualityFlags.length > 0 ? snapshot.dataQualityFlags.join(', ') : 'none'}
                    </td>
                    <td className="px-2 py-2 text-slate-700 dark:text-slate-200">
                      {new Date(snapshot.verifiedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';
import { api, ExecutiveSummary } from '@/lib/api';
import { formatNGN } from '@/utils/currency';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Deal = {
  id: string;
  title: string;
  stage: string;
  value: number;
  probability: number;
  customerEmail: string;
  createdAt: string;
};

const DEAL_STAGES = [
  'PROSPECT',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

const STAGE_COLORS: Record<string, string> = {
  PROSPECT: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  QUALIFIED: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  PROPOSAL: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  NEGOTIATION: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  CLOSED_WON: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  CLOSED_LOST: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

async function fetchDeals(organizationId: string, token?: string): Promise<Deal[]> {
  try {
    const res = await fetch(
      `${API_BASE}/pipeline/deals?organizationId=${encodeURIComponent(organizationId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );
    if (!res.ok) return [];
    return res.json() as Promise<Deal[]>;
  } catch {
    return [];
  }
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function PipelinePage() {
  const { organizationId } = useAuth();
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const token = auth.getSession()?.accessToken;

    setLoading(true);
    setError(null);

    Promise.all([
      api.analytics.getExecutiveSummary(organizationId).catch(() => null),
      fetchDeals(organizationId, token),
    ])
      .then(([summaryResult, dealsResult]) => {
        setSummary(summaryResult);
        setDeals(dealsResult);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline data');
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const stageGroups = DEAL_STAGES.map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const total = stageDeals.reduce((sum, d) => sum + d.value, 0);
    return { stage, count: stageDeals.length, total };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Sales pipeline, deal stages, and revenue forecasting"
      />

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm animate-pulse h-24"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              label="Pipeline Value"
              value={summary ? formatNGN(summary.kpis.pipelineValue) : '—'}
            />
            <SummaryCard
              label="Active Customers"
              value={summary ? summary.kpis.activeCustomers.toLocaleString() : '—'}
            />
            <SummaryCard
              label="Revenue"
              value={summary ? formatNGN(summary.kpis.revenue) : '—'}
              sub={
                summary
                  ? `${summary.kpis.revenueGrowthRate >= 0 ? '+' : ''}${summary.kpis.revenueGrowthRate.toFixed(1)}% growth`
                  : undefined
              }
            />
          </div>

          {/* Deal stages board */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
              Deal Stages
            </h2>
            <div className="space-y-2">
              {stageGroups.map(({ stage, count, total }) => (
                <div
                  key={stage}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[stage] ?? ''}`}
                    >
                      {stage.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {count} deal{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatNGN(total)}
                  </span>
                </div>
              ))}
              {deals.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 py-2">No deals found</p>
              )}
            </div>
          </section>

          {/* Deals table */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">All Deals</h2>
            </div>
            {deals.length === 0 ? (
              <div className="p-5 text-sm text-slate-500 dark:text-slate-400">No deals found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Title
                      </th>
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Customer
                      </th>
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Stage
                      </th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Value
                      </th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Probability
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map((deal) => (
                      <tr
                        key={deal.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                          {deal.title}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {deal.customerEmail}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[deal.stage] ?? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                          >
                            {deal.stage.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-slate-900 dark:text-white">
                          {formatNGN(deal.value)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                          {deal.probability}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

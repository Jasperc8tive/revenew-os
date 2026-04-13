'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type AgentRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PENDING';

type AgentRun = {
  id: string;
  agentType: string;
  status: AgentRunStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  outputSummary: string | null;
};

const STATUS_BADGE: Record<AgentRunStatus, string> = {
  RUNNING: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  COMPLETED: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  FAILED: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  PENDING: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

async function apiFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function SummaryCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color ?? 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}

export default function AgentsPage() {
  const { organizationId } = useAuth();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const token = auth.getSession()?.accessToken;

    setLoading(true);
    setError(null);

    apiFetch<AgentRun[]>(
      `/agents/runs?organizationId=${encodeURIComponent(organizationId)}`,
      token,
    )
      .then(setRuns)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load agent runs');
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const total = runs.length;
  const completed = runs.filter((r) => r.status === 'COMPLETED').length;
  const failed = runs.filter((r) => r.status === 'FAILED').length;
  const running = runs.filter((r) => r.status === 'RUNNING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Agents"
        description="Monitor automated revenue intelligence agent runs"
      />

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard label="Total Runs" value={total} />
            <SummaryCard
              label="Completed"
              value={completed}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryCard
              label="Failed"
              value={failed}
              color="text-red-600 dark:text-red-400"
            />
            <SummaryCard
              label="Running"
              value={running}
              color="text-blue-600 dark:text-blue-400"
            />
          </div>

          {/* Runs table */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Agent Runs</h2>
            </div>
            {runs.length === 0 ? (
              <div className="p-5 text-sm text-slate-500 dark:text-slate-400">No agent runs found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Agent Type
                      </th>
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Status
                      </th>
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Triggered By
                      </th>
                      <th className="text-left px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Started At
                      </th>
                      <th className="text-right px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                          {run.agentType}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[run.status] ?? ''}`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {run.triggeredBy}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                          {formatDate(run.startedAt)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-300">
                          {formatDuration(run.durationMs)}
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

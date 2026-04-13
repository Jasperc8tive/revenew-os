'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type IntegrationStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING';

type Integration = {
  id: string;
  provider: string;
  status: IntegrationStatus;
  lastSyncAt: string | null;
  syncCount: number;
  errorCount: number;
  createdAt: string;
};

const STATUS_BADGE: Record<IntegrationStatus, string> = {
  ACTIVE: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  ERROR: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  PENDING: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  INACTIVE: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
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

export default function IntegrationsPage() {
  const { organizationId } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const token = auth.getSession()?.accessToken;

    setLoading(true);
    setError(null);

    apiFetch<Integration[]>(
      `/integrations?organizationId=${encodeURIComponent(organizationId)}`,
      token,
    )
      .then(setIntegrations)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load integrations');
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const totalConnected = integrations.length;
  const activeCount = integrations.filter((i) => i.status === 'ACTIVE').length;
  const errorCount = integrations.filter((i) => i.status === 'ERROR').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connected data sources and sync status"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Connect Integration
          </button>
        }
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
            <SummaryCard label="Total Connected" value={totalConnected} />
            <SummaryCard
              label="Active"
              value={activeCount}
              color="text-emerald-600 dark:text-emerald-400"
            />
            <SummaryCard
              label="Error Count"
              value={errorCount}
              color={errorCount > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            />
          </div>

          {/* Integration cards grid */}
          {integrations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
              No integrations found. Connect a data source to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {capitalize(integration.provider)}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[integration.status] ?? ''}`}
                    >
                      {integration.status}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Last sync</dt>
                      <dd className="text-slate-700 dark:text-slate-300">
                        {formatDate(integration.lastSyncAt)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Syncs</dt>
                      <dd className="text-slate-700 dark:text-slate-300">
                        {integration.syncCount.toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500 dark:text-slate-400">Errors</dt>
                      <dd
                        className={
                          integration.errorCount > 0
                            ? 'text-red-600 dark:text-red-400 font-medium'
                            : 'text-slate-700 dark:text-slate-300'
                        }
                      >
                        {integration.errorCount.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

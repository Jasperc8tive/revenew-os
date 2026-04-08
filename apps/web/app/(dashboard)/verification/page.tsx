'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, DataQualityEvent } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const EVENT_TYPE_OPTIONS = ['ALL', 'VALIDATION', 'ANOMALY'] as const;
const SEVERITY_OPTIONS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export default function VerificationPage() {
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<DataQualityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventType, setEventType] = useState<(typeof EVENT_TYPE_OPTIONS)[number]>('ALL');
  const [severity, setSeverity] = useState<(typeof SEVERITY_OPTIONS)[number]>('ALL');
  const [limit, setLimit] = useState(50);

  const queryOptions = useMemo(() => {
    return {
      eventType: eventType === 'ALL' ? undefined : eventType,
      severity: severity === 'ALL' ? undefined : severity,
      limit,
    };
  }, [eventType, severity, limit]);

  const loadEvents = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.dataQuality.listEvents(organizationId, queryOptions);
      setEvents(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load verification logs.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, queryOptions]);

  useEffect(() => {
    if (!authLoading) {
      void loadEvents();
    }
  }, [authLoading, loadEvents]);

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading verification logs...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Sign in to access verification logs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification Dashboard"
        description="Audit trail for data validation and anomaly events."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Verification' },
        ]}
        action={
          <button
            onClick={() => void loadEvents()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Event Type</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as typeof eventType)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Severity</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as typeof severity)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Limit</span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(event) => setLimit(Math.max(1, Math.min(200, Number(event.target.value) || 50)))}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={() => void loadEvents()}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Occurred</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Severity</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Message</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Integration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No verification events found for current filters.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDate(event.occurredAt)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{event.eventType}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{event.severity}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{event.source}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">{event.code}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{event.message}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{event.integration?.provider ?? 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, ExecutiveSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';

type Recommendation = {
  id: string;
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  status: 'PENDING' | 'APPLIED' | 'DISMISSED';
  createdAt: string;
};

type FilterTab = 'ALL' | 'PENDING' | 'APPLIED' | 'DISMISSED';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const IMPACT_CONFIG: Record<Recommendation['impact'], { label: string; classes: string }> = {
  HIGH: { label: 'High', classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  MEDIUM: { label: 'Medium', classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  LOW: { label: 'Low', classes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
};

const STATUS_CONFIG: Record<Recommendation['status'], { label: string; classes: string }> = {
  PENDING: { label: 'Pending', classes: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  APPLIED: { label: 'Applied', classes: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  DISMISSED: { label: 'Dismissed', classes: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' },
};

function buildFallbackRecommendations(summary: ExecutiveSummary): Recommendation[] {
  const recs: Recommendation[] = [];

  if (summary.topRecommendation) {
    recs.push({
      id: 'top-rec',
      title: 'Top Revenue Recommendation',
      description: summary.topRecommendation,
      impact: 'HIGH',
      category: 'Strategy',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
  }

  summary.evidenceCards.forEach((card) => {
    recs.push({
      id: card.id,
      title: card.title,
      description: card.description,
      impact: (card.impact.toUpperCase() as Recommendation['impact']) ?? 'MEDIUM',
      category: 'Analytics',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });
  });

  return recs;
}

export default function RecommendationsPage() {
  const { organizationId, isLoading: authLoading, isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [usingFallback, setUsingFallback] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Fetch executive summary in parallel with recommendations
    const summaryPromise = api.analytics.getExecutiveSummary(organizationId).catch(() => null);

    const token = auth.getSession()?.accessToken;
    let fetchedRecs: Recommendation[] | null = null;
    let fetchError: string | null = null;

    try {
      const res = await fetch(
        `${API_BASE}/recommendations?organizationId=${encodeURIComponent(organizationId)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (res.ok) {
        fetchedRecs = (await res.json()) as Recommendation[];
      } else if (res.status === 404) {
        fetchError = 'No recommendations endpoint found; showing AI-generated insights.';
      } else {
        fetchError = `Failed to load recommendations (${res.status})`;
      }
    } catch {
      fetchError = 'Could not reach recommendations endpoint; showing AI-generated insights.';
    }

    const execSummary = await summaryPromise;
    setSummary(execSummary);

    if (fetchedRecs && fetchedRecs.length > 0) {
      setRecommendations(fetchedRecs);
      setUsingFallback(false);
    } else if (execSummary) {
      const fallback = buildFallbackRecommendations(execSummary);
      setRecommendations(fallback);
      setUsingFallback(true);
      if (fetchError) setError(fetchError);
    } else {
      setRecommendations([]);
      if (fetchError) setError(fetchError);
    }

    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading) {
      void loadData();
    }
  }, [authLoading, loadData]);

  const filtered = recommendations.filter((r) => {
    if (activeTab === 'ALL') return true;
    return r.status === activeTab;
  });

  const counts = {
    total: recommendations.length,
    pending: recommendations.filter((r) => r.status === 'PENDING').length,
    applied: recommendations.filter((r) => r.status === 'APPLIED').length,
    dismissed: recommendations.filter((r) => r.status === 'DISMISSED').length,
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: counts.total },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'APPLIED', label: 'Applied', count: counts.applied },
    { key: 'DISMISSED', label: 'Dismissed', count: counts.dismissed },
  ];

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
        You need an authenticated session with an organization to view recommendations.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommendations"
        description="AI-powered revenue optimization recommendations"
      />

      {/* Fallback Notice */}
      {usingFallback && error && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{counts.total}</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-amber-600 dark:text-amber-400">{counts.pending}</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Applied</p>
          {loading ? (
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          ) : (
            <p className="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{counts.applied}</p>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : filtered.length === 0 && !usingFallback ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <p className="text-2xl mb-2">💡</p>
          <p className="text-slate-600 dark:text-slate-400">No recommendations in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Fallback top recommendation callout */}
          {usingFallback && summary?.topRecommendation && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">AI Top Recommendation</p>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">{summary.topRecommendation}</p>
                </div>
              </div>
            </div>
          )}

          {filtered.map((rec) => {
            const impact = IMPACT_CONFIG[rec.impact];
            const status = STATUS_CONFIG[rec.status];
            return (
              <article
                key={rec.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{rec.title}</h3>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{rec.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {rec.category}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${impact.classes}`}>
                      {impact.label} Impact
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.classes}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

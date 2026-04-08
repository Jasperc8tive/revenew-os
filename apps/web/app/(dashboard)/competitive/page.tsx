'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CheckCircle,
  GitCompare,
  Loader2,
  Plus,
  Radar,
  Signal,
  Trash2,
} from 'lucide-react';
import {
  api,
  Competitor,
  CompetitiveAlertEvalResponse,
  CompetitiveAlertEvalResult,
  CompetitorComparison,
  CompetitorSignal,
  CompetitorSignalType,
  CompetitiveOverview,
  CompetitiveTrend,
  Industry,
  WeeklyBrief,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ─── constants ────────────────────────────────────────────────────────────────

const signalTypeLabels: Record<CompetitorSignalType, string> = {
  TRAFFIC: 'Traffic',
  HIRING: 'Hiring',
  AD_SPEND: 'Ad Spend',
  PRODUCT_LAUNCH: 'Product Launch',
  OTHER: 'Other',
};

const signalTypeColors: Record<CompetitorSignalType, string> = {
  TRAFFIC: 'bg-blue-500',
  HIRING: 'bg-violet-500',
  AD_SPEND: 'bg-amber-500',
  PRODUCT_LAUNCH: 'bg-emerald-500',
  OTHER: 'bg-slate-400',
};

const signalTypeBadge: Record<CompetitorSignalType, string> = {
  TRAFFIC: 'bg-blue-50 text-blue-700',
  HIRING: 'bg-violet-50 text-violet-700',
  AD_SPEND: 'bg-amber-50 text-amber-700',
  PRODUCT_LAUNCH: 'bg-emerald-50 text-emerald-700',
  OTHER: 'bg-slate-100 text-slate-600',
};

const ALL_SIGNAL_TYPES: CompetitorSignalType[] = [
  'TRAFFIC',
  'HIRING',
  'AD_SPEND',
  'PRODUCT_LAUNCH',
  'OTHER',
];

const ALL_INDUSTRIES: Industry[] = ['FINTECH', 'SAAS', 'LOGISTICS', 'ECOMMERCE', 'OTHER'];

const BAR_WIDTH_CLASSES = [
  'w-[0%]',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-[100%]',
];

function widthClassFromRatio(ratio: number) {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  const index = Math.round(safeRatio * 20);
  return BAR_WIDTH_CLASSES[index] ?? 'w-[0%]';
}

type Tab = 'overview' | 'trends' | 'comparison' | 'brief' | 'alerts';

type AlertRuleDraft = {
  id: string;
  competitorId: string;
  signalType: CompetitorSignalType;
  windowDays: number;
  minCount: number;
};

// ─── subcomponents ────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: CompetitiveTrend }) {
  if (!trend.buckets.length) {
    return <p className="py-12 text-center text-sm text-slate-500">No signals recorded in this period.</p>;
  }
  const maxCount = Math.max(...trend.buckets.map((b) => b.total), 1);
  return (
    <div className="space-y-2">
      {trend.buckets.map((bucket) => (
        <div key={bucket.date} className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 font-mono text-slate-400">{bucket.date.slice(5)}</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
            <div
              className={`absolute inset-y-0 left-0 rounded bg-blue-500 transition-all duration-300 ${widthClassFromRatio(bucket.total / maxCount)}`}
            />
            <span className="absolute inset-y-0 right-2 flex items-center font-medium text-slate-700">
              {bucket.total}
            </span>
          </div>
          <div className="flex w-40 gap-1">
            {ALL_SIGNAL_TYPES.filter((t) => bucket.byType[t]).map((t) => (
              <span
                key={t}
                title={`${signalTypeLabels[t]}: ${String(bucket.byType[t])}`}
                className={`rounded px-1 py-0.5 text-[10px] font-medium ${signalTypeBadge[t]}`}
              >
                {signalTypeLabels[t].charAt(0)}:{bucket.byType[t]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonTable({ comparison }: { comparison: CompetitorComparison }) {
  if (!comparison.competitors.length) {
    return <p className="py-12 text-center text-sm text-slate-500">No competitors to compare yet.</p>;
  }
  const maxTotal = Math.max(...comparison.competitors.map((c) => c.total), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              Competitor
            </th>
            {ALL_SIGNAL_TYPES.map((t) => (
              <th
                key={t}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {signalTypeLabels[t]}
              </th>
            ))}
            <th className="py-2 pl-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {comparison.competitors.map((comp) => (
            <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 pr-4 font-medium text-slate-900">{comp.name}</td>
              {ALL_SIGNAL_TYPES.map((t) => {
                const count = comp.signalCounts[t] ?? 0;
                return (
                  <td key={t} className="px-3 py-3 text-center">
                    {count > 0 ? (
                      <span
                        className={`inline-block min-w-[1.5rem] rounded-full px-2 py-0.5 text-xs font-semibold ${signalTypeBadge[t]}`}
                      >
                        {count}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="py-3 pl-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full bg-blue-500 ${widthClassFromRatio(comp.total / maxTotal)}`}
                    />
                  </div>
                  <span className="font-medium text-slate-700">{comp.total}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertResultCard({ result }: { result: CompetitiveAlertEvalResult }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        result.triggered ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      {result.triggered ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      ) : (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      )}
      <div className="flex-1">
        <p className={`text-sm font-semibold ${result.triggered ? 'text-red-800' : 'text-emerald-800'}`}>
          {result.competitorName ? `${result.competitorName} — ` : 'All competitors — '}
          {signalTypeLabels[result.signalType]}
        </p>
        <p className={`mt-0.5 text-xs ${result.triggered ? 'text-red-700' : 'text-emerald-700'}`}>
          {result.actualCount} signal{result.actualCount !== 1 ? 's' : ''} in last {result.windowDays} days
          {result.triggered
            ? ` — threshold of ${result.threshold} reached`
            : ` — below threshold of ${result.threshold}`}
        </p>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CompetitivePage() {
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();

  // shared data
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [signals, setSignals] = useState<CompetitorSignal[]>([]);
  const [overview, setOverview] = useState<CompetitiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // tabs
  const [tab, setTab] = useState<Tab>('overview');

  // modals
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [showSignalModal, setShowSignalModal] = useState(false);

  // forms
  const [competitorForm, setCompetitorForm] = useState({
    name: '',
    website: '',
    industry: 'OTHER' as Industry,
    notes: '',
  });
  const [signalForm, setSignalForm] = useState({
    competitorId: '',
    signalType: 'TRAFFIC' as CompetitorSignalType,
    value: '',
    unit: '',
    source: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [savingCompetitor, setSavingCompetitor] = useState(false);
  const [savingSignal, setSavingSignal] = useState(false);

  // trends
  const [trend, setTrend] = useState<CompetitiveTrend | null>(null);
  const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
  const [trendCompetitor, setTrendCompetitor] = useState('');
  const [trendSignalType, setTrendSignalType] = useState<CompetitorSignalType | ''>('');
  const [trendLoading, setTrendLoading] = useState(false);

  // comparison
  const [comparison, setComparison] = useState<CompetitorComparison | null>(null);
  const [comparisonDays, setComparisonDays] = useState<30 | 60 | 90>(30);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // AI brief
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // alert rules
  const [alertRules, setAlertRules] = useState<AlertRuleDraft[]>([
    { id: '1', competitorId: '', signalType: 'HIRING', windowDays: 7, minCount: 3 },
    { id: '2', competitorId: '', signalType: 'AD_SPEND', windowDays: 7, minCount: 2 },
  ]);
  const [alertResults, setAlertResults] = useState<CompetitiveAlertEvalResponse | null>(null);
  const [evaluatingAlerts, setEvaluatingAlerts] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [newRuleDraft, setNewRuleDraft] = useState<Omit<AlertRuleDraft, 'id'>>({
    competitorId: '',
    signalType: 'HIRING',
    windowDays: 7,
    minCount: 3,
  });

  // ── load core data ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const [competitorData, signalData, overviewData] = await Promise.all([
        api.competitive.listCompetitors(organizationId),
        api.competitive.listSignals({ organizationId, limit: 25 }),
        api.competitive.getOverview(organizationId),
      ]);
      setCompetitors(competitorData);
      setSignals(signalData);
      setOverview(overviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitive intelligence');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading && organizationId) {
      void loadData();
    }
  }, [authLoading, organizationId, loadData]);

  // ── load trend ────────────────────────────────────────────────────────────

  const loadTrend = useCallback(async () => {
    if (!organizationId) return;
    setTrendLoading(true);
    try {
      const data = await api.competitive.getSignalTrend({
        organizationId,
        days: trendDays,
        competitorId: trendCompetitor || undefined,
        signalType: (trendSignalType as CompetitorSignalType) || undefined,
      });
      setTrend(data);
    } catch {
      // non-critical
    } finally {
      setTrendLoading(false);
    }
  }, [organizationId, trendDays, trendCompetitor, trendSignalType]);

  useEffect(() => {
    if (tab === 'trends' && organizationId) {
      void loadTrend();
    }
  }, [tab, loadTrend, organizationId]);

  // ── load comparison ───────────────────────────────────────────────────────

  const loadComparison = useCallback(async () => {
    if (!organizationId) return;
    setComparisonLoading(true);
    try {
      const data = await api.competitive.getCompetitorComparison(organizationId, comparisonDays);
      setComparison(data);
    } catch {
      // non-critical
    } finally {
      setComparisonLoading(false);
    }
  }, [organizationId, comparisonDays]);

  useEffect(() => {
    if (tab === 'comparison' && organizationId) {
      void loadComparison();
    }
  }, [tab, loadComparison, organizationId]);

  // ── form actions ──────────────────────────────────────────────────────────

  const latestByCompetitor = useMemo(() => {
    const map = new Map<string, CompetitorSignal>();
    for (const signal of signals) {
      if (!map.has(signal.competitorId)) map.set(signal.competitorId, signal);
    }
    return map;
  }, [signals]);

  async function createCompetitor() {
    if (!organizationId) return;
    setSavingCompetitor(true);
    setError(null);
    try {
      await api.competitive.createCompetitor({
        organizationId,
        name: competitorForm.name,
        website: competitorForm.website || undefined,
        industry: competitorForm.industry,
        notes: competitorForm.notes || undefined,
      });
      setShowCompetitorModal(false);
      setCompetitorForm({ name: '', website: '', industry: 'OTHER', notes: '' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create competitor');
    } finally {
      setSavingCompetitor(false);
    }
  }

  async function createSignal() {
    if (!organizationId) return;
    setSavingSignal(true);
    setError(null);
    try {
      await api.competitive.createSignal({
        organizationId,
        competitorId: signalForm.competitorId,
        signalType: signalForm.signalType,
        value: signalForm.value,
        unit: signalForm.unit || undefined,
        source: signalForm.source || undefined,
        date: signalForm.date,
        notes: signalForm.notes || undefined,
      });
      setShowSignalModal(false);
      setSignalForm({
        competitorId: '',
        signalType: 'TRAFFIC',
        value: '',
        unit: '',
        source: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signal');
    } finally {
      setSavingSignal(false);
    }
  }

  async function handleGenerateBrief() {
    if (!organizationId) return;
    setBriefLoading(true);
    setBriefError(null);
    try {
      const data = await api.competitive.generateWeeklyBrief(organizationId);
      setBrief(data);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleEvaluateAlerts() {
    if (!organizationId) return;
    setEvaluatingAlerts(true);
    setAlertError(null);
    try {
      const rules = alertRules.map(({ competitorId, signalType, windowDays, minCount }) => ({
        competitorId: competitorId || undefined,
        signalType,
        windowDays,
        minCount,
      }));
      const data = await api.competitive.evaluateAlerts(organizationId, rules);
      setAlertResults(data);
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Failed to evaluate alerts');
    } finally {
      setEvaluatingAlerts(false);
    }
  }

  function addAlertRule() {
    setAlertRules((prev) => [...prev, { ...newRuleDraft, id: String(Date.now()) }]);
    setNewRuleDraft({ competitorId: '', signalType: 'HIRING', windowDays: 7, minCount: 3 });
    setAlertResults(null);
  }

  function removeAlertRule(id: string) {
    setAlertRules((prev) => prev.filter((r) => r.id !== id));
    setAlertResults(null);
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Sign in to access competitive intelligence.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Radar className="h-4 w-4" /> },
    { id: 'trends', label: 'Signal Trends', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'comparison', label: 'Comparison', icon: <GitCompare className="h-4 w-4" /> },
    { id: 'brief', label: 'AI Brief', icon: <Bot className="h-4 w-4" /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Radar className="h-6 w-6 text-blue-600" />
            Competitive Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track competitor signals, trends, and alerts — with AI-generated weekly briefs.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompetitorModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Building2 className="h-4 w-4" />
            Add Competitor
          </button>
          <button
            onClick={() => setShowSignalModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Signal
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Competitors Tracked</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {overview?.competitorCount ?? competitors.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Signals Logged</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{overview?.signalCount ?? signals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Top Signal Type</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {overview?.signalTypeBreakdown?.[0]
              ? `${signalTypeLabels[overview.signalTypeBreakdown[0].signalType]} (${overview.signalTypeBreakdown[0].count})`
              : 'No data'}
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Competitors</h2>
            <div className="space-y-3">
              {competitors.length === 0 && (
                <p className="text-sm text-slate-500">No competitors added yet.</p>
              )}
              {competitors.map((competitor) => {
                const latestSignal = latestByCompetitor.get(competitor.id);
                return (
                  <div key={competitor.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{competitor.name}</p>
                      {competitor.industry && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {competitor.industry}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{competitor.website || 'No website added'}</p>
                    {latestSignal && (
                      <p className="mt-2 text-xs text-slate-600">
                        Latest signal:{' '}
                        <span className="font-medium">{signalTypeLabels[latestSignal.signalType]}</span> on{' '}
                        {new Date(latestSignal.date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Signal className="h-5 w-5 text-blue-600" />
              Recent Signals
            </h2>
            <div className="space-y-3">
              {signals.length === 0 && <p className="text-sm text-slate-500">No signals captured yet.</p>}
              {signals.map((signal) => (
                <div key={signal.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {signal.competitor?.name ?? 'Unknown competitor'}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${signalTypeBadge[signal.signalType]}`}
                    >
                      {signalTypeLabels[signal.signalType]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {signal.value}
                    {signal.unit ? ` ${signal.unit}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(signal.date).toLocaleDateString()}
                    {signal.source ? ` • ${signal.source}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Signal Trends ─────────────────────────────────────────────────────── */}
      {tab === 'trends' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Signal Trends
            </h2>
            <div className="ml-auto flex flex-wrap gap-2">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    trendDays === d
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d}d
                </button>
              ))}
              <select
                title="Filter by competitor"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                value={trendCompetitor}
                onChange={(e) => setTrendCompetitor(e.target.value)}
              >
                <option value="">All competitors</option>
                {competitors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                title="Filter by signal type"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
                value={trendSignalType}
                onChange={(e) => setTrendSignalType(e.target.value as CompetitorSignalType | '')}
              >
                <option value="">All types</option>
                {ALL_SIGNAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {signalTypeLabels[t]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void loadTrend()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-3">
            {ALL_SIGNAL_TYPES.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${signalTypeColors[t]}`} />
                {signalTypeLabels[t]}
              </span>
            ))}
          </div>
          {trendLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-xs">Loading trend data...</p>
              </div>
            </div>
          ) : trend ? (
            <TrendChart trend={trend} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Select filters and click Refresh.</p>
          )}
        </div>
      )}

      {/* ── Comparison ──────────────────────────────────────────────────────── */}
      {tab === 'comparison' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <GitCompare className="h-5 w-5 text-blue-600" />
              Competitor Comparison
            </h2>
            <div className="ml-auto flex gap-2">
              {([30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setComparisonDays(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    comparisonDays === d
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          {comparisonLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-xs">Loading comparison data...</p>
              </div>
            </div>
          ) : comparison ? (
            <ComparisonTable comparison={comparison} />
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Loading comparison data…</p>
          )}
        </div>
      )}

      {/* ── AI Weekly Brief ─────────────────────────────────────────────────── */}
      {tab === 'brief' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Bot className="h-5 w-5 text-blue-600" />
              AI Weekly Competitor Brief
            </h2>
            <button
              onClick={() => void handleGenerateBrief()}
              disabled={briefLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {briefLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
              {briefLoading ? 'Generating…' : 'Generate Brief'}
            </button>
          </div>
          <p className="mb-5 text-sm text-slate-500">
            Summarises all competitor signals logged in the last 7 days into a structured intelligence brief using AI.
          </p>
          {briefError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {briefError}
            </div>
          )}
          {brief ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  {brief.signalCount} signal{brief.signalCount !== 1 ? 's' : ''} analysed
                </span>
                <span className="text-xs text-slate-400">
                  Generated {new Date(brief.generatedAt).toLocaleString()}
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                {brief.brief}
              </pre>
            </div>
          ) : (
            !briefLoading && (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 text-center">
                <Bot className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No brief generated yet</p>
                <p className="mt-1 text-xs text-slate-400">Click &quot;Generate Brief&quot; to analyse this week&apos;s signals</p>
              </div>
            )
          )}
        </div>
      )}

      {/* ── Alert Rules ─────────────────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Bell className="h-5 w-5 text-blue-600" />
              Competitive Alert Rules
            </h2>
            <p className="mb-5 text-sm text-slate-500">
              Define thresholds per signal type. Click &quot;Evaluate&quot; to check current signal counts against your rules.
            </p>
            {alertError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {alertError}
              </div>
            )}
            {/* rules table */}
            <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Competitor
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Signal Type
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Window
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Min Count
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {alertRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-700">
                        {competitors.find((c) => c.id === rule.competitorId)?.name ?? 'All competitors'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${signalTypeBadge[rule.signalType]}`}
                        >
                          {signalTypeLabels[rule.signalType]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-700">{rule.windowDays}d</td>
                      <td className="px-4 py-3 text-center text-slate-700">{rule.minCount}+</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeAlertRule(rule.id)}
                          className="text-slate-400 hover:text-red-500"
                          title="Remove rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {alertRules.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        No rules defined. Add one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* add rule form */}
            <div className="rounded-lg border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Add Rule</p>
              <div className="flex flex-wrap gap-2">
                <select
                  title="Competitor for alert rule"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                  value={newRuleDraft.competitorId}
                  onChange={(e) => setNewRuleDraft((p) => ({ ...p, competitorId: e.target.value }))}
                >
                  <option value="">All competitors</option>
                  {competitors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  title="Signal type for alert rule"
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                  value={newRuleDraft.signalType}
                  onChange={(e) =>
                    setNewRuleDraft((p) => ({ ...p, signalType: e.target.value as CompetitorSignalType }))
                  }
                >
                  {ALL_SIGNAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {signalTypeLabels[t]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <label className="text-xs text-slate-500">in last</label>
                  <input
                    title="Alert window in days"
                    type="number"
                    min={1}
                    max={90}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                    value={newRuleDraft.windowDays}
                    onChange={(e) =>
                      setNewRuleDraft((p) => ({
                        ...p,
                        windowDays: Math.max(1, parseInt(e.target.value, 10) || 7),
                      }))
                    }
                  />
                  <label className="text-xs text-slate-500">days ≥</label>
                  <input
                    title="Minimum signal count to trigger"
                    type="number"
                    min={1}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                    value={newRuleDraft.minCount}
                    onChange={(e) =>
                      setNewRuleDraft((p) => ({
                        ...p,
                        minCount: Math.max(1, parseInt(e.target.value, 10) || 3),
                      }))
                    }
                  />
                  <label className="text-xs text-slate-500">signals</label>
                </div>
                <button
                  onClick={addAlertRule}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => void handleEvaluateAlerts()}
                disabled={evaluatingAlerts || alertRules.length === 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {evaluatingAlerts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {evaluatingAlerts ? 'Evaluating…' : 'Evaluate Alerts'}
              </button>
            </div>
          </div>

          {alertResults && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Alert Results</h3>
                <span className="text-xs text-slate-400">
                  Evaluated {new Date(alertResults.evaluatedAt).toLocaleString()}
                </span>
              </div>
              <div className="space-y-3">
                {alertResults.rules.length === 0 ? (
                  <p className="text-sm text-slate-500">No rules evaluated.</p>
                ) : (
                  alertResults.rules.map((result, idx) => <AlertResultCard key={idx} result={result} />)
                )}
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                {alertResults.rules.filter((r) => r.triggered).length} of {alertResults.rules.length} rules
                triggered
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add Competitor Modal ──────────────────────────────────────────────── */}
      {showCompetitorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Competitor</h3>
            <div className="space-y-3">
              <input
                title="Competitor name"
                placeholder="Competitor name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={competitorForm.name}
                onChange={(e) => setCompetitorForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                title="Website"
                placeholder="Website (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={competitorForm.website}
                onChange={(e) => setCompetitorForm((prev) => ({ ...prev, website: e.target.value }))}
              />
              <select
                title="Industry"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={competitorForm.industry}
                onChange={(e) =>
                  setCompetitorForm((prev) => ({ ...prev, industry: e.target.value as Industry }))
                }
              >
                {ALL_INDUSTRIES.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </select>
              <textarea
                title="Notes"
                placeholder="Notes (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                value={competitorForm.notes}
                onChange={(e) => setCompetitorForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCompetitorModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void createCompetitor()}
                disabled={savingCompetitor || !competitorForm.name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingCompetitor ? 'Saving…' : 'Save Competitor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Signal Modal ──────────────────────────────────────────────────── */}
      {showSignalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Competitor Signal</h3>
            <div className="space-y-3">
              <select
                title="Competitor"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={signalForm.competitorId}
                onChange={(e) => setSignalForm((prev) => ({ ...prev, competitorId: e.target.value }))}
              >
                <option value="">Select competitor</option>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
              <select
                title="Signal type"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={signalForm.signalType}
                onChange={(e) =>
                  setSignalForm((prev) => ({ ...prev, signalType: e.target.value as CompetitorSignalType }))
                }
              >
                {ALL_SIGNAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {signalTypeLabels[type]}
                  </option>
                ))}
              </select>
              <input
                title="Value"
                placeholder="Value (e.g. +24%, 12,000, New pricing page)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={signalForm.value}
                onChange={(e) => setSignalForm((prev) => ({ ...prev, value: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  title="Unit"
                  placeholder="Unit (optional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={signalForm.unit}
                  onChange={(e) => setSignalForm((prev) => ({ ...prev, unit: e.target.value }))}
                />
                <input
                  title="Signal date"
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={signalForm.date}
                  onChange={(e) => setSignalForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <input
                title="Source"
                placeholder="Source URL or note"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={signalForm.source}
                onChange={(e) => setSignalForm((prev) => ({ ...prev, source: e.target.value }))}
              />
              <textarea
                title="Notes"
                placeholder="Notes (optional)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                value={signalForm.notes}
                onChange={(e) => setSignalForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowSignalModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => void createSignal()}
                disabled={savingSignal || !signalForm.competitorId || !signalForm.value.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingSignal ? 'Saving…' : 'Save Signal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


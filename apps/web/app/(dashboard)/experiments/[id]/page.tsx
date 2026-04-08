'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BarChart3, FlaskConical, Loader2, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api, ExperimentDetail, ExperimentStatus } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ── types ──────────────────────────────────────────────────────────────────

type VariantStat = {
  id: string;
  name: string;
  isControl: boolean;
  avgMetricValue: number;
  sampleSize: number;
  resultsCount: number;
  upliftPercent?: number;
};

type AddVariantForm = { name: string; description: string; isControl: boolean };
type RecordResultForm = {
  variantId: string;
  periodStart: string;
  periodEnd: string;
  metricValue: string;
  sampleSize: string;
};

const emptyVariantForm = (): AddVariantForm => ({ name: '', description: '', isControl: false });
const emptyResultForm = (variantId = ''): RecordResultForm => ({
  variantId,
  periodStart: '',
  periodEnd: '',
  metricValue: '',
  sampleSize: '',
});

// ── component ──────────────────────────────────────────────────────────────

export default function ExperimentDetailPage() {
  const params = useParams<{ id: string }>();
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();

  const [experiment, setExperiment] = useState<ExperimentDetail | null>(null);
  const [stats, setStats] = useState<VariantStat[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Variant modal
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState<AddVariantForm>(emptyVariantForm());
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Record Result modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultForm, setResultForm] = useState<RecordResultForm>(emptyResultForm());
  const [resultSubmitting, setResultSubmitting] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  const loadExperiment = useCallback(async () => {
    if (!organizationId || !params?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [data, statsData] = await Promise.all([
        api.experiments.getExperiment(params.id, organizationId),
        api.experiments.getExperimentStats(params.id, organizationId).catch(() => null),
      ]);
      setExperiment(data);
      if (statsData && 'variants' in (statsData as object)) {
        setStats((statsData as { variants: VariantStat[] }).variants);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment');
    } finally {
      setLoading(false);
    }
  }, [organizationId, params?.id]);

  useEffect(() => {
    if (!authLoading && organizationId && params?.id) {
      void loadExperiment();
    }
  }, [authLoading, organizationId, params?.id, loadExperiment]);

  // ── Add Variant submit ───────────────────────────────────────────────────
  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId || !params?.id) return;
    setVariantSubmitting(true);
    setVariantError(null);
    try {
      await api.experiments.addVariant(params.id, organizationId, {
        name: variantForm.name,
        description: variantForm.description || undefined,
        isControl: variantForm.isControl,
      });
      setShowVariantModal(false);
      setVariantForm(emptyVariantForm());
      await loadExperiment();
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : 'Failed to add variant');
    } finally {
      setVariantSubmitting(false);
    }
  }

  // ── Record Result submit ─────────────────────────────────────────────────
  async function handleRecordResult(e: React.FormEvent) {
    e.preventDefault();
    if (!organizationId || !params?.id) return;
    setResultSubmitting(true);
    setResultError(null);
    try {
      await api.experiments.recordResult(params.id, organizationId, {
        variantId: resultForm.variantId,
        periodStart: resultForm.periodStart,
        periodEnd: resultForm.periodEnd,
        metricValue: parseFloat(resultForm.metricValue),
        sampleSize: resultForm.sampleSize ? parseInt(resultForm.sampleSize) : undefined,
      });
      setShowResultModal(false);
      setResultForm(emptyResultForm());
      await loadExperiment();
    } catch (err) {
      setResultError(err instanceof Error ? err.message : 'Failed to record result');
    } finally {
      setResultSubmitting(false);
    }
  }

  function openResultModal(variantId: string) {
    setResultForm(emptyResultForm(variantId));
    setResultError(null);
    setShowResultModal(true);
  }

  // ── render guards ────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Sign in to view experiment details.
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

  if (error || !experiment) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error ?? 'Experiment not found'}
        </div>
      </div>
    );
  }

  const isDraft = experiment.status === ExperimentStatus.DRAFT;
  const isRunning = experiment.status === ExperimentStatus.RUNNING;
  const canAddVariant = isDraft;
  const canRecordResult = isRunning;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    RUNNING: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    PAUSED: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      {/* ── Header ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{experiment.title}</h1>
            <p className="mt-1 text-slate-600">{experiment.hypothesis}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[experiment.status] ?? 'bg-slate-100 text-slate-700'}`}>
            {experiment.status}
          </span>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
          <div>Metric: <span className="font-medium text-slate-900">{experiment.targetMetric}</span></div>
          <div>Variants: <span className="font-medium text-slate-900">{experiment.variants.length}</span></div>
          <div>
            Started:{' '}
            <span className="font-medium text-slate-900">
              {experiment.startDate ? new Date(experiment.startDate).toLocaleDateString() : 'Not started'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Variants ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FlaskConical className="h-5 w-5 text-blue-600" />
            Variants
          </h2>
          {canAddVariant && (
            <button
              onClick={() => { setShowVariantModal(true); setVariantError(null); setVariantForm(emptyVariantForm()); }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Add Variant
            </button>
          )}
        </div>

        {experiment.variants.length === 0 ? (
          <p className="text-sm text-slate-500">No variants yet. Add a control variant first, then add treatment variants.</p>
        ) : (
          <div className="space-y-3">
            {experiment.variants.map((variant) => {
              const varStat = stats?.find((s) => s.id === variant.id);
              return (
                <div key={variant.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{variant.name}</p>
                        {variant.isControl && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Control
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{variant.description ?? 'No description'}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Results: {variant.results.length}</span>
                        {varStat && (
                          <>
                            <span>Avg metric: <strong className="text-slate-700">{varStat.avgMetricValue.toLocaleString()}</strong></span>
                            <span>Sample: <strong className="text-slate-700">{varStat.sampleSize.toLocaleString()}</strong></span>
                            {typeof varStat.upliftPercent === 'number' && (
                              <span className={
                                varStat.upliftPercent > 0
                                  ? 'flex items-center gap-0.5 font-semibold text-emerald-700'
                                  : varStat.upliftPercent < 0
                                  ? 'flex items-center gap-0.5 font-semibold text-red-600'
                                  : 'flex items-center gap-0.5 text-slate-500'
                              }>
                                {varStat.upliftPercent > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : varStat.upliftPercent < 0 ? (
                                  <TrendingDown className="h-3 w-3" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                                {varStat.upliftPercent > 0 ? '+' : ''}{varStat.upliftPercent.toFixed(1)}% uplift
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {canRecordResult && (
                      <button
                        onClick={() => openResultModal(variant.id)}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Record Result
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Stats summary ── */}
      {stats && stats.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            Uplift Summary
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="pb-2 pr-4">Variant</th>
                <th className="pb-2 pr-4 text-right">Avg Metric</th>
                <th className="pb-2 pr-4 text-right">Sample</th>
                <th className="pb-2 text-right">Uplift vs Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-4 font-medium text-slate-900">
                    {s.name}
                    {s.isControl && (
                      <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">ctrl</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-700">{s.avgMetricValue.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-slate-600">{s.sampleSize.toLocaleString()}</td>
                  <td className="py-2 text-right">
                    {s.isControl ? (
                      <span className="text-slate-400">—</span>
                    ) : typeof s.upliftPercent === 'number' ? (
                      <span className={s.upliftPercent >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
                        {s.upliftPercent >= 0 ? '+' : ''}{s.upliftPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Variant Modal ── */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Add Variant</h3>
            <form onSubmit={(e) => { void handleAddVariant(e); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Control, Treatment A"
                  value={variantForm.name}
                  onChange={(e) => setVariantForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="Optional description of what this variant tests"
                  value={variantForm.description}
                  onChange={(e) => setVariantForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isControl"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  checked={variantForm.isControl}
                  onChange={(e) => setVariantForm((f) => ({ ...f, isControl: e.target.checked }))}
                />
                <label htmlFor="isControl" className="text-sm text-slate-700">This is the control variant</label>
              </div>
              {variantError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{variantError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={variantSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {variantSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Result Modal ── */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Record Result</h3>
            <form onSubmit={(e) => { void handleRecordResult(e); }} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Variant *</label>
                <select
                  title="Select variant"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={resultForm.variantId}
                  onChange={(e) => setResultForm((f) => ({ ...f, variantId: e.target.value }))}
                  required
                >
                  <option value="">Select variant…</option>
                  {experiment.variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.isControl ? ' (Control)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Period Start *</label>
                  <input
                    type="date"
                    title="Period start date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={resultForm.periodStart}
                    onChange={(e) => setResultForm((f) => ({ ...f, periodStart: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Period End *</label>
                  <input
                    type="date"
                    title="Period end date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={resultForm.periodEnd}
                    onChange={(e) => setResultForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Metric Value *</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 125000"
                    value={resultForm.metricValue}
                    onChange={(e) => setResultForm((f) => ({ ...f, metricValue: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sample Size</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. 200"
                    value={resultForm.sampleSize}
                    onChange={(e) => setResultForm((f) => ({ ...f, sampleSize: e.target.value }))}
                  />
                </div>
              </div>
              {resultError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{resultError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resultSubmitting}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {resultSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Record Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

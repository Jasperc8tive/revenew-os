'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Play,
  CheckCircle2,
  Archive,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api, Experiment, ExperimentStatus, AlertMetric } from '@/lib/api';

export default function ExperimentsPage() {
  const router = useRouter();
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExperimentStatus | 'ALL'>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    hypothesis: '',
    targetMetric: 'REVENUE' as AlertMetric,
  });

  const metrics: AlertMetric[] = ['CAC', 'LTV', 'CHURN', 'REVENUE'];

  const loadExperiments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = filter === 'ALL' ? undefined : filter;
      const result = await api.experiments.listExperiments({
        organizationId: organizationId!,
        status,
      });
      setExperiments(result.experiments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [filter, organizationId]);

  useEffect(() => {
    if (!authLoading && organizationId) {
      void loadExperiments();
    }
  }, [authLoading, organizationId, loadExperiments]);

  const handleCreateExperiment = async () => {
    if (!organizationId) return;

    try {
      const experiment = await api.experiments.createExperiment({
        organizationId,
        ...formData,
      });

      setExperiments([experiment, ...experiments]);
      setShowCreateModal(false);
      setFormData({
        title: '',
        hypothesis: '',
        targetMetric: 'REVENUE',
      });

      router.push(`/experiments/${experiment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create experiment');
    }
  };

  const handleLaunch = async (experimentId: string) => {
    try {
      const updated = await api.experiments.launchExperiment(experimentId, organizationId!);
      setExperiments(
        experiments.map((e) => (e.id === experimentId ? updated : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch experiment');
    }
  };

  const handleComplete = async (experimentId: string) => {
    try {
      const updated = await api.experiments.completeExperiment(
        experimentId,
        organizationId!
      );
      setExperiments(
        experiments.map((e) => (e.id === experimentId ? updated : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete experiment');
    }
  };

  const handleArchive = async (experimentId: string) => {
    try {
      const updated = await api.experiments.archiveExperiment(
        experimentId,
        organizationId!
      );
      setExperiments(
        experiments.map((e) => (e.id === experimentId ? updated : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive experiment');
    }
  };

  const statusColorMap = {
    [ExperimentStatus.DRAFT]: 'text-gray-600 bg-gray-100',
    [ExperimentStatus.RUNNING]: 'text-blue-600 bg-blue-100',
    [ExperimentStatus.COMPLETED]: 'text-green-600 bg-green-100',
    [ExperimentStatus.PAUSED]: 'text-amber-700 bg-amber-100',
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Loading experiments...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900 shadow-sm">
          Sign in to access experiments.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <TrendingUp className="text-blue-600" size={32} />
              Growth Experiments
            </h1>
            <p className="text-slate-600 mt-2">
              Run A/B tests to validate growth hypotheses
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            New Experiment
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['ALL', ExperimentStatus.DRAFT, ExperimentStatus.RUNNING, ExperimentStatus.COMPLETED].map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilter(status as ExperimentStatus | 'ALL')}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* Experiments List */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="inline-block animate-spin text-blue-600" size={32} />
            <p className="mt-4 text-slate-600">Loading experiments...</p>
          </div>
        ) : experiments.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-slate-600 mb-4">
              {filter === 'ALL'
                ? 'No experiments yet. Create your first one to get started.'
                : `No ${filter.toLowerCase()} experiments.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {exp.title}
                    </h3>
                    <p className="text-slate-600 text-sm mt-1">{exp.hypothesis}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      statusColorMap[exp.status as ExperimentStatus]
                    }`}
                  >
                    {exp.status}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    Target: <span className="font-semibold text-slate-700">{exp.targetMetric}</span>
                    {exp.startDate && (
                      <span className="ml-3">
                        Started:{' '}
                        <span className="font-semibold">
                          {new Date(exp.startDate).toLocaleDateString()}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {exp.status === ExperimentStatus.DRAFT && (
                      <button
                        onClick={() => handleLaunch(exp.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition text-sm font-medium"
                      >
                        <Play size={16} />
                        Launch
                      </button>
                    )}
                    {exp.status === ExperimentStatus.RUNNING && (
                      <button
                        onClick={() => handleComplete(exp.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition text-sm font-medium"
                      >
                        <CheckCircle2 size={16} />
                        Complete
                      </button>
                    )}
                    {exp.status !== ExperimentStatus.PAUSED && (
                      <button
                        onClick={() => handleArchive(exp.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition text-sm font-medium"
                      >
                        <Archive size={16} />
                        Pause
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/experiments/${exp.id}`)}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition text-sm font-medium"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              New Experiment
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Experiment Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Discount impact on purchase frequency"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hypothesis
                </label>
                <textarea
                  value={formData.hypothesis}
                  onChange={(e) =>
                    setFormData({ ...formData, hypothesis: e.target.value })
                  }
                  placeholder="What do you expect to happen? Why?"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Target Metric
                </label>
                <select
                  title="Target Metric"
                  value={formData.targetMetric}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targetMetric: e.target.value as AlertMetric,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {metrics.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExperiment}
                disabled={!formData.title || !formData.hypothesis}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

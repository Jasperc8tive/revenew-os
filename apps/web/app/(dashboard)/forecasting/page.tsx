'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, ForecastSimulation } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const formatNaira = (value: number) =>
  `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value)}`;

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
        <span>{label}</span>
        <span className={value > 0 ? 'text-emerald-600' : value < 0 ? 'text-rose-500' : 'text-slate-500'}>
          {value > 0 ? '+' : ''}{value}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        title={`${label} slider`}
        className="h-2 w-full cursor-pointer accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

interface ChartData {
  period: string;
  baseline: number;
  scenario: number;
}

export default function ForecastingPage() {
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();

  const [marketingDelta, setMarketingDelta] = useState(0);
  const [pricingDelta, setPricingDelta] = useState(0);
  const [churnDelta, setChurnDelta] = useState(0);
  const [months, setMonths] = useState(12);

  const [data, setData] = useState<ForecastSimulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSimulation = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.forecasting.simulate({
        organizationId,
        months,
        marketingSpendDeltaPct: marketingDelta,
        pricingDeltaPct: pricingDelta,
        churnDeltaPct: churnDelta,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  }, [organizationId, months, marketingDelta, pricingDelta, churnDelta]);

  // Debounce re-runs on slider change
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      void runSimulation();
    }, 400);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [authLoading, runSimulation]);

  if (authLoading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Sign in to use the forecasting simulator.
        </div>
      </div>
    );
  }

  const chartData: ChartData[] = (data?.baseline ?? []).map((point, i) => ({
    period: point.period,
    baseline: point.value,
    scenario: data?.scenario[i]?.value ?? 0,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Revenue Forecasting Simulator</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Adjust levers to model revenue scenarios against your baseline trend.
          </p>
        </div>
        <button
          onClick={() => void runSimulation()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Levers panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-5 text-base font-semibold text-slate-800 dark:text-white">Scenario Levers</h2>

          <div className="space-y-6">
            <Slider
              label="Marketing Spend"
              value={marketingDelta}
              min={-50}
              max={100}
              step={5}
              onChange={setMarketingDelta}
            />
            <Slider
              label="Pricing"
              value={pricingDelta}
              min={-30}
              max={50}
              step={5}
              onChange={setPricingDelta}
            />
            <Slider
              label="Churn Reduction"
              value={churnDelta}
              min={-50}
              max={50}
              step={5}
              onChange={setChurnDelta}
            />
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>Forecast Months</span>
                <span className="text-indigo-600">{months}mo</span>
              </div>
              <input
                type="range"
                min={3}
                max={24}
                step={3}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                title="Forecast months slider"
                className="h-2 w-full cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>3mo</span>
                <span>24mo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="col-span-1 flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Baseline Total', value: data ? formatNaira(data.summary.baselineTotal) : '—', muted: true },
              { label: 'Scenario Total', value: data ? formatNaira(data.summary.scenarioTotal) : '—', muted: false },
              {
                label: 'Delta Revenue',
                value: data ? formatNaira(data.summary.deltaRevenue) : '—',
                positive: (data?.summary.deltaRevenue ?? 0) >= 0,
              },
              {
                label: 'Delta %',
                value: data ? `${data.summary.deltaRevenuePct > 0 ? '+' : ''}${data.summary.deltaRevenuePct}%` : '—',
                positive: (data?.summary.deltaRevenuePct ?? 0) >= 0,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    'positive' in card && card.positive !== undefined
                      ? card.positive
                        ? 'text-emerald-600'
                        : 'text-rose-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                Baseline vs. Scenario
              </h2>
            </div>

            {loading ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                Running simulation...
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                No historical data available — add monthly metrics to generate forecasts.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatNaira(value)}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Baseline"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenario"
                    name="Scenario"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

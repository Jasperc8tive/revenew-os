'use client';

import { useState } from 'react';
import { Grid3x3, Settings, Eye, EyeOff } from 'lucide-react';
import { useDashboardStore } from '@/lib/store/dashboardStore';

const AVAILABLE_METRICS = [
  { id: 'revenue', label: 'Total Revenue', icon: '📊' },
  { id: 'cac', label: 'Customer Acquisition Cost', icon: '🎯' },
  { id: 'ltv', label: 'Lifetime Value', icon: '📈' },
  { id: 'churn', label: 'Churn Rate', icon: '👥' },
  { id: 'arpu', label: 'Average Revenue Per User', icon: '💰' },
  { id: 'customers', label: 'Total Customers', icon: '👤' },
];

export function DashboardCustomizer() {
  const { preferences, toggleMetricVisibility, setChartsPerRow } = useDashboardStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        title="Customize dashboard"
      >
        <Settings className="w-4 h-4" />
        <span className="text-sm font-medium hidden sm:inline">Customize</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4 w-80 z-50">
          <div className="space-y-6">
            {/* Metrics Visibility */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Visible Metrics
              </h3>
              <div className="space-y-2">
                {AVAILABLE_METRICS.map((metric) => {
                  const isVisible = preferences.visibleMetrics.includes(metric.id);
                  return (
                    <button
                      key={metric.id}
                      onClick={() => toggleMetricVisibility(metric.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                        isVisible
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="text-lg">{metric.icon}</span>
                      <span className="flex-1">{metric.label}</span>
                      {isVisible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Charts per row */}
            <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                Charts per Row
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => setChartsPerRow(count as 1 | 2 | 3)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      preferences.chartsPerRow === count
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {count} Col
                  </button>
                ))}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

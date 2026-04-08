'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useDashboardStore } from '@/lib/store/dashboardStore';

interface DateRangePickerProps {
  onApply?: () => void;
}

export function DateRangePicker({ onApply }: DateRangePickerProps) {
  const { filters, setDateRange } = useDashboardStore();
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(filters.dateRange.start.toISOString().split('T')[0]);
  const [tempEnd, setTempEnd] = useState(filters.dateRange.end.toISOString().split('T')[0]);

  const presets = [
    {
      label: 'Last 7 days',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start, end };
      },
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start, end };
      },
    },
    {
      label: 'Last 90 days',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        return { start, end };
      },
    },
    {
      label: 'This year',
      getValue: () => {
        const end = new Date();
        const start = new Date(end.getFullYear(), 0, 1);
        return { start, end };
      },
    },
  ];

  const handleApply = () => {
    setDateRange({
      start: new Date(tempStart),
      end: new Date(tempEnd),
    });
    setIsOpen(false);
    onApply?.();
  };

  const handlePreset = (preset: (typeof presets)[0]) => {
    const range = preset.getValue();
    setDateRange(range);
    setIsOpen(false);
    onApply?.();
  };

  const formatDateRange = () => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const start = formatter.format(filters.dateRange.start);
    const end = formatter.format(filters.dateRange.end);
    return `${start} - ${end}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        title="Select date range"
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span className="text-sm font-medium">{formatDateRange()}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4 w-80 z-50">
          <div className="space-y-4">
            {/* Presets */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom range */}
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Custom Range</h3>
              <div className="space-y-2">
                <div>
                  <label htmlFor="date-range-start" className="text-xs text-slate-600 dark:text-slate-400">Start Date</label>
                  <input
                    id="date-range-start"
                    type="date"
                    title="Start date"
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="date-range-end" className="text-xs text-slate-600 dark:text-slate-400">End Date</label>
                  <input
                    id="date-range-end"
                    type="date"
                    title="End date"
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

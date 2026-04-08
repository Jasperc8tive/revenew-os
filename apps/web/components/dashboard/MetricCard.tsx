'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    period: string;
  };
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  loading?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  unit,
  trend,
  icon,
  className = '',
  valueClassName = '',
  loading = false,
  onClick,
}: MetricCardProps) {
  return (
    <div
      onClick={onClick}
      className={`surface-card surface-spacing surface-card-hover ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {title}
          </p>
          {loading ? (
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-md w-24 animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold text-slate-900 dark:text-white ${valueClassName}`}
              >
                {value}
              </span>
              {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
            </div>
          )}

          {trend && !loading && (
            <div className="flex items-center gap-1 mt-3">
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-sm ${
                  trend.direction === 'up'
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}
              >
                {trend.direction === 'up' ? (
                  <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowDown className="w-3 h-3" />
                )}
                <span className="text-xs font-medium">{Math.abs(trend.value)}%</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{trend.period}</span>
            </div>
          )}
        </div>

        {icon && !loading && <div className="text-slate-400 dark:text-slate-600 ml-4">{icon}</div>}
      </div>
    </div>
  );
}

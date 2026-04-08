'use client';

import React from 'react';
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from 'lucide-react';

interface InsightCardProps {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidenceScore?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  loading?: boolean;
}

const impactConfig = {
  high: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-100',
    icon: AlertCircleIcon,
    label: 'High Impact',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-100',
    icon: InfoIcon,
    label: 'Medium Impact',
  },
  low: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-800',
    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100',
    icon: CheckCircle2Icon,
    label: 'Low Impact',
  },
};

export function InsightCard({
  title,
  description,
  impact,
  confidenceScore,
  action,
  className = '',
  loading = false,
}: InsightCardProps) {
  const config = impactConfig[impact];
  const Icon = config.icon;

  return (
    <div className={`p-5 md:p-6 rounded-xl border shadow-sm ${config.bg} ${config.border} ${className}`}>
      <div className="flex items-start gap-4">
        <Icon className="w-5 h-5 text-current mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
              {title}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.badge} whitespace-nowrap`}>
              {config.label}
            </span>
          </div>

          {loading ? (
            <>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-2 animate-pulse" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5 animate-pulse" />
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                {description}
              </p>

              <div className="flex items-center justify-between">
                {confidenceScore !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Confidence</span>
                    <progress
                      value={confidenceScore}
                      max={100}
                      className={`w-16 h-1.5 rounded-full overflow-hidden [appearance:none] [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-bar]:dark:bg-slate-700 ${
                        confidenceScore >= 80
                          ? '[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500'
                          : confidenceScore >= 60
                            ? '[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500'
                            : '[&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500'
                      }`}
                      aria-label="Confidence score"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {confidenceScore}%
                    </span>
                  </div>
                )}

                {action && (
                  <button
                    onClick={action.onClick}
                    className="ml-auto px-3 py-1 rounded-md bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 text-xs font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                  >
                    {action.label}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

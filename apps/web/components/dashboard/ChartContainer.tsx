'use client';

import React from 'react';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  action?: React.ReactNode;
}

export function ChartContainer({
  title,
  description,
  children,
  className = '',
  loading = false,
  action,
}: ChartContainerProps) {
  return (
    <div className={`surface-card surface-spacing ${className}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
        {action && !loading && <div className="ml-4">{action}</div>}
      </div>

      {loading ? (
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
      ) : (
        <div className="w-full">{children}</div>
      )}
    </div>
  );
}

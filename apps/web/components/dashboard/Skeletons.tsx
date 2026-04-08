'use client';

export function SkeletonMetric() {
  return (
    <div className="surface-card surface-spacing motion-rhythm-pulse">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-24 mb-2" />
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-32 mb-3" />
          <div className="flex gap-2">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-16" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-lg w-20" />
          </div>
        </div>
        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg ml-4" />
      </div>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="surface-card surface-spacing motion-rhythm-pulse">
      <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-32 mb-6" />
      <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMetric key={i} />
      ))}
    </div>
  );
}

'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { SkeletonChart } from '@/components/dashboard/Skeletons';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View and manage your customer database"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers' },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Customer Insights</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-2">Lifecycle Overview</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Segments, retention markers, and engagement activity will populate this panel.</p>
      </section>
    </div>
  );
}

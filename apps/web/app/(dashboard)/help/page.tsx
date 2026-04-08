'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { SkeletonChart } from '@/components/dashboard/Skeletons';

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & Support"
        description="Documentation, guides, and customer support"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Help & Support' },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Support Overview</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-2">Getting Started</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Quick links to setup guides, FAQs, and support contact options will appear in this section.</p>
      </section>
    </div>
  );
}

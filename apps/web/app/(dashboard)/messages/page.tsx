'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { SkeletonChart } from '@/components/dashboard/Skeletons';

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="WhatsApp conversations and customer communications"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Messages' },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Conversation Health</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-2">Response Workflow</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Queue status, response SLAs, and unresolved conversations will be surfaced here.</p>
      </section>
    </div>
  );
}

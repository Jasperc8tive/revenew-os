import { PageHeader } from '@/components/layout/PageHeader';

interface FeaturePlaceholderProps {
  title: string;
  description: string;
}

export function FeaturePlaceholder({ title, description }: FeaturePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: title },
        ]}
      />
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-2">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Section Ready</h2>
        <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          This workspace is ready for {title.toLowerCase()} implementation. Core layout and navigation are now stable.
        </p>
      </section>
    </div>
  );
}

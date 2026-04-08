import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  action?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  action,
  children,
}: PageHeaderProps) {
  return (
    <section className="surface-card surface-spacing">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-2 mb-3 text-xs md:text-sm">
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Header content */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {description && (
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-2 max-w-3xl">
                {description}
              </p>
            )}
          </div>

          {action && (
            <div className="flex items-center gap-2 self-start md:self-auto">
              {action}
            </div>
          )}
        </div>

        {/* Additional content */}
        {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

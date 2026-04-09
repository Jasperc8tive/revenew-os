'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommandPalette } from '@/components/CommandPalette';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useAuth } from '@/hooks/useAuth';
import { useCommandPaletteShortcut } from '@/hooks/useCommandPaletteShortcut';
import { useRouteAccessGuard } from '@/hooks/useRouteAccessGuard';

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  useCommandPaletteShortcut();
  useRouteAccessGuard();
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    const nextPath = pathname && pathname.startsWith('/') ? pathname : '/dashboard';
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isAuthenticated, isLoading, pathname, router]);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = window.setTimeout(() => setIsTransitioning(false), 280);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading workspace...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Redirecting to login...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <div
        className={`pointer-events-none fixed left-0 top-0 z-50 h-0.5 bg-cyan-500 transition-all duration-300 ${
          isTransitioning ? 'w-full opacity-100' : 'w-0 opacity-0'
        }`}
      />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

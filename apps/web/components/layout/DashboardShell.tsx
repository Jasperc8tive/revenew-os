'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CommandPalette } from '@/components/CommandPalette';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { useAuth } from '@/hooks/useAuth';
import { useCommandPaletteShortcut } from '@/hooks/useCommandPaletteShortcut';

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  useCommandPaletteShortcut();
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    const nextPath = pathname && pathname.startsWith('/') ? pathname : '/dashboard';
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [isAuthenticated, isLoading, pathname, router]);

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
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

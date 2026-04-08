import { DashboardShell } from '@/components/layout/DashboardShell';

// Dashboard is always server-rendered dynamically (authenticated, personalised)
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}


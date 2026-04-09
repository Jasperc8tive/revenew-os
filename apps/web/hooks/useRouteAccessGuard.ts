'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAllowedRolesForPath, hasRoleAccess } from '@/lib/access-control';
import { useAuth } from '@/hooks/useAuth';

export function useRouteAccessGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated, role } = useAuth();

  useEffect(() => {
    if (isLoading || !pathname || !pathname.startsWith('/dashboard')) {
      return;
    }

    const allowedRoles = getAllowedRolesForPath(pathname);
    if (!allowedRoles) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!hasRoleAccess(allowedRoles, role)) {
      const destination = `/dashboard/unauthorized?from=${encodeURIComponent(pathname)}`;
      router.replace(destination);
    }
  }, [isLoading, isAuthenticated, pathname, role, router]);
}
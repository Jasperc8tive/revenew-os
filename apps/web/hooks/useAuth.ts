import { useCallback, useEffect, useState } from 'react';
import { auth, AuthSession } from '@/lib/auth';

// Hook for managing user authentication and session state
export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(auth.getSession());
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    auth.clearSession();
    setSession(null);
  }, []);

  return {
    session,
    isLoading,
    isAuthenticated: Boolean(session),
    organizationId: session?.organizationId,
    role: session?.role,
    logout,
  };
}

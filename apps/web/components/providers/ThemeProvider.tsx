'use client';

import { useEffect } from 'react';
import { applyThemeMode, readStoredThemeMode } from '@/lib/theme';

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    applyThemeMode(readStoredThemeMode());
  }, []);

  return <>{children}</>;
}

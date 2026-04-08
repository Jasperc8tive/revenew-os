'use client';

import { useEffect, useState } from 'react';
import {
  applyThemeMode,
  persistThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  THEME_EVENT_NAME,
  ThemeMode,
} from '@/lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const syncTheme = () => {
      const nextTheme = readStoredThemeMode();
      setThemeState(nextTheme);
      setResolvedTheme(applyThemeMode(nextTheme));
    };

    syncTheme();

    const mediaQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const handleSystemThemeChange = () => {
      const currentTheme = readStoredThemeMode();
      if (currentTheme === 'system') {
        setResolvedTheme(applyThemeMode(currentTheme));
      }
    };

    const handleThemeEvent = () => {
      syncTheme();
    };

    mediaQuery?.addEventListener?.('change', handleSystemThemeChange);
    window.addEventListener('storage', handleThemeEvent);
    window.addEventListener(THEME_EVENT_NAME, handleThemeEvent as EventListener);

    return () => {
      mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
      window.removeEventListener('storage', handleThemeEvent);
      window.removeEventListener(THEME_EVENT_NAME, handleThemeEvent as EventListener);
    };
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    persistThemeMode(nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(resolveThemeMode(nextTheme));
  };

  return {
    theme,
    setTheme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
  };
}

'use client';

import { useEffect } from 'react';
import { useCommandPaletteStore } from '@/lib/store/commandPaletteStore';

/**
 * Listens for Cmd+K (Mac) / Ctrl+K (Windows/Linux) and toggles the command palette.
 * Mount this once at the root of the app (inside DashboardLayout or RootLayout).
 */
export function useCommandPaletteShortcut() {
  const { toggle } = useCommandPaletteStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);
}

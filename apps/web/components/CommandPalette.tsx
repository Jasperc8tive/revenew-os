'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { Search, X } from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/store/commandPaletteStore';
import { useDashboardStore } from '@/lib/store/dashboardStore';
import { buildCommands, COMMAND_GROUPS } from '@/lib/commands';
import { useAuth } from '@/hooks/useAuth';

export function CommandPalette() {
  const { role, organizationId } = useAuth();
  const { isOpen, close } = useCommandPaletteStore();
  const { filters, setDateRange } = useDashboardStore();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const isDark = resolvedTheme === 'dark';
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  const toggleDarkMode = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    close();
  }, [resolvedTheme, setTheme, close]);

  const refreshDashboard = useCallback(() => {
    window.location.reload();
    close();
  }, [close]);

  const exportDashboardCsv = useCallback(async () => {
    if (!organizationId) {
      close();
      return;
    }

    const params = new URLSearchParams({
      organizationId,
      startDate: filters.dateRange.start.toISOString(),
      endDate: filters.dateRange.end.toISOString(),
    });

    const response = await fetch(`/api/dashboard/export?${params.toString()}&format=pdf`);
    if (!response.ok) {
      close();
      return;
    }

    const fileBlob = await response.blob();
    const blob = new Blob([fileBlob], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    close();
  }, [organizationId, filters.dateRange.start, filters.dateRange.end, close]);

  // Build all commands, injecting date range setters
  const allCommands = buildCommands({ navigate, toggleDarkMode, isDark, refreshDashboard, exportDashboardCsv, role }).map(
    (cmd) => {
      if (cmd.id === 'action-filter-7d') {
        return {
          ...cmd,
          action: () => {
            const end = new Date();
            const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
            setDateRange({ start, end });
            navigate('/dashboard');
          },
        };
      }
      if (cmd.id === 'action-filter-30d') {
        return {
          ...cmd,
          action: () => {
            const end = new Date();
            const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
            setDateRange({ start, end });
            navigate('/dashboard');
          },
        };
      }
      if (cmd.id === 'action-filter-90d') {
        return {
          ...cmd,
          action: () => {
            const end = new Date();
            const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
            setDateRange({ start, end });
            navigate('/dashboard');
          },
        };
      }
      return cmd;
    }
  );

  // Filter commands by query
  const filtered = query.trim()
    ? allCommands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.toLowerCase().includes(q))
        );
      })
    : allCommands;

  // Group filtered results
  const grouped = COMMAND_GROUPS.map((group) => ({
    ...group,
    commands: filtered.filter((c) => c.group === group.key),
  })).filter((g) => g.commands.length > 0);

  // Flat list for keyboard navigation
  const flatCommands = grouped.flatMap((g) => g.commands);

  // Reset index when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flatCommands[activeIndex];
        if (cmd) {
          cmd.action();
          close();
        }
      } else if (e.key === 'Escape') {
        close();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, flatCommands, activeIndex, close]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={close}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands, pages, filters…"
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 outline-none text-sm"
              aria-label="Search commands"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            id="command-palette-results"
            className="max-h-80 overflow-y-auto py-2"
          >
            {flatCommands.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No commands found for &quot;{query}&quot;
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.key}>
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                  {group.commands.map((cmd) => {
                    const Icon = cmd.icon;
                    const flatIdx = flatCommands.indexOf(cmd);
                    const isActive = flatIdx === activeIndex;

                    return (
                      <button
                        key={cmd.id}
                        id={`cmd-${cmd.id}`}
                        onClick={() => {
                          cmd.action();
                          close();
                        }}
                        onMouseEnter={() => setActiveIndex(flatIdx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 p-1.5 rounded-md ${
                            isActive
                              ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <span
                            className={`block text-sm font-medium truncate ${
                              isActive
                                ? 'text-primary-700 dark:text-primary-300'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {cmd.label}
                          </span>
                          {cmd.description && (
                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                              {cmd.description}
                            </span>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {cmd.shortcut.map((key) => (
                              <kbd
                                key={key}
                                className="px-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-500">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-500">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 text-slate-500">ESC</kbd>
              Close
            </span>
            <span className="ml-auto text-xs text-slate-400">
              {flatCommands.length} command{flatCommands.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { Search, Moon, Sun, LogOut, Settings, User } from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/store/commandPaletteStore';

interface TopNavProps {
  className?: string;
}

export function TopNav({ className = '' }: TopNavProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { open: openPalette } = useCommandPaletteStore();
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate breadcrumbs from pathname
  const pathSegments = pathname
    .split('/')
    .filter(Boolean);
  const normalizedSegments = pathSegments[0] === 'dashboard' ? pathSegments.slice(1) : pathSegments;
  const breadcrumbBase = pathSegments[0] === 'dashboard' ? '/dashboard' : '';
  const breadcrumbs = normalizedSegments.map((segment, index, arr) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
      href: `${breadcrumbBase}/${arr.slice(0, index + 1).join('/')}`,
    }));

  const toggleDarkMode = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <header
      className={`sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 ${className}`}
    >
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          {breadcrumbs.length > 0 ? (
            <nav className="flex items-center gap-2 text-sm overflow-x-auto">
              <Link
                href="/dashboard"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
              >
                Dashboard
              </Link>
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={breadcrumb.href}>
                  <span className="text-slate-400 dark:text-slate-600">/</span>
                  <Link
                    href={breadcrumb.href}
                    className={`transition-colors whitespace-nowrap ${
                      index === breadcrumbs.length - 1
                        ? 'text-slate-900 dark:text-white font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {breadcrumb.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          ) : (
            <span className="text-slate-900 dark:text-white font-medium whitespace-nowrap">Dashboard</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Search / Command Palette trigger */}
          <button
            onClick={openPalette}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm"
            title="Open command palette (Cmd+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden md:inline text-slate-400 dark:text-slate-500">Search...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-mono text-slate-500 dark:text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mounted && isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Open profile menu"
              aria-haspopup="true"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              title="Profile"
            >
              <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-medium">
                M
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Mayowa</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">mayowa@example.com</p>
                </div>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors border-t border-slate-200 dark:border-slate-700">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

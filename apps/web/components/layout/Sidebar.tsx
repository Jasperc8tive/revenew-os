'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, HelpCircle } from 'lucide-react';
import { navigationConfig } from '@/config/navigation';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleDesktopSidebar = () => setIsCollapsed((prev) => !prev);
  const toggleMobileSidebar = () => setMobileOpen((prev) => !prev);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggleMobileSidebar}
        aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
        className="fixed bottom-6 right-6 z-50 md:hidden p-3 rounded-lg bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-colors"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-20 ${
          isCollapsed ? 'w-20' : 'w-64'
        } flex-col shrink-0 ${className}`}
      >
        {/* Logo/Brand */}
        <div className="px-4 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className={`flex items-center gap-2 transition-opacity ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              R
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">Revenew</span>
          </div>
          <button
            onClick={toggleDesktopSidebar}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {navigationConfig.map((section, idx) => (
            <div key={idx}>
              {!isCollapsed && section.label && (
                <h3 className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {section.label}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      aria-label={isCollapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                        active
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && (
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-sm font-medium">{item.label}</span>
                          {item.badge && (
                            <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full font-medium">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
            title={isCollapsed ? 'Help' : undefined}
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Help</span>}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 z-40 md:hidden flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${className}`}
      >
        <div className="px-4 py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              R
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">Revenew</span>
          </div>
          <button
            onClick={toggleMobileSidebar}
            aria-label="Close sidebar"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {navigationConfig.map((section, idx) => (
            <div key={idx}>
              {section.label && (
                <h3 className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {section.label}
                </h3>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                        active
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.badge && (
                          <span className="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-full font-medium">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}

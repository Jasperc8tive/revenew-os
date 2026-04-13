'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';

type OrgProfile = {
  id: string;
  name: string;
  industry: string;
  plan?: string;
  createdAt: string;
};

const INDUSTRY_OPTIONS = [
  { value: 'FINTECH', label: 'Fintech' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'ECOMMERCE', label: 'E-Commerce' },
  { value: 'OTHER', label: 'Other' },
] as const;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export default function SettingsPage() {
  const { organizationId, role } = useAuth();

  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('OTHER');
  const [saved, setSaved] = useState(false);

  const session = auth.getSession();
  const email = session?.email ?? '—';
  const displayRole = role ?? session?.role ?? '—';

  useEffect(() => {
    if (!organizationId) return;
    const token = auth.getSession()?.accessToken;
    setLoadingOrg(true);

    apiFetch<OrgProfile>(`/organizations/${organizationId}`, token)
      .then((data) => {
        setOrg(data);
        setOrgName(data.name ?? '');
        setIndustry(data.industry ?? 'OTHER');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load organization';
        setFetchError(msg);
        setOrgName('My Organization');
        setIndustry('OTHER');
      })
      .finally(() => setLoadingOrg(false));
  }, [organizationId]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function formatDate(iso: string | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organization profile, preferences, and account management"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      {/* Main settings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization Profile card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            Organization Profile
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Update your organization name and industry.
          </p>

          {loadingOrg ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : fetchError ? (
            <p className="text-sm text-red-500 dark:text-red-400 mb-4">
              Could not load organization data. Showing defaults.
            </p>
          ) : null}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label
                htmlFor="org-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Organization Name
              </label>
              <input
                id="org-name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
              />
            </div>

            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Industry
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Timezone
              </p>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 select-none">
                Africa/Lagos
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {saved ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Saved!
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Account card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            Account
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            Your personal account details.
          </p>

          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                Email Address
              </dt>
              <dd className="text-sm text-slate-900 dark:text-white break-all">{email}</dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                Role
              </dt>
              <dd className="text-sm text-slate-900 dark:text-white capitalize">
                {typeof displayRole === 'string' && displayRole !== '—'
                  ? displayRole.replace('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
                  : displayRole}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-0.5">
                Member Since
              </dt>
              <dd className="text-sm text-slate-900 dark:text-white">
                {formatDate(org?.createdAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-1">
          Danger Zone
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Permanently delete this organization and all associated data. This action cannot be undone.
        </p>
        <button
          type="button"
          className="inline-flex items-center rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Delete Organization
        </button>
      </div>
    </div>
  );
}

'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';

function normalizeRedirectPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/')) return '/dashboard';
  if (nextPath.startsWith('//')) return '/';
  return nextPath;
}

function parseOrganizationIdFromToken(token?: string) {
  if (!token) return null;

  try {
    const segments = token.split('.');
    if (segments.length < 2) return null;

    const decoded = JSON.parse(atob(segments[1])) as Record<string, unknown>;
    const orgId = decoded.organizationId ?? decoded.orgId;
    return typeof orgId === 'string' ? orgId : null;
  } catch {
    return null;
  }
}

const INDUSTRIES = [
  { value: 'FINTECH', label: 'Fintech' },
  { value: 'SAAS', label: 'SaaS' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'OTHER', label: 'Other' },
] as const;

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState('');
  const [industry, setIndustry] = useState<'FINTECH' | 'SAAS' | 'LOGISTICS' | 'ECOMMERCE' | 'OTHER'>('OTHER');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(
    () => normalizeRedirectPath(searchParams.get('next')),
    [searchParams],
  );

  useEffect(() => {
    if (auth.isAuthenticated()) {
      router.replace(nextPath);
    }
  }, [nextPath, router]);

  function validateForm(): string | null {
    if (!email.trim()) return 'Email is required.';
    if (!email.includes('@')) return 'Please enter a valid email.';
    
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    if (!/\d/.test(password)) return 'Password must contain a number.';
    
    if (!confirmPassword) return 'Please confirm your password.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    
    if (!organizationName.trim()) return 'Organization name is required.';
    if (organizationName.trim().length < 2) return 'Organization name must be at least 2 characters.';
    
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.auth.register({
        email: email.trim().toLowerCase(),
        password,
        organizationName: organizationName.trim(),
        fullName: fullName.trim() || undefined,
        industry,
      });

      const token = response.accessToken ?? response.token;
      const organizationId =
        response.organizationId ??
        response.user?.organizationId ??
        parseOrganizationIdFromToken(token) ??
        'org-local';

      auth.setSession({
        userId: response.user?.id ?? response.userId ?? `local-${email.trim().toLowerCase()}`,
        email: response.user?.email ?? response.email ?? email.trim().toLowerCase(),
        organizationId,
        accessToken: token,
      });

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create account.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.14),transparent_38%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.16),transparent_35%),linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#ecfeff_100%)]" />

      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-xl shadow-slate-300/30 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
            Revenew OS
          </p>
          <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
            Get Started
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Create your workspace and start monitoring revenue growth signals instantly.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-slate-700">
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              Unified revenue metrics across all channels
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              AI-powered insights for Nigerian SMB growth
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              Team collaboration with role-based access
            </li>
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-300/30">
          <h2 className="text-2xl font-bold text-slate-900">Create Account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Join Revenew OS and unlock revenue intelligence for your organization.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="you@company.com"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="organizationName">
                Organization name
              </label>
              <input
                id="organizationName"
                type="text"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="Your Company Ltd"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="industry">
                Industry
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value as typeof industry)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                disabled={isSubmitting}
                required
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="fullName">
                Full name (optional)
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="Your Name"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number"
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-slate-500">
                Must be at least 8 characters with uppercase, lowercase, and a number.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="confirmPassword">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="Confirm your password"
                disabled={isSubmitting}
                required
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-cyan-700 hover:text-cyan-600">
                Sign in
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

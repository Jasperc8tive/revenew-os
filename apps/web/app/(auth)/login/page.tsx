'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';

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

function normalizeRedirectPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/')) return '/dashboard';
  if (nextPath.startsWith('//')) return '/';
  return nextPath;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError('Enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.auth.login({
        email: email.trim().toLowerCase(),
        password,
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
      const message = submitError instanceof Error ? submitError.message : 'Unable to sign in.';
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
            Welcome back
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Sign in to continue monitoring growth signals, forecasts, and revenue alerts.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-slate-700">
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              Unified revenue metrics across your channels
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              AI insights for Nigerian SMB growth decisions
            </li>
            <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              Team collaboration with role-based workflows
            </li>
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-300/30">
          <h2 className="text-2xl font-bold text-slate-900">Login</h2>
          <p className="mt-2 text-sm text-slate-600">
            Use your account credentials to access your workspace.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
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
              <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                placeholder="Enter your password"
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
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-semibold text-cyan-700 hover:text-cyan-600">
                Create one
              </Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

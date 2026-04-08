import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_KEY } from '@/lib/auth-constants';

const LEGACY_DASHBOARD_REDIRECTS: Record<string, string> = {
  '/analytics': '/dashboard/analytics',
  '/acquisition': '/dashboard/acquisition',
  '/pipeline': '/dashboard/pipeline',
  '/retention': '/dashboard/retention',
  '/pricing': '/dashboard/pricing',
  '/agents': '/dashboard/agents',
  '/recommendations': '/dashboard/recommendations',
  '/integrations': '/dashboard/integrations',
  '/reports': '/dashboard/reports',
  '/billing': '/dashboard/billing',
  '/settings': '/dashboard/settings',
  '/command-center': '/dashboard/command-center',
  '/verification': '/dashboard/verification',
  '/forecasting': '/dashboard/forecasting',
  '/experiments': '/dashboard/experiments',
  '/competitive': '/dashboard/competitive',
  '/copilot': '/dashboard/copilot',
  '/benchmarking': '/dashboard/benchmarking',
};

function isAuthRoute(pathname: string) {
  return pathname === '/login' || pathname === '/register';
}

function isProtectedRoute(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_KEY)?.value);

  if (pathname === '/') {
    if (hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', '/dashboard');
    return NextResponse.redirect(loginUrl);
  }

  const legacyTarget = LEGACY_DASHBOARD_REDIRECTS[pathname];
  if (legacyTarget) {
    const redirectUrl = new URL(legacyTarget, request.url);
    if (search) {
      redirectUrl.search = search;
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!hasSession && isProtectedRoute(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isAuthRoute(pathname)) {
    const nextPath = request.nextUrl.searchParams.get('next');
    const destination = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')
      ? nextPath
      : '/dashboard';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/login',
    '/register',
    '/analytics',
    '/acquisition',
    '/pipeline',
    '/retention',
    '/pricing',
    '/agents',
    '/recommendations',
    '/integrations',
    '/reports',
    '/billing',
    '/settings',
    '/command-center',
    '/verification',
    '/forecasting',
    '/experiments',
    '/competitive',
    '/copilot',
    '/benchmarking',
  ],
};
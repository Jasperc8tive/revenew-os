import Link from 'next/link';

type UnauthorizedPageProps = {
  searchParams?: {
    from?: string;
  };
};

export default function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const attemptedPath = searchParams?.from;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-8 shadow-sm">
        <div className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
          Access restricted
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">This route is not available for your role</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your current workspace role does not have permission to open this dashboard route.
        </p>
        {attemptedPath ? (
          <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-600">
            Attempted route: {attemptedPath}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Return to dashboard
          </Link>
          <Link
            href="/dashboard/help"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Open help and support
          </Link>
        </div>
      </div>
    </div>
  );
}
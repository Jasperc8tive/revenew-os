import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-slate-200 dark:text-slate-800">404</h1>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Page not found</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

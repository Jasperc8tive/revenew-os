'use client';

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-2 text-sm opacity-90">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs opacity-60">Error ID: {error.digest}</p>
        ) : null}
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

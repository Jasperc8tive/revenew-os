// Onboarding wizard page
export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Revenew OS</p>
        <h1 className="mt-4 text-3xl font-black">Onboarding</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Workspace onboarding is being finalized. Your core dashboard is available now at /dashboard.
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No onboarding checklist is available yet.
        </div>
      </div>
    </main>
  );
}

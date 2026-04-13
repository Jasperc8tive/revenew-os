'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, BillingPlan, BillingSubscription } from '@/lib/api';
import { formatNGN } from '@/utils/currency';
import { useAuth } from '@/hooks/useAuth';

export default function PricingPage() {
  const { organizationId, isLoading: authLoading, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [plansData, subscriptionData] = await Promise.all([
        api.billing.getPlans(),
        api.billing.getSubscription(organizationId),
      ]);
      setPlans(plansData);
      setSubscription(subscriptionData.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading) {
      void loadData();
    }
  }, [authLoading, loadData]);

  if (authLoading) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-600 dark:text-slate-400">
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-amber-800 dark:text-amber-300">
        You need an authenticated session with an organization to view pricing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing & Billing"
        description="Manage your subscription plan and billing"
      />

      {/* Current Plan Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Current Plan</h2>

        {loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : subscription ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{subscription.plan.name}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Tier: <span className="font-medium text-slate-800 dark:text-slate-200">{subscription.plan.tier}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {subscription.status}
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
                  {subscription.billingInterval === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>
                Started:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {new Date(subscription.startDate).toLocaleDateString()}
                </span>
              </span>
              {subscription.endDate && (
                <span>
                  Renews:{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {new Date(subscription.endDate).toLocaleDateString()}
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-5 text-center text-slate-500 dark:text-slate-400">
            No active plan. Choose a plan below to get started.
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Billing Interval Toggle */}
      <div className="flex items-center justify-center gap-2">
        <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          Monthly
        </span>
        <button
          type="button"
          onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            billingInterval === 'yearly' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
          aria-label="Toggle billing interval"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${billingInterval === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
          Yearly
          <span className="ml-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Save more
          </span>
        </span>
      </div>

      {/* Plans Comparison Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan.tier === plan.tier;
            const price = billingInterval === 'monthly' ? plan.display.monthly : plan.display.yearly;
            const yearlySaving =
              plan.priceYearly != null ? plan.priceMonthly * 12 - plan.priceYearly : 0;

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition ${
                  isCurrent
                    ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow">
                    Current Plan
                  </span>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {plan.tier}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                </div>

                <div className="mt-4">
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{price}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {billingInterval === 'monthly' ? 'per month' : 'per year'}
                  </p>
                  {billingInterval === 'yearly' && yearlySaving > 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Save {formatNGN(yearlySaving)} / year
                    </p>
                  )}
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isCurrent}
                  className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    isCurrent
                      ? 'cursor-default bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade'}
                </button>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

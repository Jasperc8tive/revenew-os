'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, BillingInterval, BillingInvoice, BillingPlan, BillingSubscription, PaymentProvider, PlanTier } from '@/lib/api';
import { formatNGN } from '@/utils/currency';
import { useAuth } from '@/hooks/useAuth';

export default function BillingPage() {
  const { organizationId, isLoading: authLoading, isAuthenticated } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTHLY');
  const [provider, setProvider] = useState<PaymentProvider>('paystack');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [plansResponse, subscriptionResponse, invoicesResponse] = await Promise.all([
        api.billing.getPlans(),
        api.billing.getSubscription(organizationId),
        api.billing.getInvoices(organizationId),
      ]);

      setPlans(plansResponse);
      setSubscription(subscriptionResponse.subscription);
      setInvoices(invoicesResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load billing data');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!authLoading) {
      void loadBilling();
    }
  }, [authLoading, loadBilling]);

  const currentTier = subscription?.plan.tier;

  const annualSavingsByTier = useMemo(() => {
    const map = new Map<PlanTier, number>();
    plans.forEach((plan) => {
      if (plan.priceYearly) {
        map.set(plan.tier, plan.priceMonthly * 12 - plan.priceYearly);
      }
    });
    return map;
  }, [plans]);

  const handleSubscribe = useCallback(
    async (tier: PlanTier) => {
      setSubmitting(true);
      setError(null);
      setMessage(null);

      try {
        if (subscription) {
          await api.billing.upgrade({
            organizationId,
            targetTier: tier,
            billingInterval,
            paymentProvider: provider,
          });
          setMessage(`Subscription changed to ${tier} (${billingInterval.toLowerCase()}).`);
        } else {
          await api.billing.subscribe({
            organizationId,
            tier,
            billingInterval,
            paymentProvider: provider,
          });
          setMessage(`Subscription created on ${tier} (${billingInterval.toLowerCase()}).`);
        }

        await loadBilling();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Billing request failed');
      } finally {
        setSubmitting(false);
      }
    },
    [billingInterval, loadBilling, organizationId, provider, subscription],
  );

  const handleCancel = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await api.billing.cancel({
        organizationId,
        reason: 'Canceled from dashboard',
      });
      setMessage('Subscription canceled successfully.');
      await loadBilling();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel subscription');
    } finally {
      setSubmitting(false);
    }
  }, [loadBilling, organizationId]);

  if (authLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">Loading session...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        You need an authenticated session with an organization context to view billing.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Revenue OS Billing</h1>
            <p className="mt-2 text-slate-600">
              Manage your plan, renewal cadence, and invoice history in NGN.
            </p>
          </div>

          <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Organization
              <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
                {organizationId}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700" htmlFor="billing-interval">
              Billing Cycle
              <select
                id="billing-interval"
                value={billingInterval}
                onChange={(event) => setBillingInterval(event.target.value as BillingInterval)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700" htmlFor="billing-provider">
              Payment Provider
              <select
                id="billing-provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value as PaymentProvider)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="stripe">Stripe</option>
              </select>
            </label>
          </div>
        </div>

        {subscription && (
          <div className="mt-4 rounded-xl border border-emerald-300/70 bg-white/90 p-4">
            <p className="text-sm text-slate-600">Current Plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-xl font-semibold text-slate-900">{subscription.plan.name}</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {subscription.status}
              </span>
              <span className="text-sm text-slate-600">
                Renews {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        )}
      </section>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const savings = annualSavingsByTier.get(plan.tier) ?? 0;

          return (
            <article
              key={plan.id}
              className={`rounded-2xl border p-5 ${
                isCurrent
                  ? 'border-emerald-400 bg-emerald-50/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Active
                  </span>
                )}
              </div>

              <p className="mt-3 text-2xl font-bold text-slate-900">
                {billingInterval === 'MONTHLY' ? plan.display.monthly : plan.display.yearly}
              </p>
              {billingInterval === 'YEARLY' && savings > 0 && (
                <p className="mt-1 text-sm text-emerald-700">Save {formatNGN(savings)} per year</p>
              )}

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="capitalize">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={submitting || isCurrent || loading}
                onClick={() => void handleSubscribe(plan.tier)}
                className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {subscription ? 'Switch to this plan' : 'Start plan'}
              </button>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Invoice History</h2>
          {subscription && (
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={submitting}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel Subscription
            </button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">Invoice</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">Plan</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">Amount</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold text-slate-700">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-slate-500">Loading invoices...</td>
                </tr>
              )}

              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-5 text-center text-slate-500">No invoices yet.</td>
                </tr>
              )}

              {!loading &&
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-3 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                    <td className="px-3 py-3 text-slate-700">{invoice.plan}</td>
                    <td className="px-3 py-3 text-slate-700">{invoice.amountDisplay}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {invoice.paymentStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, OrderRecord } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatNGN } from '@/utils/currency';

export default function OrdersPage() {
  const { organizationId } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.operations.listOrders(organizationId);
        setOrders(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  const pendingCount = useMemo(
    () => orders.filter((order) => order.status === 'PENDING').length,
    [orders],
  );

  const totalRevenue = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalAmount, 0),
    [orders],
  );

  const markFulfilled = async (orderId: string) => {
    if (!organizationId) return;

    const updated = await api.operations.updateOrderStatus({
      orderId,
      organizationId,
      status: 'FULFILLED',
    });

    setOrders((prev) => prev.map((order) => (order.id === updated.id ? updated : order)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage and track customer orders"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Orders' },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Order Intelligence</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Pending Orders</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{pendingCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Order Value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatNGN(totalRevenue)}</p>
          </article>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-2">Activity Feed</h3>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading orders...</p> : null}
        {!loading && error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {!loading && !error && orders.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">No orders yet. Orders will appear as they are captured from customer activity.</p>
        ) : null}
        {!loading && !error && orders.length > 0 ? (
          <ul className="space-y-3">
            {orders.slice(0, 8).map((order) => (
              <li key={order.id} className="flex flex-col md:flex-row md:items-center md:justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{order.customerEmail}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatNGN(order.totalAmount)} • {order.status} • {new Date(order.createdAt).toLocaleString('en-NG')}</p>
                </div>
                {order.status !== 'FULFILLED' ? (
                  <button
                    onClick={() => void markFulfilled(order.id)}
                    className="mt-2 md:mt-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Mark Fulfilled
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

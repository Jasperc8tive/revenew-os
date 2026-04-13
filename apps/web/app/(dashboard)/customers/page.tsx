'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/auth';
import { api, OrderRecord } from '@/lib/api';
import { formatNGN } from '@/utils/currency';

type CustomerStatus = 'ACTIVE' | 'CHURNED' | 'AT_RISK';

type Customer = {
  id: string;
  email: string;
  name: string | null;
  totalOrders: number;
  totalSpend: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  status: CustomerStatus;
};

type DerivedCustomer = {
  id: string;
  email: string;
  name: string | null;
  totalOrders: number;
  totalSpend: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  status: CustomerStatus;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function deriveCustomersFromOrders(orders: OrderRecord[]): DerivedCustomer[] {
  const map = new Map<
    string,
    {
      totalOrders: number;
      totalSpend: number;
      firstOrderAt: string | null;
      lastOrderAt: string | null;
    }
  >();

  for (const order of orders) {
    const existing = map.get(order.customerEmail);
    if (!existing) {
      map.set(order.customerEmail, {
        totalOrders: 1,
        totalSpend: order.totalAmount,
        firstOrderAt: order.createdAt,
        lastOrderAt: order.createdAt,
      });
    } else {
      existing.totalOrders += 1;
      existing.totalSpend += order.totalAmount;
      const created = new Date(order.createdAt);
      if (existing.firstOrderAt && created < new Date(existing.firstOrderAt)) {
        existing.firstOrderAt = order.createdAt;
      }
      if (existing.lastOrderAt && created > new Date(existing.lastOrderAt)) {
        existing.lastOrderAt = order.createdAt;
      }
    }
  }

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  return Array.from(map.entries()).map(([email, data], idx) => {
    const daysSinceLast = data.lastOrderAt
      ? now - new Date(data.lastOrderAt).getTime()
      : Infinity;

    let status: CustomerStatus = 'ACTIVE';
    if (daysSinceLast > SIXTY_DAYS_MS) {
      status = 'CHURNED';
    } else if (daysSinceLast > THIRTY_DAYS_MS) {
      status = 'AT_RISK';
    }

    return {
      id: String(idx),
      email,
      name: null,
      ...data,
      status,
    };
  });
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  const config: Record<CustomerStatus, { label: string; classes: string }> = {
    ACTIVE: {
      label: 'Active',
      classes:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    AT_RISK: {
      label: 'At Risk',
      classes:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
    CHURNED: {
      label: 'Churned',
      classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
  };

  const { label, classes } = config[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function CustomersPage() {
  const { organizationId } = useAuth();

  const [customers, setCustomers] = useState<DerivedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    const token = auth.getSession()?.accessToken;
    setLoading(true);
    setError(null);

    apiFetch<Customer[]>(
      `/customers?organizationId=${encodeURIComponent(organizationId)}`,
      token,
    )
      .then((data) => setCustomers(data))
      .catch(async () => {
        // Fallback: derive customers from orders
        try {
          const orders = await api.operations.listOrders(organizationId);
          setCustomers(deriveCustomersFromOrders(orders));
        } catch (fallbackErr) {
          const msg =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Failed to load customers';
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [organizationId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.name ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  const totalCount = customers.length;
  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const riskAndChurnCount = customers.filter(
    (c) => c.status === 'AT_RISK' || c.status === 'CHURNED',
  ).length;

  const summaryCards = [
    {
      label: 'Total Customers',
      value: loading ? '—' : totalCount.toLocaleString(),
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Active',
      value: loading ? '—' : activeCount.toLocaleString(),
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'At Risk / Churned',
      value: loading ? '—' : riskAndChurnCount.toLocaleString(),
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer database, lifetime value, and engagement"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers' },
        ]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              {card.label}
            </p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search and table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex-1">
            All Customers
          </h2>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition w-full sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="mx-auto w-10 h-10 text-slate-300 dark:text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {search ? 'No customers match your search' : 'No customers yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {search
                ? 'Try adjusting your search term.'
                : 'Customer records will appear here once orders are processed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Name
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Orders
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Total Spend
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last Order
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-slate-900 dark:text-white font-medium max-w-[220px] truncate">
                      {customer.email}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {customer.name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                      {customer.totalOrders.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-900 dark:text-white tabular-nums font-medium">
                      {formatNGN(customer.totalSpend)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(customer.lastOrderAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={customer.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

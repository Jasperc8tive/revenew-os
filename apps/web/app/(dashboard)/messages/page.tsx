'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, MessageRecord } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function MessagesPage() {
  const { organizationId } = useAuth();
  const [messages, setMessages] = useState<MessageRecord[]>([]);
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
        const data = await api.operations.listMessages(organizationId);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId]);

  const unresolvedCount = useMemo(
    () => messages.filter((message) => !message.resolved).length,
    [messages],
  );

  const resolveMessage = async (messageId: string) => {
    if (!organizationId) return;

    const updated = await api.operations.resolveMessage({
      messageId,
      organizationId,
    });

    setMessages((prev) => prev.map((message) => (message.id === updated.id ? updated : message)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="WhatsApp conversations and customer communications"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Messages' },
        ]}
      />
      <section className="space-y-4">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Conversation Health</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Unresolved</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{unresolvedCount}</p>
          </article>
          <article className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Conversations</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{messages.length}</p>
          </article>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-sm">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-2">Response Workflow</h3>
        {loading ? <p className="text-sm text-slate-600 dark:text-slate-300">Loading conversation queue...</p> : null}
        {!loading && error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {!loading && !error && messages.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">No messages yet. Inbound conversations will appear here.</p>
        ) : null}
        {!loading && !error && messages.length > 0 ? (
          <ul className="space-y-3">
            {messages.slice(0, 10).map((message) => (
              <li key={message.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{message.customerEmail} • {message.channel.toUpperCase()}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{message.body}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(message.createdAt).toLocaleString('en-NG')} • {message.resolved ? 'Resolved' : 'Pending'}</p>
                  </div>
                  {!message.resolved ? (
                    <button
                      onClick={() => void resolveMessage(message.id)}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

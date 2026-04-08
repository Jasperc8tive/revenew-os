'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, SendHorizontal } from 'lucide-react';
import { api, CopilotConversation, CopilotMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function CopilotPage() {
  const { organizationId, isAuthenticated, isLoading: authLoading } = useAuth();

  const [conversation, setConversation] = useState<CopilotConversation | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeConversation = async () => {
      if (!organizationId) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const created = await api.copilot.createConversation({
          organizationId,
          title: 'Growth Copilot Session',
        });
        setConversation(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize copilot');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      void initializeConversation();
    }
  }, [authLoading, organizationId]);

  const messages = useMemo(() => conversation?.messages ?? [], [conversation]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!organizationId || !conversation || !input.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await api.copilot.sendMessage(conversation.id, {
        organizationId,
        content: input.trim(),
      });

      setConversation((current) => {
        if (!current) {
          return current;
        }

        const existing = current.messages;
        const additions = response.messages.filter(
          (candidate) => !existing.some((message) => message.id === candidate.id),
        );

        return {
          ...current,
          messages: [...existing, ...additions],
        };
      });
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send prompt');
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return <div className="p-6 text-sm text-slate-600 dark:text-slate-300">Loading AI Copilot...</div>;
  }

  if (!isAuthenticated || !organizationId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
          Sign in to use Growth Copilot.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">AI Growth Copilot</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ask for weekly growth plans, channel optimizations, and executive recommendations.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="max-h-[480px] space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Start by asking: &quot;Where should we focus this week to improve LTV:CAC?&quot;
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Growth Copilot for an actionable plan..."
              className="min-h-[78px] flex-1 resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={sending || input.trim().length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizontal className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: CopilotMessage }) {
  const isUser = message.role === 'USER';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
          {isUser ? 'You' : 'Copilot'}
        </div>
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}

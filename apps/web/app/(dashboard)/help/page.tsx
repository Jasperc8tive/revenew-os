'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';

const QUICK_START_STEPS = [
  {
    step: 1,
    title: 'Connect your data',
    description:
      'Link your payment providers, CRM, and data sources through the Integrations page.',
  },
  {
    step: 2,
    title: 'Set up integrations',
    description:
      'Configure webhooks and API keys so Revenew can receive real-time events from your tools.',
  },
  {
    step: 3,
    title: 'Review your KPIs',
    description:
      'Visit the Dashboard to see your revenue, churn rate, LTV, and CAC populated automatically.',
  },
  {
    step: 4,
    title: 'Configure alerts',
    description:
      'Set threshold-based alerts for key metrics so you are notified when numbers move outside normal ranges.',
  },
  {
    step: 5,
    title: 'Invite team members',
    description:
      'Add colleagues with the appropriate role (Admin, Staff, or Viewer) from your organization settings.',
  },
];

const FAQ_ITEMS = [
  {
    question: 'How do I connect my payment provider?',
    answer:
      'Navigate to Integrations and click Connect Integration. Select your payment provider (Paystack, Flutterwave, or Stripe), then follow the on-screen steps to authorize the connection with your API keys.',
  },
  {
    question: 'How is my churn rate calculated?',
    answer:
      'Churn rate is calculated as the percentage of customers who did not make a purchase in the last 30 days relative to your total active customer base at the start of that period. The metric refreshes daily.',
  },
  {
    question: 'What does the Confidence Score mean?',
    answer:
      'The confidence score (0–100) reflects how reliable your analytics data is, based on factors including data volume, consistency, variance, anomaly frequency, and data freshness. A score below 60 may indicate gaps in your integration data.',
  },
  {
    question: 'How do I set up alerts?',
    answer:
      'Go to your dashboard overview and look for the Alerts section. Click "Create Rule", choose a metric (Revenue, CAC, LTV, or Churn), set your operator and threshold, and select notification channels.',
  },
  {
    question: 'Can I export my reports?',
    answer:
      'Yes, navigate to Reports and click Generate on any report type. Once the report is ready you will find a download option to export the data in CSV or PDF format.',
  },
];

export default function HelpPage() {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setContactForm({ name: '', email: '', message: '' });
    }, 3000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & Support"
        description="Documentation, guides, and customer support"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Help & Support' },
        ]}
      />

      {/* Quick Start Guide */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          Quick Start Guide
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Follow these steps to get up and running with Revenew.
        </p>

        <ol className="space-y-4">
          {QUICK_START_STEPS.map(({ step, title, description }) => (
            <li key={step} className="flex gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {step}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {title}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* FAQ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          Frequently Asked Questions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Answers to the most common questions.
        </p>

        <div className="space-y-2">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <details
              key={question}
              className="group rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors list-none [&::-webkit-details-marker]:hidden select-none">
                {question}
                <svg
                  className="flex-shrink-0 w-4 h-4 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-4 pb-4 pt-1">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Support Channels */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
          Support Channels
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Email Support */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex gap-4 items-start">
            <div className="flex-shrink-0 mt-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2.5">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Email Support
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
                Typical response time: 24 hours
              </p>
              <a
                href="mailto:support@revenew.ng"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                support@revenew.ng
              </a>
            </div>
          </div>

          {/* Documentation */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex gap-4 items-start">
            <div className="flex-shrink-0 mt-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
              <svg
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Documentation
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
                Guides, API references, and tutorials
              </p>
              <a
                href="https://docs.revenew.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
              >
                View Docs
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
          Send a Message
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Have a specific question or need hands-on help? Drop us a message.
        </p>

        <form onSubmit={handleContactSubmit} className="space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="contact-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              value={contactForm.name}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Your name"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label
              htmlFor="contact-email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={contactForm.email}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              rows={4}
              value={contactForm.message}
              onChange={(e) =>
                setContactForm((prev) => ({ ...prev, message: e.target.value }))
              }
              placeholder="Describe your issue or question..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition resize-none"
            />
          </div>

          <div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              {submitted ? (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Message Sent!
                </>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

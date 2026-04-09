/* eslint-env node */
/* global document, localStorage, HTMLAnchorElement */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import net from 'net';
import path from 'path';
import process from 'process';
import { setTimeout as sleep } from 'timers/promises';

const ROOT_DIR = process.cwd();
const ARTIFACT_ROOT = process.env.UI_CRAWL_ARTIFACT_DIR || path.join(ROOT_DIR, 'artifacts', 'ui-crawler');

const API_URL = process.env.UI_CRAWL_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.UI_CRAWL_WEB_URL || 'http://localhost:3002';
const AGENTS_URL = process.env.UI_CRAWL_AGENTS_URL || 'http://localhost:8000';
const MAX_PAGES = Number(process.env.UI_CRAWL_MAX_PAGES || 60);
const CLICK_LIMIT_PER_PAGE = Number(process.env.UI_CRAWL_MAX_CLICKS || 25);
const START_SERVICES = String(process.env.UI_CRAWL_START_SERVICES ?? '').trim() !== '0';
const HEADLESS = process.env.UI_CRAWL_HEADLESS !== '0';
const GATE_ENFORCED = process.env.UI_CRAWL_GATE_ENFORCE
  ? process.env.UI_CRAWL_GATE_ENFORCE !== '0'
  : process.env.CI === 'true';

const QA_GATE = {
  maxCritical: Number(process.env.UI_CRAWL_GATE_MAX_CRITICAL || 0),
  maxMedium: Number(process.env.UI_CRAWL_GATE_MAX_MEDIUM || 0),
  maxAiFailures: Number(process.env.UI_CRAWL_GATE_MAX_AI_FAILURES || 0),
  maxOutageFailures: Number(process.env.UI_CRAWL_GATE_MAX_OUTAGE_FAILURES || 0),
  maxContractFailures: Number(process.env.UI_CRAWL_GATE_MAX_CONTRACT_FAILURES || 0),
  maxActionableFindings: Number(process.env.UI_CRAWL_GATE_MAX_ACTIONABLE || 20),
  minPagesTested: Number(process.env.UI_CRAWL_GATE_MIN_PAGES || 10),
};

const PERFORMANCE_TARGETS_MS = {
  dashboard: 2000,
  analytics: 3000,
};

const CHART_ROUTES = new Set([
  '/dashboard',
  '/dashboard/benchmarking',
  '/dashboard/forecasting',
  '/dashboard/command-center',
  '/dashboard/competitive',
]);

const BASE_INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [aria-haspopup="menu"], summary, [data-testid], input[type="submit"]';

const COPILOT_PROMPT_SELECTOR = 'textarea[placeholder*="Ask Growth Copilot"]';
const COPILOT_SEND_SELECTOR = 'form button[type="submit"]';
const COMPETITIVE_AI_BRIEF_TAB_SELECTOR = 'button:has-text("AI Brief")';
const COMPETITIVE_GENERATE_BRIEF_SELECTOR = 'button:has-text("Generate Brief")';

const ACTIONABLE_EXCLUDED_TYPES = new Set([
  'request-aborted',
  'resource-forbidden',
  'no-op-click',
  'asset-request-failed',
  'rsc-fallback-recovered',
]);

const EXPECTED_ROUTES = [
  '/login?next=%2Fdashboard',
  '/register?next=%2Fdashboard',
  '/dashboard',
  '/dashboard/benchmarking',
  '/dashboard/experiments',
  '/dashboard/forcasting', // intentional typo trap from spec; auto-corrected below
  '/dashboard/help',
  '/dashboard/messages',
  '/dashboard/orders',
  '/dashboard/verification',
  '/dashboard/command-center',
  '/dashboard/competitive',
  '/dashboard/copilot',
  '/dashboard/customers',
  '/dashboard/analytics',
  '/dashboard/acquisition',
  '/dashboard/pipeline',
  '/dashboard/retention',
  '/dashboard/pricing',
  '/dashboard/agents',
  '/dashboard/recommendations',
  '/dashboard/integrations',
  '/dashboard/reports',
  '/dashboard/billing',
  '/dashboard/settings',
];

const AUTO_FIXES = [];

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function normalizeExpectedRoutes() {
  return EXPECTED_ROUTES.map((route) => {
    if (route === '/dashboard/forcasting') {
      AUTO_FIXES.push({
        type: 'route-typo-normalization',
        from: route,
        to: '/dashboard/forecasting',
        severity: 'minor',
      });
      return '/dashboard/forecasting';
    }
    return route;
  });
}

function runProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || ROOT_DIR,
    env: options.env || process.env,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });

  const name = options.name || command;
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data.toString()}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data.toString()}`));
  return child;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function canConnectTcp(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('timeout', () => finalize(false));
    socket.once('error', () => finalize(false));
    socket.connect(port, host);
  });
}

async function isHttpReachable(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForHttp(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isHttpReachable(url)) {
      return;
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForTcp(host, port, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canConnectTcp(host, port)) {
      return;
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for TCP ${host}:${port}`);
}

function sanitizeFileName(input) {
  return input.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 140) || 'root';
}

function sameOrigin(target, origin) {
  try {
    const url = new URL(target, origin);
    return url.origin === origin;
  } catch {
    return false;
  }
}

function toRouteKey(targetUrl) {
  const url = new URL(targetUrl);
  return `${url.pathname}${url.search}`;
}

function isLikelyAssetOrExternalNoise(url) {
  return (
    url.includes('fonts.gstatic.com') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('/_next/static/') ||
    url.includes('/_next/webpack-hmr')
  );
}

async function clearAuthSessionState(page, origin) {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem('revenew.auth.session');
    document.cookie = 'revenew.auth=; Path=/; Max-Age=0; SameSite=Lax';
  });
}

function severityForIssue(issue) {
  if (issue.type === 'route-404' || issue.type === 'pageerror' || issue.type === 'failed-request-5xx') {
    return 'critical';
  }
  if (issue.type === 'console-error' || issue.type === 'failed-request' || issue.type === 'blank-page' || issue.type === 'slow-page') {
    return 'medium';
  }
  return 'minor';
}

function summarizeIssues(issues) {
  const grouped = { critical: 0, medium: 0, minor: 0 };
  for (const issue of issues) {
    grouped[severityForIssue(issue)] += 1;
  }
  return grouped;
}

function compactText(value, max = 220) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function summarizeActionableIssues(issues, limit = 20) {
  const buckets = new Map();

  for (const issue of issues) {
    if (ACTIONABLE_EXCLUDED_TYPES.has(issue.type)) continue;

    const route = issue.route || issue.url || issue.scenario || '';
    const detail = compactText(issue.detail || issue.text || issue.error || issue.target || '', 180);
    const key = `${issue.type}|${route}|${detail}`;

    if (!buckets.has(key)) {
      buckets.set(key, { type: issue.type, route, detail, count: 0 });
    }
    buckets.get(key).count += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.type.localeCompare(b.type);
    })
    .slice(0, limit);
}

function evaluateQaGate(report) {
  const aiFailures = report.aiChecks.filter((check) => !check.ok).length;
  const outageFailures = report.outageChecks.filter((check) => !check.graceful).length;
  const contractFailures = report.contractChecks.filter((check) => !check.ok).length;
  const actionableFindings = report.actionableIssues.length;
  const pagesTested = report.coverage.pagesTested;

  const checks = [
    {
      key: 'critical',
      actual: report.issuesSummary.critical,
      threshold: QA_GATE.maxCritical,
      ok: report.issuesSummary.critical <= QA_GATE.maxCritical,
    },
    {
      key: 'medium',
      actual: report.issuesSummary.medium,
      threshold: QA_GATE.maxMedium,
      ok: report.issuesSummary.medium <= QA_GATE.maxMedium,
    },
    {
      key: 'ai-failures',
      actual: aiFailures,
      threshold: QA_GATE.maxAiFailures,
      ok: aiFailures <= QA_GATE.maxAiFailures,
    },
    {
      key: 'outage-fallback-failures',
      actual: outageFailures,
      threshold: QA_GATE.maxOutageFailures,
      ok: outageFailures <= QA_GATE.maxOutageFailures,
    },
    {
      key: 'contract-lite-failures',
      actual: contractFailures,
      threshold: QA_GATE.maxContractFailures,
      ok: contractFailures <= QA_GATE.maxContractFailures,
    },
    {
      key: 'actionable-findings',
      actual: actionableFindings,
      threshold: QA_GATE.maxActionableFindings,
      ok: actionableFindings <= QA_GATE.maxActionableFindings,
    },
    {
      key: 'pages-tested',
      actual: pagesTested,
      threshold: QA_GATE.minPagesTested,
      ok: pagesTested >= QA_GATE.minPagesTested,
      comparator: '>=',
    },
  ];

  const failures = checks.filter((check) => !check.ok).map((check) => {
    const comparator = check.comparator || '<=';
    return `${check.key}: actual=${check.actual} required ${comparator} ${check.threshold}`;
  });

  return {
    enforced: GATE_ENFORCED,
    passed: failures.length === 0,
    checks,
    failures,
  };
}

async function detectBlankPage(page) {
  return page.evaluate(() => {
    const body = document.body;
    if (!body) return true;

    const text = (body.innerText || '').replace(/\s+/g, ' ').trim();
    const hasExpectedTransientState = /loading|redirecting|sign in|create account/i.test(text);
    const hasRenderableNodes = body.querySelectorAll('*').length > 5;
    const hasVisibleText = text.length > 20;

    if (hasExpectedTransientState) {
      return false;
    }

    return !hasRenderableNodes || !hasVisibleText;
  });
}

async function collectForms(page) {
  return page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.map((form, index) => {
      const controls = Array.from(form.querySelectorAll('input, select, textarea, button'));
      const fields = controls.map((control) => {
        const el = control;
        return {
          tag: el.tagName.toLowerCase(),
          type: (el.getAttribute('type') || '').toLowerCase(),
          name: el.getAttribute('name') || '',
          id: el.id || '',
          required: el.hasAttribute('required'),
        };
      });

      return {
        id: form.id || `form-${index}`,
        method: form.getAttribute('method') || 'get',
        action: form.getAttribute('action') || '',
        fields,
      };
    });
  });
}

async function evaluateAccessibility(page) {
  return page.evaluate(() => {
    const toDescriptor = (el) => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
      const placeholder = el.getAttribute('placeholder') ? `[placeholder="${el.getAttribute('placeholder')}"]` : '';
      return `${tag}${id}${name}${placeholder}`;
    };

    const unlabeledButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
      const text = (button.textContent || '').trim();
      const aria = button.getAttribute('aria-label');
      return !text && !aria;
    });

    const unlabeledInputs = Array.from(document.querySelectorAll('input, select, textarea')).filter((input) => {
      const el = input;
      const id = el.id;
      const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
      if (aria) return false;
      if (!id) return true;
      return !document.querySelector(`label[for="${id}"]`);
    });

    return {
      unlabeledButtons: unlabeledButtons.length,
      unlabeledInputs: unlabeledInputs.length,
      unlabeledButtonSamples: unlabeledButtons.slice(0, 3).map((el) => toDescriptor(el)),
      unlabeledInputSamples: unlabeledInputs.slice(0, 3).map((el) => toDescriptor(el)),
    };
  });
}

async function evaluateKeyboardNavigation(page) {
  const focusTrail = [];
  const meaningfulFocusTrail = [];
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    const currentFocus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { descriptor: 'none', meaningful: false };
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';

      const descriptor = `${tag}${id}${name}`;
      const focusableSelector =
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
      const rect = el.getBoundingClientRect();
      const style = document.defaultView?.getComputedStyle(el);
      const isVisible =
        rect.width > 0 && rect.height > 0 && Boolean(style) && style.display !== 'none' && style.visibility !== 'hidden';
      const isSuppressed =
        Boolean(el.closest('[inert], [aria-hidden="true"], [hidden]')) || tag === 'body' || tag === 'html';
      const isMeaningful = isVisible && !isSuppressed && el.matches(focusableSelector);

      return { descriptor, meaningful: isMeaningful };
    });
    focusTrail.push(currentFocus.descriptor);
    if (currentFocus.meaningful) {
      meaningfulFocusTrail.push(currentFocus.descriptor);
    }
  }

  const uniqueMeaningful = new Set(meaningfulFocusTrail);
  return {
    focusTrail,
    meaningfulFocusTrail,
    meaningfulSteps: meaningfulFocusTrail.length,
    moved: meaningfulFocusTrail.length < 2 ? true : uniqueMeaningful.size > 1,
  };
}

async function evaluateChartRendering(page) {
  return page.evaluate(() => {
    const chartCandidates = document.querySelectorAll(
      'svg.recharts-surface, canvas, .recharts-wrapper, [class*="chart"], [data-testid*="chart"]',
    );
    const visibleCharts = Array.from(chartCandidates).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 16 && rect.height > 16;
    }).length;

    return {
      totalChartNodes: chartCandidates.length,
      visibleCharts,
    };
  });
}

async function extractInteractiveTargets(page) {
  return page.evaluate((selector) => {
    const escapeCss = (value) => value.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');

    const toCssPath = (element) => {
      if (element.id) {
        return `${element.tagName.toLowerCase()}#${escapeCss(element.id)}`;
      }

      const parts = [];
      let el = element;
      while (el && el.nodeType === 1 && el !== document.body) {
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter((child) => child.tagName === el.tagName);
        const index = siblings.indexOf(el) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
        el = parent;
      }
      return `body > ${parts.join(' > ')}`;
    };

    const interactive = Array.from(document.querySelectorAll(selector));

    return interactive.map((element, visibleIdx) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const tag = element.tagName.toLowerCase();
      const href = element instanceof HTMLAnchorElement ? element.href : '';
      return {
        visibleIdx,
        tag,
        text: text.slice(0, 120),
        href,
        ariaCurrent: element.getAttribute('aria-current') || '',
        cssPath: toCssPath(element),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }).filter(Boolean);
  }, BASE_INTERACTIVE_SELECTOR);
}

async function extractLinks(page, origin) {
  return page.evaluate((baseOrigin) => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href') || '')
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, baseOrigin).toString();
        } catch {
          return null;
        }
      })
      .filter((href) => Boolean(href));

    return links;
  }, origin);
}

async function seedAuthSession(page, webUrl) {
  await page.goto(`${webUrl}/login?next=%2Fdashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await page.evaluate(() => {
    const session = {
      userId: 'ui-crawler-user',
      email: 'qa-crawler@revenew.local',
      organizationId: 'org-local',
      accessToken: 'qa-crawler-token',
      expiresAt: Date.now() + 1000 * 60 * 60,
    };

    localStorage.setItem('revenew.auth.session', JSON.stringify(session));

    const payload = btoa(JSON.stringify({
      userId: session.userId,
      email: session.email,
      organizationId: session.organizationId,
    }));

    document.cookie = `revenew.auth=${encodeURIComponent(payload)}; Path=/; Max-Age=${60 * 60}; SameSite=Lax`;
  });
}

async function brokenLinkAudit(origin, links) {
  const results = [];
  const uniqueLinks = Array.from(new Set(links));

  for (const target of uniqueLinks) {
    try {
      const response = await fetch(target, { method: 'GET', redirect: 'manual' });
      results.push({ url: target, status: response.status });
    } catch (error) {
      results.push({ url: target, status: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results
    .filter((entry) => {
      if (!sameOrigin(entry.url, origin)) return false;
      return entry.status >= 400 || entry.status === 0;
    })
    .map((entry) => ({
      ...entry,
      type: 'broken-link',
    }));
}

async function runAiProbes(page, origin, screenshotsDir) {
  const aiResults = [];

  try {
    await seedAuthSession(page, WEB_URL);
  } catch {
    // Continue probe execution; failures are captured by probe-level handlers.
  }

  try {
    await page.goto(`${origin}/dashboard/copilot`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);

    const textarea = page.locator(COPILOT_PROMPT_SELECTOR).first();
    const submitBtn = page.locator(COPILOT_SEND_SELECTOR).first();

    if ((await textarea.count()) > 0 && (await submitBtn.count()) > 0) {
      const before = await page.locator('text=Copilot').count();
      await textarea.fill('Give me 3 growth actions with confidence and supporting evidence.');
      await submitBtn.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      const after = await page.locator('text=Copilot').count();
      aiResults.push({
        feature: 'copilot',
        ok: after >= before,
        detail: `controls found (${COPILOT_PROMPT_SELECTOR}, ${COPILOT_SEND_SELECTOR}); messages before=${before}, after=${after}`,
      });
    } else {
      const copilotGateVisible = (await page.getByText(/sign in to use growth copilot/i).count()) > 0;
      const bodyText = (await page.locator('body').innerText()).slice(0, 4000);
      const gated =
        copilotGateVisible || /sign in|active subscription required|enterprise plan required|forbidden|unauthorized/i.test(bodyText);
      aiResults.push({
        feature: 'copilot',
        ok: gated,
        detail: gated
          ? 'copilot controls gated by auth/plan'
          : `copilot controls missing selectors (${COPILOT_PROMPT_SELECTOR}, ${COPILOT_SEND_SELECTOR})`,
      });
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'ai_copilot_probe.png'), fullPage: true });
  } catch (error) {
    aiResults.push({
      feature: 'copilot',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    await page.goto(`${origin}/dashboard/competitive`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(600);

    const briefTab = page.locator(COMPETITIVE_AI_BRIEF_TAB_SELECTOR).first();
    if ((await briefTab.count()) > 0) {
      await briefTab.click({ timeout: 5000 });
      await page.waitForTimeout(400);
    }

    const briefButton = page.locator(COMPETITIVE_GENERATE_BRIEF_SELECTOR).first();
    if ((await briefButton.count()) > 0) {
      await briefButton.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      const bodyText = (await page.locator('body').innerText()).slice(0, 5000);
      const structured = /confidence|evidence|brief|summary|signal/i.test(bodyText);
      aiResults.push({
        feature: 'competitive-brief',
        ok: structured,
        detail: structured
          ? `brief trigger found (${COMPETITIVE_GENERATE_BRIEF_SELECTOR}) and structured content detected`
          : `brief trigger found (${COMPETITIVE_GENERATE_BRIEF_SELECTOR}) but no structured brief signals detected`,
      });
    } else {
      const competitiveGateVisible = (await page.getByText(/sign in to access competitive intelligence/i).count()) > 0;
      const bodyText = (await page.locator('body').innerText()).slice(0, 4000);
      const gated =
        competitiveGateVisible || /sign in|active subscription required|enterprise plan required|forbidden|unauthorized/i.test(bodyText);
      aiResults.push({
        feature: 'competitive-brief',
        ok: gated,
        detail: gated
          ? 'competitive brief gated by auth/plan'
          : `brief trigger selector missing (${COMPETITIVE_GENERATE_BRIEF_SELECTOR})`,
      });
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'ai_competitive_probe.png'), fullPage: true });
  } catch (error) {
    aiResults.push({
      feature: 'competitive-brief',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return aiResults;
}

async function runOutageProbe(context, origin, hooks = {}) {
  const setCapture = hooks.setCapture || (() => {});
  const page = await context.newPage();
  const apiOrigin = new URL(API_URL).origin;
  const results = [];

  setCapture(false);
  await context.route(`${apiOrigin}/**`, (route) => route.abort());
  try {
    let graceful = false;
    let detail = 'no graceful fallback copy detected';

    try {
      await page.goto(`${origin}/dashboard/forecasting`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1500);
      const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 3000));
      graceful = /loading|unable|unavailable|error|failed|sign in|active subscription/i.test(text);
      detail = graceful ? 'graceful fallback/error copy detected' : detail;
    } catch (error) {
      detail = `navigation failed during outage probe: ${error instanceof Error ? error.message : String(error)}`;
    }

    results.push({
      scenario: 'api-offline-forecasting',
      graceful,
      detail,
    });
  } finally {
    await context.unroute(`${apiOrigin}/**`);
    setCapture(true);
  }

  // Simulate copilot/agent unavailability by aborting copilot-related API calls.
  const copilotBlocker = (route) => {
    const request = route.request();
    const requestUrl = request.url();
    const resourceType = request.resourceType();
    const isCopilotApiCall = (resourceType === 'xhr' || resourceType === 'fetch') && /\/(api\/)?copilot\b/i.test(requestUrl);
    if (isCopilotApiCall) {
      return route.abort();
    }
    return route.continue();
  };

  setCapture(false);
  await context.route('**/*', copilotBlocker);
  try {
    let graceful = false;
    let detail = 'copilot fallback copy not detected';

    try {
      await page.goto(`${origin}/dashboard/copilot`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);

      const input = page.locator('textarea').first();
      const submit = page.getByRole('button', { name: /send/i }).first();

      if ((await input.count()) > 0 && (await submit.count()) > 0) {
        await input.fill('Trigger outage check for copilot service');
        await submit.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
      }

      const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000));
      graceful = /failed|unable|error|try again|unavailable/i.test(text);
      detail = graceful ? 'copilot error/fallback message detected' : detail;
    } catch (error) {
      detail = `copilot outage probe navigation failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    results.push({
      scenario: 'agents-unavailable-copilot',
      graceful,
      detail,
    });
  } finally {
    await context.unroute('**/*', copilotBlocker);
    setCapture(true);
    await page.close();
  }

  return results;
}

async function runAuthFormSubmissionChecks(page, origin, screenshotsDir) {
  const checks = [];
  await clearAuthSessionState(page, origin);

  // Login invalid path.
  try {
    await page.goto(`${origin}/login?next=%2Fdashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(300);

    const submit = page.getByRole('button', { name: /sign in|login/i }).first();
    if ((await submit.count()) > 0) {
      await submit.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 3000));
      const hasNativeValidation = await page.evaluate(() => {
        const email = document.querySelector('input[type="email"]');
        const password = document.querySelector('input[type="password"]');
        const emailMissing = Boolean(email && typeof email.checkValidity === 'function' && !email.checkValidity());
        const passwordMissing = Boolean(password && typeof password.checkValidity === 'function' && !password.checkValidity());
        return emailMissing || passwordMissing;
      });
      const hasValidation = hasNativeValidation || /enter both email and password|required|invalid/i.test(text);
      checks.push({
        form: 'login',
        scenario: 'invalid-empty-submit',
        ok: hasValidation,
        detail: hasValidation ? 'validation path detected (native or custom)' : 'validation message not detected',
      });
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'form_login_invalid.png'), fullPage: true });
  } catch (error) {
    checks.push({
      form: 'login',
      scenario: 'invalid-empty-submit',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Login valid-format submission should either redirect or return visible error.
  try {
    await page.goto(`${origin}/login?next=%2Fdashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('input[type="email"]', 'qa-crawler@revenew.local');
    await page.fill('input[type="password"]', 'ValidPass123!');
    const submit = page.getByRole('button', { name: /sign in|login/i }).first();

    const loginRequestPromise = page
      .waitForResponse((resp) => /\/auth\/login|\/login(\?|$)/.test(resp.url()), { timeout: 3500 })
      .then((resp) => ({ seen: true, status: resp.status() }))
      .catch(() => ({ seen: false, status: 0 }));

    await submit.click({ timeout: 5000 });
    await page.waitForTimeout(1800);

    const currentUrl = page.url();
    const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 3000));
    const requestInfo = await loginRequestPromise;
    const handled =
      currentUrl.includes('/dashboard') ||
      /unable|invalid|error|incorrect|failed/i.test(text) ||
      requestInfo.seen;
    checks.push({
      form: 'login',
      scenario: 'valid-format-submit',
      ok: handled,
      detail: handled
        ? `handled path observed at ${currentUrl}; loginRequestSeen=${requestInfo.seen}; status=${requestInfo.status}`
        : 'no success/error handling detected',
    });

    await page.screenshot({ path: path.join(screenshotsDir, 'form_login_valid_format.png'), fullPage: true });
  } catch (error) {
    checks.push({
      form: 'login',
      scenario: 'valid-format-submit',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  // Register invalid path.
  try {
    await page.goto(`${origin}/register?next=%2Fdashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(300);

    const submit = page.getByRole('button', { name: /create account|register|create workspace/i }).first();
    if ((await submit.count()) > 0) {
      await submit.click({ timeout: 5000 });
      await page.waitForTimeout(400);
      const text = await page.evaluate(() => (document.body?.innerText || '').slice(0, 3000));
      const hasValidation = /required|valid email|password|organization/i.test(text);
      checks.push({
        form: 'register',
        scenario: 'invalid-empty-submit',
        ok: hasValidation,
        detail: hasValidation ? 'validation message detected' : 'validation message not detected',
      });
    }

    await page.screenshot({ path: path.join(screenshotsDir, 'form_register_invalid.png'), fullPage: true });
  } catch (error) {
    checks.push({
      form: 'register',
      scenario: 'invalid-empty-submit',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return checks;
}

async function runContractLiteChecks() {
  const checks = [];
  const candidates = [
    { url: `${AGENTS_URL}/health`, expectJson: true, requiredKeys: ['status'], acceptedStatuses: [200] },
    { url: `${AGENTS_URL}/`, expectJson: true, acceptedStatuses: [200] },
    { url: `${API_URL}/integrations`, expectJson: false, acceptedStatuses: [200, 401, 403] },
    { url: `${WEB_URL}/api/dashboard/metrics?organizationId=org-local`, expectJson: true, acceptedStatuses: [200, 401, 403] },
    { url: `${WEB_URL}/api/dashboard/insights?organizationId=org-local`, expectJson: true, acceptedStatuses: [200, 401, 403] },
    { url: `${WEB_URL}/api/dashboard/charts?organizationId=org-local`, expectJson: true, acceptedStatuses: [200, 401, 403] },
  ];

  for (const candidate of candidates) {
    const { url, expectJson, requiredKeys = [], acceptedStatuses = [200] } = candidate;
    try {
      const response = await fetch(url, { method: 'GET' });
      const contentType = response.headers.get('content-type') || '';
      let isObject = false;
      let hasRequiredKeys = requiredKeys.length === 0;
      if (contentType.includes('application/json')) {
        const data = await response.json();
        isObject = typeof data === 'object' && data !== null;
        if (isObject && requiredKeys.length > 0) {
          hasRequiredKeys = requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(data, key));
        }
      }

      checks.push({
        url,
        status: response.status,
        ok:
          acceptedStatuses.includes(response.status) &&
          (!expectJson || (contentType.includes('application/json') && isObject)) &&
          hasRequiredKeys,
      });
    } catch (error) {
      checks.push({
        url,
        status: 0,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return checks;
}

async function runCrawler(playwright) {
  const artifactsDir = path.join(ARTIFACT_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
  const screenshotsDir = path.join(artifactsDir, 'screenshots');
  await ensureDir(screenshotsDir);

  const browser = await playwright.chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  const origin = new URL(WEB_URL).origin;
  const expectedRoutes = normalizeExpectedRoutes();

  const queue = [...expectedRoutes.map((route) => `${origin}${route}`)];
  const visited = new Set();

  const pages = [];
  const interactions = [];
  const forms = [];
  const issues = [];
  const chartChecks = [];
  const keyboardChecks = [];
  const formSubmissionChecks = [];
  const linksSeen = new Set();
  const requestLedger = [];
  let suppressNetworkIssueCapture = false;

  page.on('console', (msg) => {
    const text = msg.text();
    const route = toRouteKey(page.url()) || page.url();
    if (msg.type() === 'error') {
      if (/Warning: Extra attributes from the server/i.test(text)) {
        issues.push({ type: 'hydration-warning', text: compactText(text), route });
        return;
      }
      if (/Failed to fetch RSC payload .* Falling back to browser navigation/i.test(text)) {
        issues.push({ type: 'rsc-fallback-recovered', text: compactText(text), route });
        return;
      }
      if (/Failed to load resource:.*(401|403)/i.test(text)) {
        issues.push({ type: 'resource-forbidden', text: compactText(text), route });
        return;
      }
      issues.push({ type: 'console-error', text: compactText(text), route });
    }
  });

  page.on('pageerror', (err) => {
    issues.push({ type: 'pageerror', text: err.message, route: page.url() });
  });

  page.on('requestfailed', (request) => {
    const failedUrl = request.url();
    const failureText = request.failure()?.errorText || 'request-failed';
    requestLedger.push({
      route: page.url(),
      url: failedUrl,
      method: request.method(),
      status: 0,
      error: failureText,
      suppressed: suppressNetworkIssueCapture,
    });

    if (suppressNetworkIssueCapture) {
      return;
    }

    if (isLikelyAssetOrExternalNoise(failedUrl)) {
      issues.push({ type: 'asset-request-failed', url: failedUrl, route: page.url() });
      return;
    }

    if (/ERR_ABORTED/i.test(failureText)) {
      issues.push({ type: 'request-aborted', url: failedUrl, route: page.url() });
      return;
    }

    issues.push({ type: 'failed-request', url: failedUrl, route: page.url() });
  });

  page.on('response', (response) => {
    const status = response.status();
    const responseUrl = response.url();
    requestLedger.push({
      route: page.url(),
      url: responseUrl,
      method: response.request().method(),
      status,
      suppressed: suppressNetworkIssueCapture,
    });

    if (suppressNetworkIssueCapture) {
      return;
    }

    if (status >= 500) {
      issues.push({ type: 'failed-request-5xx', url: responseUrl, status, route: page.url() });
    }
  });

  // Capture auth forms in unauthenticated state before session seeding.
  for (const authRoute of ['/login?next=%2Fdashboard', '/register?next=%2Fdashboard']) {
    const authUrl = `${origin}${authRoute}`;
    try {
      await context.clearCookies();
      await clearAuthSessionState(page, origin);
      await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(300);

      const authForms = await collectForms(page);
      forms.push(...authForms.map((form) => ({ ...form, route: authRoute, source: 'pre-auth' })));

      const screenshotPath = path.join(screenshotsDir, `${sanitizeFileName(`preauth_${authRoute}`)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      if (authForms.length === 0) {
        issues.push({ type: 'missing-auth-form', route: authRoute });
      }
    } catch (error) {
      issues.push({
        type: 'auth-form-check-failure',
        route: authRoute,
        text: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const authFormChecks = await runAuthFormSubmissionChecks(page, origin, screenshotsDir);
  formSubmissionChecks.push(...authFormChecks);
  for (const check of authFormChecks) {
    if (!check.ok) {
      issues.push({ type: 'form-submit-check-failure', form: check.form, scenario: check.scenario, detail: check.detail });
    }
  }

  await seedAuthSession(page, WEB_URL);

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const nextUrl = queue.shift();
    if (!nextUrl) break;

    const routeKey = toRouteKey(nextUrl);
    if (visited.has(routeKey)) {
      continue;
    }
    visited.add(routeKey);

    const started = Date.now();
    let pageLoadOk = true;

    try {
      await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(500);
    } catch (error) {
      pageLoadOk = false;
      issues.push({
        type: 'navigation-failure',
        route: routeKey,
        text: error instanceof Error ? error.message : String(error),
      });
    }

    const durationMs = Date.now() - started;
    const status = pageLoadOk ? 200 : 0;

    if (routeKey === '/dashboard' && durationMs > PERFORMANCE_TARGETS_MS.dashboard) {
      issues.push({ type: 'slow-page', route: routeKey, durationMs, targetMs: PERFORMANCE_TARGETS_MS.dashboard });
    }
    if (routeKey.includes('/dashboard/analytics') && durationMs > PERFORMANCE_TARGETS_MS.analytics) {
      issues.push({ type: 'slow-page', route: routeKey, durationMs, targetMs: PERFORMANCE_TARGETS_MS.analytics });
    }

    if (pageLoadOk) {
      const bodyText = await page.evaluate(() => (document.body?.innerText || '').trim());
      if (/\b404\b|Page not found/i.test(bodyText)) {
        issues.push({ type: 'route-404', route: routeKey });
      }

      const blank = await detectBlankPage(page);
      if (blank) {
        issues.push({ type: 'blank-page', route: routeKey });
      }

      const screenshotPath = path.join(screenshotsDir, `${sanitizeFileName(routeKey)}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      const discoveredLinks = await extractLinks(page, origin);
      for (const link of discoveredLinks) {
        if (!sameOrigin(link, origin)) continue;
        linksSeen.add(link);
        const linkKey = toRouteKey(link);
        if (!visited.has(linkKey)) {
          queue.push(link);
        }
      }

      const pageForms = await collectForms(page);
      forms.push(...pageForms.map((form) => ({ ...form, route: routeKey })));

      const keyboard = await evaluateKeyboardNavigation(page);
      keyboardChecks.push({ route: routeKey, ...keyboard });
      if (!keyboard.moved && keyboard.meaningfulSteps >= 2) {
        issues.push({ type: 'keyboard-nav-stuck', route: routeKey });
      }

      const a11y = await evaluateAccessibility(page);
      if (a11y.unlabeledButtons > 0) {
        issues.push({
          type: 'a11y-unlabeled-buttons',
          route: routeKey,
          count: a11y.unlabeledButtons,
          detail: `samples: ${a11y.unlabeledButtonSamples.join(', ') || 'none'}`,
        });
      }
      if (a11y.unlabeledInputs > 0) {
        issues.push({
          type: 'a11y-unlabeled-inputs',
          route: routeKey,
          count: a11y.unlabeledInputs,
          detail: `samples: ${a11y.unlabeledInputSamples.join(', ') || 'none'}`,
        });
      }

      if (CHART_ROUTES.has(routeKey)) {
        const chartState = await evaluateChartRendering(page);
        chartChecks.push({ route: routeKey, ...chartState });
        if (chartState.totalChartNodes > 0 && chartState.visibleCharts === 0) {
          issues.push({ type: 'chart-render-failure', route: routeKey, totalChartNodes: chartState.totalChartNodes });
        }
      }

      const targets = await extractInteractiveTargets(page);
      for (const target of targets.slice(0, CLICK_LIMIT_PER_PAGE)) {
        if (target.tag === 'a' && target.ariaCurrent === 'page') {
          continue;
        }

        const interaction = {
          route: routeKey,
          target,
          result: 'unknown',
        };

        try {
          const beforeUrl = page.url();
          const beforeLength = await page.evaluate(() => (document.body?.innerText || '').length);

          const locator = page.locator(target.cssPath).first();
          await locator.click({ timeout: 3000, force: false });
          await page.waitForTimeout(250);

          const afterUrl = page.url();
          const afterLength = await page.evaluate(() => (document.body?.innerText || '').length);

          if (afterUrl !== beforeUrl) {
            interaction.result = 'navigation-change';
          } else if (afterLength !== beforeLength) {
            interaction.result = 'dom-change';
          } else {
            interaction.result = 'no-observable-change';
            issues.push({
              type: 'no-op-click',
              route: routeKey,
              target: target.text || `${target.tag}#${target.idx}`,
            });
          }
        } catch (error) {
          interaction.result = 'click-error';
          interaction.error = error instanceof Error ? error.message : String(error);
          issues.push({
            type: 'click-failure',
            route: routeKey,
            target: target.text || `${target.tag}#${target.idx}`,
            text: interaction.error,
          });
        }

        interactions.push(interaction);
      }
    }

    pages.push({
      route: routeKey,
      status,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  const brokenLinks = await brokenLinkAudit(origin, Array.from(linksSeen));
  issues.push(...brokenLinks);

  let aiChecks = [];
  try {
    aiChecks = await runAiProbes(page, origin, screenshotsDir);
  } catch (error) {
    aiChecks = [{
      feature: 'ai-probe-runner',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }];
  }
  for (const check of aiChecks) {
    if (!check.ok) {
      issues.push({ type: 'ai-check-failure', feature: check.feature, detail: check.detail });
    }
  }

  let outageChecks = [];
  try {
    outageChecks = await runOutageProbe(context, origin, {
      setCapture: (enabled) => {
        suppressNetworkIssueCapture = !enabled;
      },
    });
  } catch (error) {
    outageChecks = [{
      scenario: 'outage-probe-runner',
      graceful: false,
      detail: error instanceof Error ? error.message : String(error),
    }];
  }
  for (const check of outageChecks) {
    if (!check.graceful) {
      issues.push({ type: 'outage-fallback-failure', scenario: check.scenario, detail: check.detail });
    }
  }

  let contractChecks = [];
  try {
    contractChecks = await runContractLiteChecks();
  } catch (error) {
    contractChecks = [{
      url: 'contract-check-runner',
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }];
  }
  for (const check of contractChecks) {
    if (!check.ok) {
      issues.push({
        type: 'api-contract-lite-failure',
        url: check.url,
        status: check.status,
        error: check.error,
        detail: check.error ? check.error : `unexpected status ${check.status}`,
      });
    }
  }

  const actionableIssues = summarizeActionableIssues(issues, 20);

  const responseByRoute = requestLedger.reduce((acc, row) => {
    const key = row.route || 'unknown';
    acc[key] = acc[key] || { total: 0, failed: 0, serverErrors: 0 };
    acc[key].total += 1;
    if (row.status === 0 || row.status >= 400) acc[key].failed += 1;
    if (row.status >= 500) acc[key].serverErrors += 1;
    return acc;
  }, {});

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      baseUrl: WEB_URL,
      apiUrl: API_URL,
      agentsUrl: AGENTS_URL,
      maxPages: MAX_PAGES,
      clickLimitPerPage: CLICK_LIMIT_PER_PAGE,
      startServices: START_SERVICES,
      headless: HEADLESS,
    },
    coverage: {
      pagesTested: pages.length,
      buttonsTested: interactions.length,
      formsTested: forms.length,
      discoveredLinks: linksSeen.size,
    },
    performance: pages.map((p) => ({ route: p.route, durationMs: p.durationMs })),
    requests: {
      total: requestLedger.length,
      failed: requestLedger.filter((row) => row.status === 0 || row.status >= 400).length,
      serverErrors: requestLedger.filter((row) => row.status >= 500).length,
      byRoute: responseByRoute,
    },
    aiChecks,
    outageChecks,
    contractChecks,
    chartChecks,
    keyboardChecks,
    formSubmissionChecks,
    actionableIssues,
    issuesSummary: summarizeIssues(issues),
    issues,
    pages,
    interactions,
    forms,
    autoFixesApplied: AUTO_FIXES,
    qaGate: null,
    artifacts: {
      root: artifactsDir,
      screenshotsDir,
    },
  };

  report.qaGate = evaluateQaGate(report);

  await fs.writeFile(path.join(artifactsDir, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8');

  const textReport = [
    '# Revenew UI Crawler Report',
    '',
    `Generated: ${report.metadata.generatedAt}`,
    `Base URL: ${WEB_URL}`,
    '',
    '## Coverage',
    `- Pages tested: ${report.coverage.pagesTested}`,
    `- Buttons tested: ${report.coverage.buttonsTested}`,
    `- Forms tested: ${report.coverage.formsTested}`,
    `- Links discovered: ${report.coverage.discoveredLinks}`,
    '',
    '## API / Runtime',
    `- Requests observed: ${report.requests.total}`,
    `- Failed requests: ${report.requests.failed}`,
    `- 5xx requests: ${report.requests.serverErrors}`,
    '',
    '## Issues by Severity',
    `- Critical: ${report.issuesSummary.critical}`,
    `- Medium: ${report.issuesSummary.medium}`,
    `- Minor: ${report.issuesSummary.minor}`,
    '',
    '## Top Actionable Findings',
    ...(report.actionableIssues.length > 0
      ? report.actionableIssues.map((item, idx) =>
          `${idx + 1}. [${item.type}] x${item.count} | route=${item.route || '(global)'} | detail=${item.detail || '(none)'}`,
        )
      : ['- None']),
    '',
    '## QA Gate',
    `- Enforced: ${report.qaGate.enforced}`,
    `- Passed: ${report.qaGate.passed}`,
    ...report.qaGate.checks.map((check) => {
      const comparator = check.comparator || '<=';
      return `- ${check.key}: actual=${check.actual}, target ${comparator} ${check.threshold}, ok=${check.ok}`;
    }),
    ...(report.qaGate.failures.length > 0 ? ['- Failures:'] : ['- Failures: none']),
    ...report.qaGate.failures.map((line) => `  - ${line}`),
    '',
    '## Auto-fixes Applied',
    ...(AUTO_FIXES.length > 0 ? AUTO_FIXES.map((f) => `- ${f.type}: ${f.from} -> ${f.to}`) : ['- None']),
    '',
    `Detailed JSON: ${path.join(artifactsDir, 'qa-report.json')}`,
  ].join('\n');

  await fs.writeFile(path.join(artifactsDir, 'qa-report.txt'), textReport, 'utf8');

  await context.close();
  await browser.close();

  return report;
}

async function startEnvironment() {
  const processes = [];
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const pythonLaunchOptions =
    process.platform === 'win32'
      ? [
          { command: 'python', args: ['apps/agents/main.py'] },
          { command: 'py', args: ['-3', 'apps/agents/main.py'] },
        ]
      : [{ command: 'python3', args: ['apps/agents/main.py'] }];

  if (START_SERVICES) {
    const dockerCmd = process.platform === 'win32' ? 'docker-compose' : 'docker-compose';
    const docker = runProcess(dockerCmd, ['up', '-d', 'postgres', 'redis'], { name: 'docker' });
    processes.push({ name: 'docker', child: docker, killOnExit: false });
    await sleep(2000);
  }

  const apiReachable = await isHttpReachable(API_URL);
  if (!apiReachable) {
    const apiEnv = { ...process.env, API_PORT: '3001' };
    const api = runProcess(npmCmd, ['run', 'dev', '--prefix', 'apps/api'], { name: 'api', env: apiEnv });
    processes.push({ name: 'api', child: api, killOnExit: true });
  } else {
    log(`Reusing existing API at ${API_URL}`);
  }

  const agentsReachable = await isHttpReachable(`${AGENTS_URL}/health`);
  if (!agentsReachable) {
    let launched = false;
    let lastError = null;

    for (const option of pythonLaunchOptions) {
      try {
        const agents = runProcess(option.command, option.args, {
          name: 'agents',
          env: process.env,
        });
        processes.push({ name: 'agents', child: agents, killOnExit: true });
        launched = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!launched) {
      throw new Error(
        `Unable to start agents service. Tried python launchers and failed with: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      );
    }
  } else {
    log(`Reusing existing Agents service at ${AGENTS_URL}`);
  }

  const webReachable = await isHttpReachable(`${WEB_URL}/login?next=%2Fdashboard`);
  if (!webReachable) {
    const webEnv = { ...process.env, PORT: new URL(WEB_URL).port || '3002', NEXT_PUBLIC_API_URL: API_URL };
    const web = runProcess(npmCmd, ['run', 'dev', '--prefix', 'apps/web'], { name: 'web', env: webEnv });
    processes.push({ name: 'web', child: web, killOnExit: true });
  } else {
    log(`Reusing existing Web at ${WEB_URL}`);
  }

  return processes;
}

async function verifyServicesReady() {
  await waitForTcp('127.0.0.1', 5432, 120000);
  await waitForTcp('127.0.0.1', 6379, 120000);
  await waitForHttp(API_URL, 120000);
  await waitForHttp(`${AGENTS_URL}/health`, 120000);
  await waitForHttp(`${WEB_URL}/login?next=%2Fdashboard`, 120000);
}

async function main() {
  await ensureDir(ARTIFACT_ROOT);

  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error('Missing dependency: playwright. Install with npm install --save-dev playwright');
  }

  const processes = await startEnvironment();

  let report;
  let exitCode = 0;

  try {
    log('Waiting for required services to become ready...');
    await verifyServicesReady();

    log('Running UI crawler...');
    report = await runCrawler(playwright);

    const summary = report.issuesSummary;
    log('Crawler finished.');
    log(`Pages: ${report.coverage.pagesTested}, Buttons: ${report.coverage.buttonsTested}, Forms: ${report.coverage.formsTested}`);
    log(`Issues => critical: ${summary.critical}, medium: ${summary.medium}, minor: ${summary.minor}`);
    log(`QA Gate => enforced: ${report.qaGate.enforced}, passed: ${report.qaGate.passed}`);
    if (!report.qaGate.passed) {
      for (const failure of report.qaGate.failures) {
        log(`QA Gate failure: ${failure}`);
      }
      if (report.qaGate.enforced) {
        exitCode = 1;
      }
    }
    log(`Artifacts: ${report.artifacts.root}`);
  } catch (error) {
    exitCode = 1;
    log(`Crawler failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    for (const proc of processes) {
      if (proc.killOnExit) {
        proc.child.kill();
      }
    }
  }

  process.exit(exitCode);
}

main().catch((error) => {
  log(`Fatal crawler error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

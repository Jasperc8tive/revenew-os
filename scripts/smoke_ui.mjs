/* eslint-env node */
/* global globalThis */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import process from 'process';

const API_URL = process.env.SMOKE_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.SMOKE_WEB_URL || 'http://localhost:3002';
const ORG_ID = process.env.SMOKE_ORG_ID || 'cmnnsg3nr0001h3or5flz10pc';
const STRICT_COMPETITIVE_CHECKS = process.env.SMOKE_STRICT_COMPETITIVE === '1';

function log(message) {
  process.stdout.write(`${message}\n`);
}

function runProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: false,
    ...options,
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${options.name || command}] ${data.toString()}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`[${options.name || command}] ${data.toString()}`);
  });

  return child;
}

async function waitForHttp(url, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await globalThis.fetch(url, { method: 'GET' });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Retry until timeout
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function isHttpReachable(url) {
  try {
    const response = await globalThis.fetch(url, { method: 'GET' });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function runSmoke(browser) {
  const page = await browser.newPage();

  await page.goto(`${WEB_URL}/competitive`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((orgId) => {
    globalThis.localStorage.setItem(
      'revenew.auth.session',
      JSON.stringify({
        userId: 'smoke-user',
        email: 'smoke@revenew.local',
        organizationId: orgId,
        accessToken: 'smoke-token',
        expiresAt: Date.now() + 1000 * 60 * 60,
      }),
    );
  }, ORG_ID);
  await page.reload({ waitUntil: 'domcontentloaded' });

  const routeChecks = [
    '/dashboard',
    '/orders',
    '/customers',
    '/messages',
    '/analytics',
    '/command-center',
    '/benchmarking',
    '/forecasting',
    '/experiments',
    '/competitive',
    '/copilot',
    '/reports',
    '/settings',
    '/help',
  ];

  const failures = [];

  for (const route of routeChecks) {
    await page.goto(`${WEB_URL}${route}`, { waitUntil: 'domcontentloaded' });
    await sleep(900);
    const text = await page.evaluate(() => globalThis.document.body.innerText || '');
    if (/Page not found/i.test(text) || /^404$/m.test(text)) {
      failures.push(`Route ${route} rendered 404 page`);
    }
  }

  await page.goto(`${WEB_URL}/competitive`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);

  // Exercise key Competitive controls (non-destructive)
  const actions = [
    'Add Competitor',
    'Add Signal',
    'Signal Trends',
    'Comparison',
    'AI Brief',
    'Alerts',
  ];

  const competitiveText = await page.evaluate(() => globalThis.document.body.innerText || '');
  const competitiveIsGatedOrAuthState =
    /Sign in|Log in|Active subscription required|Enterprise plan required|Forbidden|Unauthorized/i.test(competitiveText);

  if (STRICT_COMPETITIVE_CHECKS && !competitiveIsGatedOrAuthState) {
    for (const name of actions) {
      if (!competitiveText.includes(name)) {
        failures.push(`Competitive action not visible: ${name}`);
      }
    }
  }

  await page.goto(`${WEB_URL}/forecasting`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const forecastingText = await page.evaluate(() => globalThis.document.body.innerText || '');
  const forecastingLooksHealthy =
    /Revenue Forecasting Simulator/i.test(forecastingText) ||
    /Enterprise plan required/i.test(forecastingText) ||
    /Active subscription required/i.test(forecastingText) ||
    /Sign in to use the forecasting simulator/i.test(forecastingText);

  if (!forecastingLooksHealthy) {
    failures.push('Forecasting page did not reach expected state (simulator, auth, or plan-gating message)');
  }

  if (failures.length > 0) {
    log('Smoke test failed:');
    for (const failure of failures) {
      log(`- ${failure}`);
    }
    throw new Error(`Smoke failures: ${failures.length}`);
  }

  log('Smoke test passed: all routes and key controls look healthy.');
}

async function main() {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error('Missing dependency: playwright. Run npm install --save-dev playwright');
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  const apiEnv = { ...process.env, API_PORT: '3001' };
  const webEnv = {
    ...process.env,
    PORT: '3002',
    NEXT_PUBLIC_API_URL: API_URL,
  };

  let api;
  if (await isHttpReachable(API_URL)) {
    log(`Reusing existing API server at ${API_URL}`);
  } else {
    api = runProcess(
      npxCmd,
      ['ts-node', '-r', 'tsconfig-paths/register', 'apps/api/src/main.ts'],
      { env: apiEnv, name: 'api' },
    );
  }

  let web;
  if (await isHttpReachable(WEB_URL)) {
    log(`Reusing existing web server at ${WEB_URL}`);
  } else {
    web = runProcess(
      npmCmd,
      ['run', 'dev', '--prefix', 'apps/web'],
      { env: webEnv, name: 'web' },
    );
  }

  let exitCode = 0;
  try {
    await waitForHttp(API_URL);
    await waitForHttp(WEB_URL);

    const browser = await playwright.chromium.launch({ headless: true });
    try {
      await runSmoke(browser);
    } finally {
      await browser.close();
    }
  } catch (error) {
    exitCode = 1;
    log(`Smoke run failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    api?.kill();
    web?.kill();
  }

  process.exit(exitCode);
}

main().catch((error) => {
  log(`Fatal smoke runner error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

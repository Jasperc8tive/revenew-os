/* eslint-env node */

import { execSync } from 'child_process';
import path from 'path';
import process from 'process';

const profile = (process.argv[2] || 'staging').toLowerCase();
const printConfigOnly = process.argv.includes('--print-config');

const PROFILE_DEFAULTS = {
  staging: {
    UI_CRAWL_GATE_ENFORCE: '1',
    UI_CRAWL_START_SERVICES: '0',
    UI_CRAWL_MAX_PAGES: '30',
    UI_CRAWL_MAX_CLICKS: '14',
    UI_CRAWL_GATE_MAX_CRITICAL: '0',
    UI_CRAWL_GATE_MAX_MEDIUM: '0',
    UI_CRAWL_GATE_MAX_AI_FAILURES: '0',
    UI_CRAWL_GATE_MAX_OUTAGE_FAILURES: '0',
    UI_CRAWL_GATE_MAX_CONTRACT_FAILURES: '1',
    UI_CRAWL_GATE_MAX_ACTIONABLE: '12',
    UI_CRAWL_GATE_MIN_PAGES: '15',
  },
  production: {
    UI_CRAWL_GATE_ENFORCE: '1',
    UI_CRAWL_START_SERVICES: '0',
    UI_CRAWL_MAX_PAGES: '80',
    UI_CRAWL_MAX_CLICKS: '22',
    UI_CRAWL_GATE_MAX_CRITICAL: '0',
    UI_CRAWL_GATE_MAX_MEDIUM: '0',
    UI_CRAWL_GATE_MAX_AI_FAILURES: '0',
    UI_CRAWL_GATE_MAX_OUTAGE_FAILURES: '0',
    UI_CRAWL_GATE_MAX_CONTRACT_FAILURES: '0',
    UI_CRAWL_GATE_MAX_ACTIONABLE: '6',
    UI_CRAWL_GATE_MIN_PAGES: '20',
  },
};

if (!PROFILE_DEFAULTS[profile]) {
  process.stderr.write(`Unknown UI crawl profile: ${profile}. Use staging or production.\n`);
  process.exit(1);
}

const env = { ...process.env };
for (const [key, value] of Object.entries(PROFILE_DEFAULTS[profile])) {
  if (!env[key]) {
    env[key] = value;
  }
}

const config = {
  profile,
  gateEnforced: env.UI_CRAWL_GATE_ENFORCE,
  startServices: env.UI_CRAWL_START_SERVICES,
  webUrl: env.UI_CRAWL_WEB_URL || 'http://localhost:3002',
  maxPages: env.UI_CRAWL_MAX_PAGES,
  maxClicks: env.UI_CRAWL_MAX_CLICKS,
  thresholds: {
    critical: env.UI_CRAWL_GATE_MAX_CRITICAL,
    medium: env.UI_CRAWL_GATE_MAX_MEDIUM,
    aiFailures: env.UI_CRAWL_GATE_MAX_AI_FAILURES,
    outageFailures: env.UI_CRAWL_GATE_MAX_OUTAGE_FAILURES,
    contractFailures: env.UI_CRAWL_GATE_MAX_CONTRACT_FAILURES,
    actionable: env.UI_CRAWL_GATE_MAX_ACTIONABLE,
    minPages: env.UI_CRAWL_GATE_MIN_PAGES,
  },
};

process.stdout.write(`UI crawler profile config: ${JSON.stringify(config)}\n`);

if (printConfigOnly) {
  process.exit(0);
}

const crawlerPath = path.resolve(process.cwd(), 'scripts', 'ui_crawler.mjs');
const nodeExe = process.execPath;

// Build environment for the child process
const childEnv = { ...process.env };
for (const [key, value] of Object.entries(env)) {
  childEnv[key] = value;
}

try {
  // Use execSync with shell: true for better Windows compatibility
  const isWindows = process.platform === 'win32';
  const cmd = isWindows 
    ? `"${nodeExe}" "${crawlerPath}"` 
    : `${nodeExe} ${crawlerPath}`;
  
  execSync(cmd, {
    stdio: 'inherit',
    env: childEnv,
    shell: true,
  });
  
  process.exit(0);
} catch (error) {
  // execSync already exits with non-zero code, just re-throw
  if (error.status) {
    process.exit(error.status);
  }
  
  process.stderr.write(`Failed to launch UI crawler: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

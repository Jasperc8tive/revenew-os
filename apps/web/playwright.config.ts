import { defineConfig } from '@playwright/test';

/**
 * Smoke test configuration for the Revenew OS web app.
 *
 * Starts the Next.js dev server automatically before the suite runs.
 * Set PLAYWRIGHT_BASE_URL to target a running instance instead.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // sequential — tests share auth state via storage state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    // Setup project: creates auth session file used by authenticated tests
    {
      name: 'setup',
      testMatch: /e2e\/setup\/auth\.setup\.ts/,
    },

    // Unauthenticated tests (no dependency on setup)
    {
      name: 'smoke:public',
      testMatch: /e2e\/smoke\/public\.spec\.ts/,
    },

    // Authenticated tests: depend on the setup project
    {
      name: 'smoke:auth',
      testMatch: /e2e\/smoke\/auth\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/session.json',
      },
    },

    // Route coverage: all dashboard routes load without crashing
    {
      name: 'smoke:routes',
      testMatch: /e2e\/smoke\/routes\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/session.json',
      },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        cwd: __dirname,
      },
});

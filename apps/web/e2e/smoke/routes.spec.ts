/**
 * Route coverage smoke test.
 *
 * Visits every navigation route as an authenticated user and verifies:
 *   1. No redirect to /login (route is accessible)
 *   2. No unhandled error boundary ("Something went wrong" / "Dashboard failed to load")
 *   3. HTTP response is 200 (not a hard 4xx/5xx)
 *
 * Requires the 'setup' project to run first (storageState is injected).
 */
import { test, expect } from '@playwright/test';

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/analytics',
  '/dashboard/acquisition',
  '/dashboard/pipeline',
  '/dashboard/retention',
  '/dashboard/pricing',
  '/dashboard/agents',
  '/dashboard/recommendations',
  '/dashboard/command-center',
  '/dashboard/verification',
  '/dashboard/benchmarking',
  '/dashboard/forecasting',
  '/dashboard/experiments',
  '/dashboard/competitive',
  '/dashboard/copilot',
  '/dashboard/integrations',
  '/dashboard/reports',
  '/dashboard/billing',
  '/dashboard/settings',
  '/dashboard/orders',
  '/dashboard/customers',
  '/dashboard/messages',
  '/dashboard/help',
];

for (const route of DASHBOARD_ROUTES) {
  test(`${route} — loads without error`, async ({ page }) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

    // Must not be redirected away from dashboard (would indicate auth failure)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // HTTP status should be success (Next.js returns 200 for all app routes)
    expect(response?.status(), `Expected 200 for ${route}`).toBe(200);

    // No root error boundary
    await expect(page.locator('text=/Something went wrong/i')).not.toBeVisible({
      timeout: 5_000,
    });

    // No dashboard-scoped error boundary
    await expect(page.locator('text=/Dashboard failed to load/i')).not.toBeVisible({
      timeout: 5_000,
    });
  });
}

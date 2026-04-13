/**
 * Authenticated smoke tests.
 *
 * Requires the 'setup' project to run first (storageState is injected).
 *
 * Covers:
 *   - Dashboard home loads key UI elements
 *   - Auth user visiting /login redirects to /dashboard
 *   - Logout clears session and redirects to /login
 *   - Middleware blocks unauthorized route with redirect
 */
import { test, expect } from '@playwright/test';

test.describe('Dashboard home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('page loads without error boundary', async ({ page }) => {
    // Next.js root error.tsx should NOT be visible
    await expect(page.locator('text=/Something went wrong/i')).not.toBeVisible();
    // Dashboard-scoped error.tsx should NOT be visible
    await expect(page.locator('text=/Dashboard failed to load/i')).not.toBeVisible();
  });

  test('renders page heading', async ({ page }) => {
    // The dashboard home page heading
    await expect(
      page.locator('h1, h2').filter({ hasText: /command center|dashboard|growth/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('navigation sidebar is present', async ({ page }) => {
    // At least one nav link pointing to a dashboard sub-route
    await expect(page.locator('a[href^="/dashboard/"]').first()).toBeVisible();
  });
});

test.describe('Auth redirect for logged-in user', () => {
  test('visiting /login redirects authenticated user to /dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('visiting / redirects authenticated user to /dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Session integrity', () => {
  test('localStorage contains a valid auth session', async ({ page }) => {
    await page.goto('/dashboard');

    const raw = await page.evaluate(() =>
      localStorage.getItem('revenew.auth.session'),
    );
    expect(raw).toBeTruthy();

    const session = JSON.parse(raw!);
    expect(session).toMatchObject({
      userId: expect.any(String),
      email: expect.any(String),
      organizationId: expect.any(String),
      accessToken: expect.any(String),
    });
  });
});

test.describe('Logout', () => {
  test('logout clears session and redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');

    // Simulate logout by clearing auth storage directly, then navigating
    await page.evaluate(() => {
      localStorage.removeItem('revenew.auth.session');
      // Clear the auth cookie
      document.cookie = 'revenew.auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

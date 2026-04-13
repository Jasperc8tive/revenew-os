/**
 * Public route smoke tests — no auth required.
 *
 * Covers:
 *   - Root redirect behaviour
 *   - Login page renders and validates
 *   - Register page renders and validates
 *   - Protected routes redirect unauthenticated users
 */
import { test, expect } from '@playwright/test';

test.describe('Root redirect', () => {
  test('/ redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders email, password inputs and submit button', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('shows error when submitting empty form', async ({ page }) => {
    await page.click('button[type="submit"]');
    // Client-side guard: button stays on login page (no navigation)
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.fill('#email', 'nobody@invalid.example');
    await page.fill('#password', 'WrongPassword1');
    await page.click('button[type="submit"]');
    // Error banner should appear
    await expect(page.locator('text=/invalid|incorrect|not found/i')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('has a link to the register page', async ({ page }) => {
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
  });
});

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders all required fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#organizationName')).toBeVisible();
    await expect(page.locator('#industry')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Create account');
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.fill('#email', 'new@example.com');
    await page.fill('#organizationName', 'Test Corp');
    await page.fill('#password', 'Password123!');
    await page.fill('#confirmPassword', 'DifferentPass1');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/password.*match|match.*password/i')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('shows error for weak password', async ({ page }) => {
    await page.fill('#email', 'weak@example.com');
    await page.fill('#organizationName', 'Test Corp');
    await page.fill('#password', 'short');
    await page.fill('#confirmPassword', 'short');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=/8 char|uppercase|lowercase|number/i')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('has a link back to login', async ({ page }) => {
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});

test.describe('Protected routes (unauthenticated)', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/analytics',
    '/dashboard/agents',
    '/dashboard/settings',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

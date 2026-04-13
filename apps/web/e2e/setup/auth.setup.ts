/**
 * Auth setup — runs once before authenticated test projects.
 *
 * Logs in via the UI, writes the resulting localStorage + cookies to
 * e2e/.auth/session.json so every authenticated test starts pre-logged-in.
 *
 * Requires TEST_EMAIL and TEST_PASSWORD env vars (or the defaults below).
 * The account must already exist in the database.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const SESSION_FILE = path.join(__dirname, '../.auth/session.json');

const EMAIL = process.env.TEST_EMAIL ?? 'admin@demo-fintech.ng';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Password123!';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]:has-text("Sign in")');

  // Should land on /dashboard (or be redirected there)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Verify session is present in localStorage
  const session = await page.evaluate(() =>
    localStorage.getItem('revenew.auth.session'),
  );
  expect(session, 'Auth session must be set in localStorage after login').toBeTruthy();

  await page.context().storageState({ path: SESSION_FILE });
});

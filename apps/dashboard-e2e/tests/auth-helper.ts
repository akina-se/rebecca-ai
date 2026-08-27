import { Page, expect } from '@playwright/test';

/**
 * Helper to authenticate against Firebase Auth Emulator
 * and verify the complete UI transition from login to authenticated dashboard.
 */
export async function loginWithEmulatorAndSeedDB(page: Page, email = 'admin@example.com', password = 'password123') {
  // 1. Navigate to /login
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // 2. Click login button
  const loginButton = page.locator('.login-btn');
  await loginButton.waitFor({ state: 'visible', timeout: 15000 });
  await page.screenshot({ path: 'screenshots/00_login_page.png' });
  await loginButton.click();

  // 3. Wait for URL transition to /dashboard
  await page.waitForURL('**/dashboard', { timeout: 25000 });

  // 4. Assert login card is hidden & topbar is visible
  await expect(page.locator('.login-card')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('.topbar')).toBeVisible({ timeout: 20000 });
}

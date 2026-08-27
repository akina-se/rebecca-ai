import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Dashboard Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.block-header h2, .view-section h2').first()).toBeVisible({ timeout: 10000 });
  });

  /**
   * Scenario A: Leaderboard Filters & Limits
   */
  test('Scenario A: Leaderboard Filters & Limits - should render max 10 dynamic rows without mojibake and update on filter change', async ({ page }) => {
    // 1. Locate the Top Posts section
    const topPostsHeader = page.locator('.table-header-container').first();
    await expect(topPostsHeader).toBeVisible();
    const topPostsTable = page.locator('.data-table').first();

    const yearlyTab = topPostsHeader.locator('.rank-tab', { hasText: /Yearly|年間/ });
    const datePicker = topPostsHeader.locator('app-date-picker-popover');
    const dateText = datePicker.locator('.current-text');

    const postRows = topPostsTable.locator('tbody tr');
    await expect(postRows.first()).toBeVisible({ timeout: 15000 });
    const postRowCount = await postRows.count();
    expect(postRowCount).toBeGreaterThan(0);
    expect(postRowCount).toBeLessThanOrEqual(10);

    const firstPostSnippet = (await postRows.first().locator('td').nth(1).innerText()).trim();
    expect(firstPostSnippet).not.toContain('豌ｴ譏');
    expect(firstPostSnippet).not.toContain('縺翫・');

    const topUsersTable = page.locator('.data-table').nth(1);
    const userRows = topUsersTable.locator('tbody tr');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });
    const userRowCount = await userRows.count();
    expect(userRowCount).toBeGreaterThan(0);
    expect(userRowCount).toBeLessThanOrEqual(10);

    const firstUserHandle = (await userRows.first().locator('td').first().innerText()).trim();
    expect(firstUserHandle).toMatch(/^@[a-zA-Z0-9_]+$/);

    const allTimeTab = topPostsHeader.locator('.rank-tab', { hasText: /All-Time|全期間/ });
    await allTimeTab.click();
    await expect(allTimeTab).toHaveClass(/active/);
    await expect(yearlyTab).not.toHaveClass(/active/);
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();

    await yearlyTab.click();
    await expect(yearlyTab).toHaveClass(/active/);
    await expect(dateText).toHaveText('2026');
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('User Relations & Settings Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
  });

  test('should render User Relations table with 30 items pagination', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: 'User Relations' })).toBeVisible({ timeout: 15000 });

    // Wait for user rows
    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    const count = await userRows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(30);

    // Verify pagination controls are present
    const pagination = page.locator('app-pagination');
    await expect(pagination).toBeVisible();
    await expect(page.locator('.pagination-container .total-items-text')).toContainText('Showing');
  });

  test('should filter users using fuzzy search input', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: 'User Relations' })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder="Search users..."]');
    await expect(searchInput).toBeVisible();

    // Type search query
    await searchInput.fill('gundam');
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);

    // Verify filtered row
    await expect(page.locator('.data-table tbody')).toContainText('@gundam_fan_88');
    const filteredCount = await userRows.count();
    expect(filteredCount).toBe(1);

    // Clear search
    await searchInput.fill('');
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    const restoredCount = await userRows.count();
    expect(restoredCount).toBeGreaterThan(1);
  });

  test('should sort users by User ID, Interactions, and Last Interaction with indicator symbols', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: 'User Relations' })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // 1. Sort by User ID
    const userIdHeader = page.locator('th.sortable-th').filter({ hasText: 'User ID' });
    await userIdHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);

    // Sort icon should be arrow_downward
    await expect(userIdHeader.locator('.sort-icon')).toContainText('arrow_downward');

    // Click again for asc
    await userIdHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(userIdHeader.locator('.sort-icon')).toContainText('arrow_upward');

    // 2. Sort by Last Interaction
    const lastSeenHeader = page.locator('th.sortable-th').filter({ hasText: 'Last Interaction' });
    await lastSeenHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(lastSeenHeader.locator('.sort-icon')).toContainText('arrow_downward');

    // 3. Sort by Interactions
    const interactionsHeader = page.locator('th.sortable-th').filter({ hasText: 'Interactions' });
    await interactionsHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(interactionsHeader.locator('.sort-icon')).toContainText('arrow_downward');
  });

  test('should display RAG Memories status badges correctly', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: 'User Relations' })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // Verify RAG Memories column headers & rows
    const ragBadge = userRows.first().locator('td').nth(4).locator('.badge');
    await expect(ragBadge).toBeVisible();
    await expect(ragBadge).toContainText(/Generated|None/);
  });

  test('should support bulk selection and status updates in User Relations', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: 'User Relations' })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // Select all checkbox
    const selectAllCheckbox = page.locator('#user-bulk-bar .checkbox-container').first();
    await selectAllCheckbox.click();

    // Verify bulk text shows selected count
    const bulkText = page.locator('#user-bulk-bar .bulk-text');
    await expect(bulkText).toContainText('users selected');

    // Verify action buttons appear
    const blockBtn = page.locator('#user-bulk-bar button').first();
    const unblockBtn = page.locator('#user-bulk-bar button').last();
    await expect(blockBtn).toBeVisible();
    await expect(blockBtn).toContainText('Block');
    await expect(unblockBtn).toBeVisible();
    await expect(unblockBtn).toContainText('Unblock');
  });

  test('should support global 1-hour interval timezones and persistence in Settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h2', { hasText: 'System Settings' })).toBeVisible({ timeout: 15000 });

    // Open timezone dropdown
    const tzDropdown = page.locator('app-dropdown').nth(1);
    await expect(tzDropdown).toBeVisible();

    const tzToggle = tzDropdown.locator('.dropdown-toggle');
    await tzToggle.click();

    // Wait for dropdown menu to appear
    await expect(tzDropdown.locator('.dropdown-menu')).toBeVisible({ timeout: 5000 });

    // Verify expanded global timezone options (covers UTC-12 to UTC+14)
    const dropdownItems = tzDropdown.locator('.dropdown-item');
    const itemsCount = await dropdownItems.count();
    expect(itemsCount).toBeGreaterThanOrEqual(25);

    // Select Eastern Time (UTC-5)
    const nyOption = dropdownItems.filter({ hasText: 'Eastern Time' });
    await expect(nyOption).toBeVisible();
    await nyOption.click();

    // Verify selected text changed
    await expect(tzToggle).toContainText('Eastern Time');

    // Reload page to verify persistence
    await page.reload();
    await expect(page.locator('app-dropdown').nth(1).locator('.dropdown-toggle')).toContainText('Eastern Time');
  });

});

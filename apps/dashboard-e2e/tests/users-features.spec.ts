import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('User Relations & Settings Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/users');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });
  });

  test('should render User Relations table with 30 items pagination', async ({ page }) => {
    await expect(page.locator('h2', { hasText: /User Relations|ユーザー関係/ })).toBeVisible({ timeout: 15000 });

    // Wait for user rows
    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    const count = await userRows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(30);

    // Verify pagination controls are present
    const pagination = page.locator('app-pagination');
    await expect(pagination).toBeVisible();
    await expect(page.locator('.pagination-container .total-items-text')).toContainText(/Showing|表示中|全.*件/);
  });

  test('should filter users using fuzzy search input', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: /User Relations|ユーザー関係/ })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('.block-header input.form-control');
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
    await expect(page.locator('h2', { hasText: /User Relations|ユーザー関係/ })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // 1. Sort by User ID
    const userIdHeader = page.locator('th.sortable-th').filter({ hasText: /User ID|ユーザーID/ });
    await userIdHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);

    // Sort icon should be arrow_downward
    await expect(userIdHeader.locator('.sort-icon')).toContainText('arrow_downward');

    // Click again for asc
    await userIdHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(userIdHeader.locator('.sort-icon')).toContainText('arrow_upward');

    // 2. Sort by Last Interaction
    const lastSeenHeader = page.locator('th.sortable-th').filter({ hasText: /Last Interaction|最終対話日時/ });
    await lastSeenHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(lastSeenHeader.locator('.sort-icon')).toContainText('arrow_downward');

    // 3. Sort by Interactions
    const interactionsHeader = page.locator('th.sortable-th').filter({ hasText: /Interactions|対話回数/ });
    await interactionsHeader.click();
    await page.waitForResponse(resp => resp.url().includes('/api/v1/users') && resp.status() === 200);
    await expect(interactionsHeader.locator('.sort-icon')).toContainText('arrow_downward');
  });

  test('should display RAG Memories status badges correctly', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: /User Relations|ユーザー関係/ })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // Verify RAG Memories column headers & rows
    const ragBadge = userRows.first().locator('td').nth(4).locator('.badge');
    await expect(ragBadge).toBeVisible();
    await expect(ragBadge).toContainText(/Generated|None/);
  });

  test('should support bulk selection and status updates in User Relations', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h2', { hasText: /User Relations|ユーザー関係/ })).toBeVisible({ timeout: 15000 });

    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });

    // Select all checkbox
    const selectAllCheckbox = page.locator('#user-bulk-bar .checkbox-container').first();
    await selectAllCheckbox.click();

    // Verify bulk text shows selected count
    const bulkText = page.locator('#user-bulk-bar .bulk-text');
    await expect(bulkText).toContainText(/users selected|名のユーザーを選択中/);

    // Verify action buttons appear
    const blockBtn = page.locator('#user-bulk-bar button').first();
    const unblockBtn = page.locator('#user-bulk-bar button').last();
    await expect(blockBtn).toBeVisible();
    await expect(blockBtn).toContainText(/Block|ブロック/);
    await expect(unblockBtn).toBeVisible();
    await expect(unblockBtn).toContainText(/Unblock|解除/);
  });

  test('should support global 1-hour interval timezones and persistence in Settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('h2', { hasText: /System Settings|システム環境設定/ })).toBeVisible({ timeout: 15000 });

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

  test('should display all timestamps in uniform YYYY/MM/DD HH:mm:ss format and update with timezone changes', async ({ page }) => {
    // 1. Set timezone to JST (Tokyo, UTC+9)
    await page.goto('/settings');
    const tzDropdown = page.locator('app-dropdown').nth(1);
    await tzDropdown.locator('.dropdown-toggle').click();
    await expect(tzDropdown.locator('.dropdown-menu')).toBeVisible();
    await tzDropdown.locator('.dropdown-item').filter({ hasText: 'Tokyo' }).click();

    // 2. Verify User Relations timestamps format
    await page.goto('/users');
    const userRows = page.locator('.data-table tbody tr.clickable');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });
    const userDateText = await userRows.first().locator('td').nth(3).innerText();
    
    // Validate format YYYY/MM/DD HH:mm:ss
    expect(userDateText).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(userDateText).not.toContain('T');
    expect(userDateText).not.toContain('Z');
    expect(userDateText).not.toContain('Invalid Date');

    // 3. Verify Memory Management timestamps format
    await page.goto('/memory');
    const memoryRows = page.locator('table.data-table tbody tr');
    await expect(memoryRows).toHaveCount(3);
    const layer1Date = await memoryRows.nth(1).locator('td').nth(2).innerText();
    expect(layer1Date).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

    // 4. Verify Dashboard Timeline timestamps format
    await page.goto('/dashboard');
    const timelineRows = page.locator('#timeline-table tbody tr.clickable');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });
    const timelineDateText = await timelineRows.first().locator('td').nth(1).innerText();
    expect(timelineDateText).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);

    // 5. Change Timezone to UTC (London, UTC+0)
    await page.goto('/settings');
    const tzDropdown2 = page.locator('app-dropdown').nth(1);
    await tzDropdown2.locator('.dropdown-toggle').click();
    await expect(tzDropdown2.locator('.dropdown-menu')).toBeVisible();
    await tzDropdown2.locator('.dropdown-item').filter({ hasText: 'London' }).click();

    // 6. Verify User Relations timestamp updated according to timezone difference (9 hours difference)
    await page.goto('/users');
    const userDateTextUTC = await page.locator('.data-table tbody tr.clickable').first().locator('td').nth(3).innerText();
    expect(userDateTextUTC).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(userDateTextUTC).not.toBe(userDateText);
  });

});

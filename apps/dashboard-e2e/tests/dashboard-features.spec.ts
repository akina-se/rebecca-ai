import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Dashboard Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Authenticate via Firebase Auth Emulator and inject session into browser context
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // Navigate to dashboard and wait until topbar and main content are rendered
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Performance Overview')).toBeVisible({ timeout: 10000 });
  });

  /**
   * Scenario A: Leaderboard Filters
   * - Navigate to Top Posts leaderboard.
   * - Change mode tab from 'Monthly' to 'Yearly' and observe UI and date changes.
   * - Click date navigation buttons (< / >) and assert date changes and table rows render.
   */
  test('Scenario A: Leaderboard Filters - should update dates and render table rows when switching modes and dates', async ({ page }) => {
    // 1. Locate the Top Posts section
    const topPostsHeader = page.locator('.table-header-container', { hasText: 'Top Posts by Impressions' });
    await expect(topPostsHeader).toBeVisible();
    const topPostsContainer = topPostsHeader.locator('..');
    const topPostsTable = topPostsContainer.locator('table.data-table');

    const monthlyTab = topPostsHeader.locator('.rank-tab', { hasText: 'Monthly' });
    const yearlyTab = topPostsHeader.locator('.rank-tab', { hasText: 'Yearly' });
    const datePicker = topPostsHeader.locator('app-date-picker-popover');
    const dateText = datePicker.locator('.current-text');

    // Initially, Monthly mode is selected with 'July 2026'
    await expect(monthlyTab).toHaveClass(/active/);
    await expect(dateText).toHaveText('July 2026');
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();

    // 2. Switch mode from Monthly to Yearly
    await yearlyTab.click();

    // Verify Yearly tab is active and date changes to '2026'
    await expect(yearlyTab).toHaveClass(/active/);
    await expect(monthlyTab).not.toHaveClass(/active/);
    await expect(dateText).toHaveText('2026');
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();

    // 3. Shift date back using '<' button in date picker
    const prevBtn = datePicker.locator('.nav-btn').first();
    await prevBtn.click();

    // Verify date text updates to 2025 and rows continue to render properly
    await expect(dateText).toHaveText('2025');
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();
  });

  /**
   * Scenario B: Timeline Pagination
   * - Scroll to Timeline Post History.
   * - Assert pagination controls are visible with initial page '1 / X'.
   * - Click Next Page ('>') button and assert page updates to '2 / X' and data refreshes.
   */
  test('Scenario B: Timeline Pagination - should display controls and update page data upon pagination', async ({ page }) => {
    // 1. Scroll to Timeline Post History
    const timelineHeading = page.locator('h2', { hasText: 'Timeline Post History' });
    await timelineHeading.scrollIntoViewIfNeeded();
    await expect(timelineHeading).toBeVisible();

    const timelineTable = page.locator('table.data-table').nth(2);
    const timelineRows = timelineTable.locator('tbody tr');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });

    // 2. Verify pagination controls visibility and initial state
    const pagination = page.locator('.pagination');
    await expect(pagination).toBeVisible();

    const prevBtn = pagination.locator('.pagination-controls button.page-btn').first();
    const activePageBtn = pagination.locator('.pagination-controls button.page-btn.active');
    const nextBtn = pagination.locator('.pagination-controls button.page-btn').last();

    await expect(prevBtn).toBeVisible();
    await expect(prevBtn).toBeDisabled();
    await expect(activePageBtn).toBeVisible();
    await expect(activePageBtn).toHaveText(/1\s*\/\s*\d+/);
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();

    // Capture first row text on page 1
    const pageOneFirstRow = timelineRows.first();
    const pageOneFirstRowText = (await pageOneFirstRow.locator('td').nth(3).innerText()).trim();

    // 3. Click Next Page ('>') button
    await nextBtn.click();

    // 4. Assert page number is updated and table data refreshed
    await expect(activePageBtn).toHaveText(/2\s*\/\s*\d+/);
    await expect(prevBtn).toBeEnabled();
    await expect(timelineRows.first().locator('td').nth(3)).not.toHaveText(pageOneFirstRowText);
  });

  /**
   * Scenario C: Timeline Keyword Search
   * - Type a specific keyword into the search bar.
   * - Assert table row count is reduced to match filtered results.
   * - Clear the search bar and assert all original rows return.
   */
  test('Scenario C: Timeline Keyword Search - should filter timeline posts by search keyword', async ({ page }) => {
    // 1. Locate Timeline Post History and search input
    const timelineHeading = page.locator('h2', { hasText: 'Timeline Post History' });
    await timelineHeading.scrollIntoViewIfNeeded();

    const searchInput = page.locator('input[placeholder="Search logs..."]');
    await expect(searchInput).toBeVisible();

    const timelineTable = page.locator('table.data-table').nth(2);
    const timelineRows = timelineTable.locator('tbody tr');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });

    const initialRowCount = await timelineRows.count();
    expect(initialRowCount).toBeGreaterThan(1);

    // 2. Type keyword known to exist in seeded data (e.g., '水星' or 'TypeScript' or 'No. 1')
    const keyword = '水星';
    await searchInput.fill(keyword);

    // 3. Assert row count is reduced and visible rows contain the search term
    const filteredRowCount = await timelineRows.count();
    expect(filteredRowCount).toBeGreaterThan(0);
    expect(filteredRowCount).toBeLessThan(initialRowCount);
    for (let i = 0; i < filteredRowCount; i++) {
      await expect(timelineRows.nth(i)).toContainText(keyword);
    }

    // 4. Clear search query and verify full list is restored
    await searchInput.fill('');
    await expect(timelineRows).toHaveCount(initialRowCount);
  });

  /**
   * Scenario D: Bulk Actions (Delete)
   * - Select checkboxes next to first 2 rows.
   * - Assert "Delete from X" button becomes visible in the bulk actions bar.
   * - Click "Delete from X".
   * - Assert success toast appears, network call succeeds, and deleted rows disappear.
   */
  test('Scenario D: Bulk Actions (Delete) - should select rows, execute bulk delete, and show success toast', async ({ page }) => {
    const timelineHeading = page.locator('h2', { hasText: 'Timeline Post History' });
    await timelineHeading.scrollIntoViewIfNeeded();

    const timelineTable = page.locator('table.data-table').nth(2);
    const timelineRows = timelineTable.locator('tbody tr');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });

    const bulkBar = page.locator('#timeline-bulk-bar');
    const bulkDeleteBtn = bulkBar.locator('.bulk-btn');

    // Initially bulk delete button should be hidden
    await expect(bulkDeleteBtn).not.toBeVisible();

    // 1. Select the checkboxes for the first 2 rows via custom checkbox container label
    const firstRow = timelineRows.nth(0);
    const secondRow = timelineRows.nth(1);

    const firstPostSnippet = (await firstRow.locator('td').nth(3).innerText()).trim();
    const secondPostSnippet = (await secondRow.locator('td').nth(3).innerText()).trim();

    await firstRow.locator('.checkbox-container').click();
    await secondRow.locator('.checkbox-container').click();

    // 2. Verify "Delete from X" button is now visible with correct count text
    await expect(bulkDeleteBtn).toBeVisible();
    await expect(bulkBar).toContainText('2 items selected');

    // 3. Execute bulk delete
    await bulkDeleteBtn.click();

    // 4. Verify success toast notification
    const toast = page.locator('.toast.success, .toast');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/Successfully deleted 2 posts/i);

    // 5. Verify the deleted posts no longer appear in the refreshed table
    await expect(timelineTable.locator('tbody')).not.toContainText(firstPostSnippet);
    await expect(timelineTable.locator('tbody')).not.toContainText(secondPostSnippet);
  });

  /**
   * Scenario E: Drawers and Navigation
   * - Click a user ID/handle in "Top Engaged Users" table -> verify User Profile drawer slides open.
   * - Close drawer -> verify drawer closes.
   * - Click a post row in "Timeline Post History" -> verify Post Details drawer slides open.
   */
  test('Scenario E: Drawers and Navigation - should open and close User Profile and Post Details drawers', async ({ page }) => {
    // 1. Open User Profile drawer from Top Engaged Users table
    const topUsersHeader = page.locator('.table-header-container', { hasText: 'Top Engaged Users' });
    await expect(topUsersHeader).toBeVisible();
    const topUsersTable = topUsersHeader.locator('..').locator('table.data-table');
    const firstUserRow = topUsersTable.locator('tbody tr').first();
    await expect(firstUserRow).toBeVisible({ timeout: 10000 });

    const userHandle = (await firstUserRow.locator('td').first().innerText()).trim();
    await firstUserRow.click();

    // Verify User Profile drawer is open and shows user data
    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText('User Profile');

    const userDrawerContent = drawer.locator('app-user-drawer .drawer-content');
    await expect(userDrawerContent).toBeVisible({ timeout: 10000 });
    await expect(userDrawerContent.locator('.profile-handle')).toContainText(userHandle);

    // 2. Close drawer
    const closeBtn = drawer.locator('.drawer-header .close-btn');
    await closeBtn.click();
    await expect(drawer).not.toHaveClass(/open/);

    // 3. Open Post Details drawer from Timeline Post History
    const timelineHeading = page.locator('h2', { hasText: 'Timeline Post History' });
    await timelineHeading.scrollIntoViewIfNeeded();

    const timelineTable = page.locator('table.data-table').nth(2);
    const firstTimelineRow = timelineTable.locator('tbody tr').first();
    await expect(firstTimelineRow).toBeVisible({ timeout: 10000 });

    const postSnippet = (await firstTimelineRow.locator('td').nth(3).innerText()).trim();
    const postSnippetPrefix = postSnippet.replace(/\.{3}$/, '').trim();

    // Click on the post snippet cell to open the drawer
    await firstTimelineRow.locator('td').nth(3).click();

    // Verify Post Details drawer is open and shows post content
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText('Post Details');

    const postDrawerContent = drawer.locator('app-post-drawer .drawer-content');
    await expect(postDrawerContent).toBeVisible({ timeout: 10000 });
    await expect(postDrawerContent.locator('.content-box')).toContainText(postSnippetPrefix);

    // 4. Close Post Details drawer
    await closeBtn.click();
    await expect(drawer).not.toHaveClass(/open/);
  });
});

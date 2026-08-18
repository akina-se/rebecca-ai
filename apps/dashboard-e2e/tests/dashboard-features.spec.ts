import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Dashboard Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Authenticate via Firebase Auth Emulator and inject session into browser context
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // Navigate to dashboard and wait until topbar and main content are rendered
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.block-header h2, .view-section h2').first()).toBeVisible({ timeout: 10000 });
  });

  /**
   * Scenario A: Leaderboard Filters & Limits
   * - Navigate to Top Posts leaderboard.
   * - Assert table displays dynamic posts (max 10) without mojibake.
   * - Assert Top Engaged Users table displays max 10 rows with valid @handles.
   * - Change mode tab from 'Monthly' to 'Yearly' and observe UI and date changes.
   * - Click date navigation buttons (< / >) and assert date changes and table rows render.
   */
  test('Scenario A: Leaderboard Filters & Limits - should render max 10 dynamic rows without mojibake and update on filter change', async ({ page }) => {
    // 1. Locate the Top Posts section
    const topPostsHeader = page.locator('.table-header-container').first();
    await expect(topPostsHeader).toBeVisible();
    const topPostsTable = page.locator('.data-table').first();

    const monthlyTab = topPostsHeader.locator('.rank-tab', { hasText: /Monthly|月間/ });
    const yearlyTab = topPostsHeader.locator('.rank-tab', { hasText: /Yearly|年間/ });
    const datePicker = topPostsHeader.locator('app-date-picker-popover');
    const dateText = datePicker.locator('.current-text');

    // Verify dynamic Top Posts rows: maximum 10 rows and no mojibake
    const postRows = topPostsTable.locator('tbody tr');
    await expect(postRows.first()).toBeVisible({ timeout: 15000 });
    const postRowCount = await postRows.count();
    expect(postRowCount).toBeGreaterThan(0);
    expect(postRowCount).toBeLessThanOrEqual(10);

    const firstPostSnippet = (await postRows.first().locator('td').nth(1).innerText()).trim();
    // Regression check: snippet must not contain garbled Shift-JIS markers
    expect(firstPostSnippet).not.toContain('豌ｴ譏');
    expect(firstPostSnippet).not.toContain('縺翫・');

    // 2. Verify Top Engaged Users table: maximum 10 rows and handles start with @
    const topUsersHeader = page.locator('.table-header-container').nth(1);
    const topUsersTable = page.locator('.data-table').nth(1);
    const userRows = topUsersTable.locator('tbody tr');
    await expect(userRows.first()).toBeVisible({ timeout: 10000 });
    const userRowCount = await userRows.count();
    expect(userRowCount).toBeGreaterThan(0);
    expect(userRowCount).toBeLessThanOrEqual(10);

    const firstUserHandle = (await userRows.first().locator('td').first().innerText()).trim();
    expect(firstUserHandle).toMatch(/^@[a-zA-Z0-9_]+$/);

    // 3. Switch mode to All-Time in Top Posts
    const allTimeTab = topPostsHeader.locator('.rank-tab', { hasText: /All-Time|全期間/ });
    await allTimeTab.click();
    await expect(allTimeTab).toHaveClass(/active/);
    await expect(yearlyTab).not.toHaveClass(/active/);
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();

    // 4. Switch back to Yearly
    await yearlyTab.click();
    await expect(yearlyTab).toHaveClass(/active/);
    await expect(dateText).toHaveText('2026');
    await expect(topPostsTable.locator('tbody tr').first()).toBeVisible();
  });

  /**
   * Scenario B: Timeline Pagination & Column Sorting
   * - Scroll to Timeline Post History.
   * - Test interactive column sorting for TIME and IMPRESSIONS with indicator icons.
   * - Test pagination controls (< 1 2 3 ... > Page 1 / X).
   */
  test('Scenario B: Timeline Pagination & Sorting - should toggle sort by Time/Impressions and paginate properly', async ({ page }) => {
    // 1. Scroll to Timeline Post History
    const timelineHeading = page.locator('h2', { hasText: /Timeline Post History|タイムライン投稿履歴/ });
    await timelineHeading.scrollIntoViewIfNeeded();
    await expect(timelineHeading).toBeVisible();

    const timelineTable = page.locator('table.data-table').nth(2);
    const timelineRows = timelineTable.locator('tbody tr');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });

    // 2. Locate sortable table headers
    const timeHeader = timelineTable.locator('th.sortable-th', { hasText: /Time|投稿日時/ });
    const impressionsHeader = timelineTable.locator('th.sortable-th', { hasText: /Impressions|インプレッション/ });

    await expect(timeHeader).toBeVisible();
    await expect(impressionsHeader).toBeVisible();

    // Default sort is TIME desc (arrow_downward)
    await expect(timeHeader.locator('.sort-icon')).toHaveText('arrow_downward');

    // Click TIME header to toggle to ASC (arrow_upward)
    await timeHeader.click();
    await expect(timeHeader.locator('.sort-icon')).toHaveText('arrow_upward');
    await expect(timelineRows.first()).toBeVisible();

    // Click IMPRESSIONS header to sort by Impressions desc
    await impressionsHeader.click();
    await expect(impressionsHeader.locator('.sort-icon')).toHaveText('arrow_downward');
    await expect(timeHeader.locator('.sort-icon')).toHaveText('unfold_more');
    await expect(timelineRows.first()).toBeVisible();

    // 3. Verify pagination controls visibility and initial state
    const pagination = page.locator('.pagination');
    await expect(pagination).toBeVisible();

    const prevBtn = pagination.locator('.pagination-controls button.page-btn').first();
    const activePageBtn = pagination.locator('.pagination-controls button.page-btn.active');
    const nextBtn = pagination.locator('.pagination-controls button.page-btn').last();
    const pageInfo = pagination.locator('.page-info');

    await expect(prevBtn).toBeVisible();
    await expect(prevBtn).toBeDisabled();
    await expect(activePageBtn).toBeVisible();
    await expect(activePageBtn).toHaveText('1');
    await expect(pageInfo).toHaveText(/(Page|ページ) 1\s*\/\s*\d+/);
    await expect(nextBtn).toBeVisible();
    await expect(nextBtn).toBeEnabled();

    // 4. Click Next Page ('>') button
    await nextBtn.click();
    await expect(activePageBtn).toHaveText('2');
    await expect(pageInfo).toHaveText(/(Page|ページ) 2\s*\/\s*\d+/);
    await expect(prevBtn).toBeEnabled();
  });

  /**
   * Scenario B2: Timeline Media Lightbox
   * - Locate post row with media.
   * - Click media thumbnail icon.
   * - Verify full-size Lightbox modal opens with real image URL and closes cleanly.
   */
  test('Scenario B2: Timeline Media Lightbox - should open lightbox modal with real image on thumbnail click', async ({ page }) => {
    const timelineHeading = page.locator('h2', { hasText: /Timeline Post History|タイムライン投稿履歴/ });
    await timelineHeading.scrollIntoViewIfNeeded();

    const timelineTable = page.locator('table.data-table').nth(2);
    // Find row with media thumbnail
    const mediaThumb = timelineTable.locator('tbody tr td div[title="Click to view image"]').first();
    await expect(mediaThumb).toBeVisible({ timeout: 10000 });

    // Click thumbnail
    await mediaThumb.click();

    // Verify Lightbox modal appears
    const lightbox = page.locator('app-lightbox .lightbox-overlay');
    await expect(lightbox).toBeVisible({ timeout: 5000 });

    const lightboxImg = lightbox.locator('img');
    await expect(lightboxImg).toBeVisible();
    const imgSrc = await lightboxImg.getAttribute('src');
    expect(imgSrc).toBeTruthy();
    expect(imgSrc?.length).toBeGreaterThan(0);

    // Close lightbox
    const closeBtn = lightbox.locator('.close-btn');
    await closeBtn.click();
    await expect(lightbox).not.toBeVisible();
  });

  /**
   * Scenario C: Timeline Keyword Search
   * - Type a dynamic keyword from the first row into the search bar.
   * - Assert table row count is reduced to match filtered results.
   * - Clear the search bar and assert all original rows return.
   */
  test('Scenario C: Timeline Keyword Search - should filter timeline posts by search keyword', async ({ page }) => {
    // 1. Locate Timeline Post History and search input
    const timelineHeading = page.locator('h2', { hasText: /Timeline Post History|タイムライン投稿履歴/ });
    await timelineHeading.scrollIntoViewIfNeeded();

    const searchInput = page.locator('.block-header input.form-control').first();
    await expect(searchInput).toBeVisible();

    const timelineTable = page.locator('table.data-table').nth(2);
    const timelineRows = timelineTable.locator('tbody tr');
    await expect(timelineRows.first()).toBeVisible({ timeout: 10000 });

    const initialRowCount = await timelineRows.count();
    expect(initialRowCount).toBeGreaterThan(1);

    // 2. Extract keyword dynamically from the first visible post
    const firstRowText = (await timelineRows.first().locator('td').nth(3).innerText()).trim();
    const keyword = firstRowText.substring(0, Math.min(6, firstRowText.length));
    await searchInput.fill(keyword);

    // 3. Assert row count is reduced and visible rows contain the search term
    const filteredRowCount = await timelineRows.count();
    expect(filteredRowCount).toBeGreaterThan(0);
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
    const timelineHeading = page.locator('h2', { hasText: /Timeline Post History|タイムライン投稿履歴/ });
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
    await expect(bulkBar).toContainText(/2 (items selected|件の投稿を選択中)/);

    // 3. Execute bulk delete
    await bulkDeleteBtn.click();

    // 4. Verify success toast notification
    const toast = page.locator('.toast.success, .toast');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/Successfully deleted 2 posts|投稿.*削除|正常に削除/i);

    // 5. Verify the deleted posts no longer appear in the refreshed table
    await expect(timelineTable.locator('tbody')).not.toContainText(firstPostSnippet);
    await expect(timelineTable.locator('tbody')).not.toContainText(secondPostSnippet);
  });

  /**
   * Scenario E: Drawers and Navigation
   * - Click a user ID/handle in "Top Engaged Users" table -> verify User Profile drawer slides open.
   * - Verify user name is resolved and not "Unknown".
   * - Close drawer -> verify drawer closes.
   * - Click a post row in "Timeline Post History" -> verify Post Details drawer slides open.
   */
  test('Scenario E: Drawers and Navigation - should open and close User Profile (with resolved name) and Post Details drawers', async ({ page }) => {
    // 1. Open User Profile drawer from Top Engaged Users table
    const topUsersHeader = page.locator('.table-header-container', { hasText: /Top Engaged Users|エンゲージメント上位ユーザー/ });
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
    await expect(drawer.locator('.drawer-header h3')).toContainText(/User Profile|ユーザープロファイル|ユーザー詳細/);

    const userDrawerContent = drawer.locator('app-user-drawer .drawer-content');
    await expect(userDrawerContent).toBeVisible({ timeout: 10000 });
    await expect(userDrawerContent.locator('.profile-handle')).toContainText(userHandle);

    // Regression check: profile name must NOT be "Unknown"
    const profileName = (await userDrawerContent.locator('.profile-name').innerText()).trim();
    expect(profileName.length).toBeGreaterThan(0);
    expect(profileName).not.toBe('Unknown');

    // Verify "View on X" button in User drawer triggers navigation to x.com profile
    const userViewOnXBtn = userDrawerContent.locator('button', { hasText: /View on X|Xで見る/ });
    await expect(userViewOnXBtn).toBeVisible();
    const [userPopup] = await Promise.all([
      page.waitForEvent('popup'),
      userViewOnXBtn.click(),
    ]);
    expect(userPopup.url()).toContain('x.com/');
    await userPopup.close();

    // 2. Close drawer
    const closeBtn = drawer.locator('.drawer-header .close-btn');
    await closeBtn.click();
    await expect(drawer).not.toHaveClass(/open/);

    // 3. Open Post Details drawer from Timeline Post History
    const timelineHeading = page.locator('h2', { hasText: /Timeline Post History|タイムライン投稿履歴/ });
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
    await expect(drawer.locator('.drawer-header h3')).toContainText(/Post Details|投稿詳細/);

    const postDrawerContent = drawer.locator('app-post-drawer .drawer-content');
    await expect(postDrawerContent).toBeVisible({ timeout: 10000 });
    await expect(postDrawerContent.locator('.content-box')).toContainText(postSnippetPrefix);

    // Verify "View on X" button in Post Details drawer triggers navigation to x.com post
    const postViewOnXBtn = postDrawerContent.locator('button', { hasText: /View on X|Xで見る/ });
    await expect(postViewOnXBtn).toBeVisible();
    const [postPopup] = await Promise.all([
      page.waitForEvent('popup'),
      postViewOnXBtn.click(),
    ]);
    expect(postPopup.url()).toContain('x.com/i/status/');
    await postPopup.close();

    // 4. Close Post Details drawer
    await closeBtn.click();
    await expect(drawer).not.toHaveClass(/open/);
  });

  /**
   * Scenario F: Full Ranking Modal
   * - Click "View Full Ranking" in Top Engaged Users.
   * - Assert Ranking Modal displays title "Top Engaged Users" and user handles.
   * - Close modal.
   */
  test('Scenario F: Full Ranking Modal - should display full ranking modal with handles and pagination', async ({ page }) => {
    const topUsersHeader = page.locator('.table-header-container', { hasText: /Top Engaged Users|エンゲージメント上位ユーザー/ });
    const topUsersContainer = topUsersHeader.locator('..');
    const viewFullRankingBtn = topUsersContainer.locator('.table-footer-btn');

    await viewFullRankingBtn.click();

    const modal = page.locator('app-ranking-modal .modal-container');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('.modal-title')).toContainText(/Top Engaged Users|エンゲージメント上位ユーザー/);

    const firstRankingRow = modal.locator('table.ranking-table tbody tr').first();
    await expect(firstRankingRow).toBeVisible();

    const labelCellText = (await firstRankingRow.locator('.label-cell').innerText()).trim();
    expect(labelCellText).toMatch(/^@?[a-zA-Z0-9_]+$/);

    const closeBtn = modal.locator('.modal-header .close-btn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Supporters & Tipping Management Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should render Supporters page with KPI metrics and 4-column ledger table', async ({ page }) => {
    // 0. Verify Topbar Breadcrumb displays Supporters title (not Dashboard)
    const breadcrumb = page.locator('.breadcrumb-current');
    await expect(breadcrumb).toBeVisible({ timeout: 15000 });
    await expect(breadcrumb).toHaveText(/Supporters|サポーター管理/);
    await expect(breadcrumb).not.toHaveText(/Dashboard|ダッシュボード/);

    // 1. Verify Header and KPI cards
    await expect(page.locator('.page-header h1').first()).toBeVisible({ timeout: 15000 });
    const kpiCards = page.locator('.kpi-card');
    await expect(kpiCards.first()).toBeVisible({ timeout: 10000 });
    expect(await kpiCards.count()).toBeGreaterThanOrEqual(4);

    // 2. Verify Table structure with 4 columns + chevron column
    const tableHeaders = page.locator('.data-table thead th');
    await expect(tableHeaders.first()).toBeVisible({ timeout: 10000 });
    expect(await tableHeaders.count()).toBe(5);

    // 3. Verify Table rows
    const rows = page.locator('.data-table tbody tr.clickable-row');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('should filter ledger by search query', async ({ page }) => {
    const searchInput = page.locator('.search-box input');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Search by supporter name
    await searchInput.fill('TechGeek');
    await page.waitForTimeout(500);

    const rows = page.locator('.data-table tbody tr.clickable-row');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.data-table tbody')).toContainText('TechGeek');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);
  });

  test('should open Transaction Detail Drawer without VIP or X handle and allow settings update', async ({ page }) => {
    const firstRow = page.locator('.data-table tbody tr.clickable-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // 1. Right drawer should open
    const rightDrawer = page.locator('app-right-drawer .right-drawer');
    await expect(rightDrawer).toHaveClass(/open/, { timeout: 5000 });

    // 2. Verify drawer does NOT contain nonexistent X handle or VIP tags
    const drawerText = await rightDrawer.innerText();
    expect(drawerText).not.toContain('Xアカウント');
    expect(drawerText).not.toContain('xHandle');
    expect(drawerText).not.toContain('VIP');

    // 3. Verify core transaction fields exist
    await expect(rightDrawer.locator('.detail-row', { hasText: /Stripe/i }).first()).toBeVisible();
    await expect(rightDrawer.locator('.tier-badge-large')).toBeVisible();

    // 4. Close drawer
    const closeBtn = rightDrawer.locator('.close-btn');
    await closeBtn.click();
    await expect(rightDrawer).not.toHaveClass(/open/, { timeout: 5000 });
  });

  test('should trigger AI Copilot with supporter context from Analyze button and restore drawer on close', async ({ page }) => {
    // 1. Open first transaction detail drawer
    const firstRow = page.locator('.data-table tbody tr.clickable-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    const rightDrawer = page.locator('app-right-drawer .right-drawer');
    await expect(rightDrawer).toHaveClass(/open/, { timeout: 5000 });

    // 2. Click Analyze (Copilot trigger) button
    const analyzeBtn = page.locator('app-right-drawer .sparkle-btn');
    await expect(analyzeBtn).toBeVisible({ timeout: 5000 });
    await analyzeBtn.click();

    // 3. Verify AI Drawer opens
    const aiDrawer = page.locator('.ai-drawer');
    await expect(aiDrawer).toHaveClass(/open/, { timeout: 5000 });

    // 4. Verify AI Drawer context shows Supporter entity
    const contextIndicator = page.locator('#ai-context-indicator');
    await expect(contextIndicator).toContainText(/Supporter/i, { timeout: 5000 });

    // 5. Verify RightDrawer has shifted class
    await expect(rightDrawer).toHaveClass(/shifted/, { timeout: 5000 });

    // 6. Close Copilot Drawer
    const aiCloseBtn = aiDrawer.locator('#ai-close-btn');
    await expect(aiCloseBtn).toBeVisible({ timeout: 5000 });
    await aiCloseBtn.click();

    // 7. Verify Copilot is closed and RightDrawer is smoothly un-shifted back
    await expect(aiDrawer).not.toHaveClass(/open/, { timeout: 5000 });
    await expect(rightDrawer).toBeVisible({ timeout: 5000 });
    await expect(rightDrawer).not.toHaveClass(/shifted/, { timeout: 5000 });

    // 8. Close detail drawer to finish
    await rightDrawer.locator('.close-btn').click();
    await expect(rightDrawer).not.toHaveClass(/open/, { timeout: 5000 });
  });

  test('should support mobile viewport layout and scrollable bottom navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');

    // 1. Bottom navigation exists on mobile
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 2. Thead is hidden on mobile and rows are rendered as card layout
    const thead = page.locator('.supporters-table thead');
    await expect(thead).toBeHidden();

    // 3. Supporter table cards are rendered for mobile
    const rows = page.locator('.data-table tbody tr.clickable-row');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });

  test('should verify mobile responsive layout without horizontal overflow and stacked action buttons', async ({ page }) => {
    // 1. Set mobile viewport (iPhone 14/15 size: 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');

    // 2. Topbar breadcrumb displays Supporters, not Dashboard
    const breadcrumb = page.locator('.breadcrumb-current');
    await expect(breadcrumb).toBeVisible({ timeout: 10000 });
    await expect(breadcrumb).toHaveText(/Supporters|サポーター管理/);

    // 3. Header action buttons are full-width stacked on mobile
    const headerActions = page.locator('.header-actions .btn');
    const actionCount = await headerActions.count();
    expect(actionCount).toBeGreaterThanOrEqual(1);
    const firstActionBox = await headerActions.first().boundingBox();
    expect(firstActionBox?.width).toBeGreaterThan(280);

    // 4. KPI cards are laid out in a 2-column grid
    const kpiGrid = page.locator('.kpi-grid');
    await expect(kpiGrid).toBeVisible();
    const kpiColumns = await kpiGrid.evaluate((el) => {
      const template = window.getComputedStyle(el).gridTemplateColumns;
      return template ? template.trim().split(/\s+/).length : 0;
    });
    expect(kpiColumns).toBe(2);

    // 5. Filter pills container has overflow-x auto / scroll enabled
    const filterPills = page.locator('.filter-pills');
    await expect(filterPills).toBeVisible();
    const overflowX = await filterPills.evaluate((el) => window.getComputedStyle(el).overflowX);
    expect(['auto', 'scroll']).toContain(overflowX);

    // 6. Supporter cards do not overflow screen width
    const firstCard = page.locator('.supporters-table tr.clickable-row').first();
    await expect(firstCard).toBeVisible();
    const cardBox = await firstCard.boundingBox();
    expect(cardBox?.width).toBeLessThanOrEqual(390);

    // 7. Verify no horizontal window overflow blowout
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should display Manual Resolution Modal with high z-index on top of Transaction Details drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');

    // 1. Wait for ledger rows to load and search for the seeded failed backer (RetroGamer88)
    const searchInput = page.locator('.search-box input');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('RetroGamer88');
    await page.waitForTimeout(600);

    // 2. Open the failed transaction row
    const failedRow = page.locator('.data-table tbody tr.clickable-row').first();
    await expect(failedRow).toBeVisible({ timeout: 10000 });
    await expect(failedRow).toContainText('RetroGamer88');
    await failedRow.click();

    // 3. Transaction Details drawer opens
    const rightDrawer = page.locator('app-right-drawer .right-drawer');
    await expect(rightDrawer).toHaveClass(/open/, { timeout: 5000 });

    // 4. Click Resolve Manually button inside the drawer
    const resolveBtn = rightDrawer.locator('button', { hasText: /Resolve Manually|手動解決/i });
    await expect(resolveBtn).toBeVisible({ timeout: 5000 });
    await resolveBtn.click();

    // 5. Verify modal backdrop is visible with z-index >= 2000 (above drawer z-index 1050)
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 5000 });
    const backdropZIndex = await modalBackdrop.evaluate((el) => window.getComputedStyle(el).zIndex);
    expect(parseInt(backdropZIndex, 10)).toBeGreaterThanOrEqual(2000);

    // 6. Verify modal content is rendered and visible on top
    const modalContent = modalBackdrop.locator('.modal-content');
    await expect(modalContent).toBeVisible();
    await expect(modalContent.locator('.modal-header h2')).toHaveText(/Manual Post Resolution|手動ポスト解決/i);
    await expect(modalContent.locator('textarea')).toBeVisible();

    // 7. Cancel modal and verify smooth return to open drawer
    const cancelBtn = modalContent.locator('.modal-footer .btn-secondary');
    await cancelBtn.click();
    await expect(modalBackdrop).toBeHidden();
    await expect(rightDrawer).toHaveClass(/open/);

    // 8. Clean up: close drawer
    await rightDrawer.locator('.close-btn').click();
    await expect(rightDrawer).not.toHaveClass(/open/);
  });

  test('should not display raw untranslated i18n keys or broken labels', async ({ page }) => {
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify container does not have untranslated template keys
    const pageText = await page.locator('.supporters-container').innerText();
    expect(pageText).not.toMatch(/supporters\.[a-z0-9_]+/i);
    expect(pageText).not.toMatch(/common\.[a-z0-9_]+/i);

    // 2. Open a transaction detail drawer and verify label translation
    const firstRow = page.locator('.data-table tbody tr.clickable-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    const rightDrawer = page.locator('app-right-drawer .right-drawer');
    await expect(rightDrawer).toHaveClass(/open/, { timeout: 5000 });

    const drawerText = await rightDrawer.innerText();
    expect(drawerText).not.toMatch(/supporters\.[a-z0-9_]+/i);
    expect(drawerText).not.toMatch(/common\.[a-z0-9_]+/i);

    // Close drawer
    await rightDrawer.locator('.close-btn').click();
    await expect(rightDrawer).not.toHaveClass(/open/);
  });

  test('should display English labels and tags when English language is selected', async ({ page }) => {
    // 1. Switch language to English via localStorage
    await page.evaluate(() => {
      localStorage.setItem('rebecca_lang', 'en');
    });
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');

    // 2. Header and KPIs in English
    await expect(page.locator('.page-title')).toHaveText('Supporters & Tipping Management');
    await expect(page.locator('.filter-pills button').first()).toHaveText('All');

    // 3. Status chips in English
    const completedChip = page.locator('.data-table .status-chip.completed').first();
    if (await completedChip.isVisible()) {
      await expect(completedChip).toContainText('Completed');
    }

    // 4. Open drawer and check English labels
    const firstRow = page.locator('.data-table tbody tr.clickable-row').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    const rightDrawer = page.locator('app-right-drawer .right-drawer');
    await expect(rightDrawer).toHaveClass(/open/, { timeout: 5000 });
    await expect(rightDrawer.locator('.section-heading', { hasText: 'Stripe Payment Info' })).toBeVisible();
    await expect(rightDrawer.locator('.detail-label', { hasText: 'Transaction ID' })).toBeVisible();

    // Verify no leaked Japanese text in drawer
    const drawerText = await rightDrawer.innerText();
    expect(drawerText).not.toContain('公開停止');
    expect(drawerText).not.toContain('サポーター名');
    expect(drawerText).not.toContain('決済情報');

    // Close drawer
    await rightDrawer.locator('.close-btn').click();
    await expect(rightDrawer).not.toHaveClass(/open/);

    // 5. Open Manual Entry Modal and verify English labels without Japanese leakage
    const manualEntryBtn = page.locator('.header-actions .btn-primary');
    await manualEntryBtn.click();
    const modalContent = page.locator('.modal-backdrop .modal-content');
    await expect(modalContent).toBeVisible();
    const modalText = await modalContent.innerText();
    expect(modalText).toContain('Import Stripe Checkout Manually');
    expect(modalText).not.toContain('Stripe決済の手動取り込み');
    expect(modalText).not.toContain('(必須)');
    expect(modalText).not.toContain('名無しマスター');
    await modalContent.locator('.modal-footer .btn-secondary').click();
    await expect(page.locator('.modal-backdrop')).toBeHidden();

    // 6. Restore default ja for other tests
    await page.evaluate(() => {
      localStorage.setItem('rebecca_lang', 'ja');
    });
  });

  test('should open rewards catalog and open full-size image in Lightbox on click', async ({ page }) => {
    // 1. Open Rewards Catalog Modal
    const rewardsBtn = page.locator('.header-actions .btn-secondary');
    await expect(rewardsBtn).toBeVisible({ timeout: 10000 });
    await rewardsBtn.click();

    const rewardsModal = page.locator('.modal-content.modal-lg');
    await expect(rewardsModal).toBeVisible({ timeout: 5000 });

    // 2. Click the zoom button on the first reward card
    const zoomBtn = page.locator('.reward-card .btn-icon-only').first();
    if (await zoomBtn.isVisible()) {
      await zoomBtn.click();

      // 3. Verify Lightbox opens on top with master image URL
      const lightbox = page.locator('app-lightbox .lightbox-overlay.open');
      await expect(lightbox).toBeVisible({ timeout: 5000 });
      const img = page.locator('app-lightbox .image-container img');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('src', /type=master/);

      // 4. Close Lightbox via close button
      await page.locator('app-lightbox .close-btn').click();
      await expect(lightbox).toBeHidden();
      await expect(rewardsModal).toBeVisible();
    }

    // 5. Close rewards modal
    await rewardsModal.locator('.modal-footer .btn-secondary').click();
    await expect(rewardsModal).toBeHidden();
  });
  test('should verify streamlined UI with no redundant subtitle or alert description and filter by alert button', async ({ page }) => {
    // 1. Verify header does not contain redundant subtitle
    await expect(page.locator('.page-header .page-title')).toBeVisible({ timeout: 10000 });
    const subtitle = page.locator('.page-header .page-subtitle');
    expect(await subtitle.count()).toBe(0);

    // 2. Verify failure alert banner does not contain verbose alert description
    const alertBanner = page.locator('.alert-banner.failure');
    if (await alertBanner.isVisible()) {
      const alertDesc = alertBanner.locator('.alert-desc');
      expect(await alertDesc.count()).toBe(0);

      // Verify title is visible and cleanly aligned
      const alertTitle = alertBanner.locator('.alert-title');
      await expect(alertTitle).toBeVisible();

      // 3. Click alert action button to filter by failed
      const alertActionBtn = alertBanner.locator('.alert-action-btn');
      await expect(alertActionBtn).toBeVisible();
      await alertActionBtn.click();

      // 4. Verify failed filter pill is now active
      const failedPill = page.locator('.filter-pills button', { hasText: /Failed Only|失敗のみ/i });
      await expect(failedPill).toHaveClass(/active/);

      // 5. Reset back to All filter (first pill)
      const allPill = page.locator('.filter-pills button').first();
      await allPill.click();
      await expect(allPill).toHaveClass(/active/);
    }
  });

  test('should open Manual Stripe Checkout Import Modal and test validations, input handling, and cancellation', async ({ page }) => {
    // 1. Click Manual Entry button in header
    const manualEntryBtn = page.locator('.header-actions .btn-primary');
    await expect(manualEntryBtn).toBeVisible({ timeout: 10000 });
    await manualEntryBtn.click();

    // 2. Verify modal opens
    const modalBackdrop = page.locator('.modal-backdrop');
    await expect(modalBackdrop).toBeVisible({ timeout: 5000 });
    const modalContent = modalBackdrop.locator('.modal-content');
    await expect(modalContent.locator('.modal-header h2')).toHaveText(/Import Stripe Checkout|Stripe決済の手動取り込み/i);

    // 3. Verify session ID input is auto-generated with cs_manual_ prefix
    const sessionInput = modalContent.locator('input[placeholder="cs_live_..."]');
    await expect(sessionInput).toBeVisible();
    const sessionIdVal = await sessionInput.inputValue();
    expect(sessionIdVal).toMatch(/^cs_manual_\d+$/);

    // 4. Verify submit button is enabled initially
    const submitBtn = modalContent.locator('.modal-footer .btn-primary');
    await expect(submitBtn).toBeEnabled();

    // 5. Clear session ID -> submit button should become disabled
    await sessionInput.fill('');
    await expect(submitBtn).toBeDisabled();

    // 6. Restore session ID -> submit button should become enabled again
    await sessionInput.fill(sessionIdVal);
    await expect(submitBtn).toBeEnabled();

    // 7. Verify supporter name input
    const nameInput = modalContent.locator('.form-group input').nth(1);
    await expect(nameInput).toBeVisible();

    // 8. Close modal via Cancel button
    const cancelBtn = modalContent.locator('.modal-footer .btn-secondary');
    await cancelBtn.click();
    await expect(modalBackdrop).toBeHidden();
  });

  test('should filter ledger by plan tier (All Tiers, Gold, Silver, Bronze)', async ({ page }) => {
    const tierSelect = page.locator('.toolbar select.form-select');
    await expect(tierSelect).toBeVisible({ timeout: 10000 });

    // 1. Select Silver tier
    await tierSelect.selectOption('silver');
    await page.waitForTimeout(500);
    const rows = page.locator('.data-table tbody tr.clickable-row');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      for (let i = 0; i < Math.min(rowCount, 3); i++) {
        const rowText = await rows.nth(i).innerText();
        expect(rowText.toUpperCase()).toMatch(/SILVER|シルバー|1,000|1,500/);
      }
    }

    // 2. Select Bronze tier
    await tierSelect.selectOption('bronze');
    await page.waitForTimeout(500);
    const bronzeCount = await rows.count();
    if (bronzeCount > 0) {
      for (let i = 0; i < Math.min(bronzeCount, 3); i++) {
        const rowText = await rows.nth(i).innerText();
        expect(rowText.toUpperCase()).toMatch(/BRONZE|ブロンズ|500|300/);
      }
    }

    // 3. Reset back to all tiers
    await tierSelect.selectOption('all');
    await page.waitForTimeout(500);
  });

  test('should verify Lightbox modal dismiss via Escape key and backdrop click', async ({ page }) => {
    // 1. Open rewards modal
    const rewardsBtn = page.locator('.header-actions .btn-secondary');
    await expect(rewardsBtn).toBeVisible({ timeout: 10000 });
    await rewardsBtn.click();

    const rewardsModal = page.locator('.modal-content.modal-lg');
    await expect(rewardsModal).toBeVisible({ timeout: 5000 });

    // 2. Click thumbnail directly on first reward card
    const rewardThumbnail = page.locator('.reward-card .reward-preview').first();
    if (await rewardThumbnail.isVisible()) {
      await rewardThumbnail.click();

      // Verify Lightbox opens
      const lightbox = page.locator('app-lightbox .lightbox-overlay.open');
      await expect(lightbox).toBeVisible({ timeout: 5000 });

      // Dismiss with Escape key
      await page.keyboard.press('Escape');
      await expect(lightbox).toBeHidden();
      await expect(rewardsModal).toBeVisible();

      // Open again via zoom button
      const zoomBtn = page.locator('.reward-card .btn-icon-only').first();
      await expect(zoomBtn).toBeVisible({ timeout: 5000 });
      await zoomBtn.click();
      await expect(lightbox).toBeVisible({ timeout: 5000 });

      // Dismiss with backdrop click (clicking upper left padding of lightbox)
      await lightbox.click({ position: { x: 10, y: 10 } });
      await expect(lightbox).toBeHidden();
      await expect(rewardsModal).toBeVisible();
    }

    // Close rewards modal
    await rewardsModal.locator('.modal-footer .btn-secondary').click();
    await expect(rewardsModal).toBeHidden();
  });
});

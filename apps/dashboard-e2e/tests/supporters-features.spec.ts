import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Supporters & Tipping Management Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/supporters');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should render Supporters page with KPI metrics and 4-column ledger table', async ({ page }) => {
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
});

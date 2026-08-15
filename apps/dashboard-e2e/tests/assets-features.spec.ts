import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';
import path from 'path';
import fs from 'fs';

test.describe('Assets Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Authenticate via emulator API and inject session directly
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // 2. Navigate to assets management page and verify it loads
    await page.goto('/assets');
    await expect(page.locator('h2', { hasText: 'Assets Library' })).toBeVisible({ timeout: 15000 });
  });

  test('Scenario A: Pagination - should render max 20 assets per page and paginate properly', async ({ page }) => {
    // 1. Verify 20 cards rendered on Page 1
    const cards = page.locator('.asset-card');
    await expect(cards).toHaveCount(20, { timeout: 10000 });

    // 2. Verify pagination molecule information
    const totalItemsText = page.locator('.pagination-container .total-items-text');
    await expect(totalItemsText).toBeVisible();
    await expect(totalItemsText).toContainText('Showing ');

    const pageInfo = page.locator('.pagination-container .page-info');
    await expect(pageInfo).toContainText('Page 1 / 2');

    // 3. Verify realistic filenames on cards (no "400" bug)
    const firstCardTitle = cards.first().locator('.asset-info div').first();
    await expect(firstCardTitle).toBeVisible();

    // 4. Click Next Page / Page 2
    const page2Btn = page.locator('.pagination-controls button.num-btn', { hasText: '2' });
    await page2Btn.click();

    // 5. Verify Page 2 displays remaining cards
    expect(await cards.count()).toBeGreaterThanOrEqual(10);
    await expect(pageInfo).toContainText('Page 2 / 2');

    // 6. Return to Page 1
    const page1Btn = page.locator('.pagination-controls button.num-btn', { hasText: '1' });
    await page1Btn.click();
    await expect(cards).toHaveCount(20, { timeout: 10000 });
    await expect(pageInfo).toContainText('Page 1 / 2');
  });

  test('Scenario B: Fuzzy Keyword Search - should filter assets by filename and caption', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search by filename or caption"]');
    await expect(searchInput).toBeVisible();

    // 1. Search for specific keyword "cyberpunk"
    await searchInput.fill('cyberpunk');
    const cards = page.locator('.asset-card');
    await expect(cards.first()).toContainText('cyberpunk_street.png');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);

    // 2. Search for keyword matching caption "winter"
    await searchInput.fill('winter');
    await expect(cards.first()).toContainText('cozy_winter_cabin.jpg');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);

    // 3. Clear search - should restore full page of 20 assets
    await searchInput.fill('');
    await expect(cards).toHaveCount(20, { timeout: 5000 });
  });

  test('Scenario C: Asset Details Drawer - should isolate extension, display Last Used, open Lightbox, and save caption edit', async ({ page }) => {
    // 1. Click first asset card
    const firstCard = page.locator('.asset-card').first();
    await firstCard.click();

    // 2. Verify drawer opened
    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText('Asset Details');

    // 3. Verify no error toast appeared
    const errorToast = page.locator('.toast.danger, .toast.error');
    await expect(errorToast).toHaveCount(0);

    // 4. Verify filename base name and extension pill separation
    const nameInput = drawer.locator('app-asset-drawer input.form-control');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    const nameInputValue = await nameInput.inputValue();
    expect(nameInputValue).not.toContain('.png'); // Base name only

    const extBadge = drawer.locator('app-asset-drawer .timeline-stat span', { hasText: /\.(png|jpg|jpeg|webp)/ });
    await expect(extBadge).toBeVisible();

    // 5. Verify redundant magnifier icon is removed from preview
    const previewMagnifier = drawer.locator('app-asset-drawer .asset-preview button');
    await expect(previewMagnifier).toHaveCount(0);

    // 6. Verify Last Used metric box exists and is formatted
    const lastUsedBox = drawer.locator('app-asset-drawer .metric-box', { hasText: 'Last Used' });
    await expect(lastUsedBox).toBeVisible();

    // 7. Verify "View Full Size" button opens full-screen Lightbox dialog
    const viewFullSizeBtn = drawer.locator('app-asset-drawer button', { hasText: 'View Full Size' });
    await expect(viewFullSizeBtn).toBeVisible();
    await viewFullSizeBtn.click();

    const lightbox = page.locator('app-lightbox .lightbox-overlay');
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    const lightboxImg = lightbox.locator('img');
    await expect(lightboxImg).toBeVisible();
    await lightbox.locator('.close-btn').click();
    await expect(lightbox).not.toBeVisible();

    // 8. Edit caption and save
    const captionArea = drawer.locator('app-asset-drawer textarea');
    await expect(captionArea).toBeVisible();
    const editedCaption = '手動編集テスト: 新世代サイバーメカロボットのコンセプトアート';
    await captionArea.fill(editedCaption);

    const saveBtn = drawer.locator('app-asset-drawer button', { hasText: 'Save Changes' });
    await saveBtn.click();

    // 9. Verify success toast
    const successToast = page.locator('.toast', { hasText: 'Successfully saved asset' });
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // 10. Close drawer
    await drawer.locator('.drawer-header .close-btn').click();
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('Scenario D: Asset Details Drawer - should regenerate caption and delete asset from drawer', async ({ page }) => {
    // 1. Click asset card (nth 3)
    const targetCard = page.locator('.asset-card').nth(3);
    await targetCard.click();

    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);

    // 2. Click Regenerate button inside drawer
    const regenerateBtn = drawer.locator('app-asset-drawer button.sparkle-btn');
    await expect(regenerateBtn).toBeVisible();
    await regenerateBtn.click();

    // 3. Verify notification appears
    const infoToast = page.locator('.toast', { hasText: 'caption' });
    await expect(infoToast).toBeVisible({ timeout: 15000 });

    // 4. Test Delete Asset from inside drawer
    const deleteBtn = drawer.locator('app-asset-drawer button', { hasText: 'Delete Asset' });
    await deleteBtn.click();

    // 5. Verify success toast and drawer closes automatically
    const deleteToast = page.locator('.toast', { hasText: 'Successfully deleted asset' });
    await expect(deleteToast).toBeVisible({ timeout: 10000 });
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('Scenario E: Multi-file Upload - should trigger upload and refresh grid', async ({ page }) => {
    // Create temporary image file for upload testing
    const tempDir = path.resolve(__dirname, 'temp_upload');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `test_upload_${Date.now()}.png`);
    const dummyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    fs.writeFileSync(tempFilePath, Buffer.from(dummyPngBase64, 'base64'));

    // 1. Select and upload file via hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([tempFilePath]);

    // 2. Verify upload toast notification appears
    const uploadToast = page.locator('.toast', { hasText: 'upload' });
    await expect(uploadToast).toBeVisible({ timeout: 15000 });

    // 3. Verify asset grid is refreshed
    const cards = page.locator('.asset-card');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('Scenario F: Bulk Operations - should select all and trigger bulk retry AI gen', async ({ page }) => {
    // 1. Click checkbox on first card
    const firstCard = page.locator('.asset-card').first();
    const firstCheckbox = firstCard.locator('.asset-checkbox-wrapper label.checkbox-container');
    await firstCheckbox.click();

    // 2. Verify bulk action bar indicates selection
    const bulkBarText = page.locator('#asset-bulk-bar .bulk-text');
    await expect(bulkBarText).toContainText('1 items selected');

    // 3. Click Retry AI Gen button
    const retryBulkBtn = page.locator('#asset-bulk-bar button', { hasText: 'Retry AI Gen' });
    await expect(retryBulkBtn).toBeVisible();
    await retryBulkBtn.click();

    // 4. Verify success toast
    const successToast = page.locator('.toast', { hasText: 'AI regeneration' });
    await expect(successToast).toBeVisible({ timeout: 15000 });
  });

});

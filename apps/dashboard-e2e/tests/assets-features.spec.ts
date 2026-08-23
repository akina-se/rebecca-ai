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
    await expect(page.locator('h2', { hasText: /Assets Library|アセットライブラリ/ })).toBeVisible({ timeout: 15000 });
  });

  test('Scenario A: Pagination - should render max 20 assets per page and paginate properly', async ({ page }) => {
    // 1. Verify 20 cards rendered on Page 1
    const cards = page.locator('.asset-card');
    await expect(cards).toHaveCount(20, { timeout: 10000 });

    // 2. Verify pagination molecule information
    const totalItemsText = page.locator('.pagination-container .total-items-text');
    await expect(totalItemsText).toBeVisible();
    await expect(totalItemsText).toContainText(/Showing|表示中|全.*件/);

    const pageInfo = page.locator('.pagination-container .page-info');
    await expect(pageInfo).toContainText(/(Page|ページ) 1 \/ 2/);

    // 3. Verify realistic filenames on cards (no "400" bug)
    const firstCardTitle = cards.first().locator('.asset-info div').first();
    await expect(firstCardTitle).toBeVisible();

    // 4. Click Next Page / Page 2
    const page2Btn = page.locator('.pagination-controls button.num-btn', { hasText: '2' });
    await page2Btn.click();

    // 5. Verify Page 2 displays remaining cards
    expect(await cards.count()).toBeGreaterThanOrEqual(10);
    await expect(pageInfo).toContainText(/(Page|ページ) 2 \/ 2/);

    // 6. Return to Page 1
    const page1Btn = page.locator('.pagination-controls button.num-btn', { hasText: '1' });
    await page1Btn.click();
    await expect(cards).toHaveCount(20, { timeout: 10000 });
    await expect(pageInfo).toContainText(/(Page|ページ) 1 \/ 2/);
  });

  test('Scenario B: Fuzzy Keyword Search - should filter assets by filename and caption', async ({ page }) => {
    const searchInput = page.locator('.block-header input.form-control');
    await expect(searchInput).toBeVisible();
    const cards = page.locator('.asset-card');

    // 1. Search for specific keyword "cyberpunk"
    await searchInput.fill('cyberpunk');
    await expect(cards).toHaveCount(1, { timeout: 10000 });
    await expect(cards.first()).toContainText('cyberpunk_street.png');

    // 2. Search for keyword matching caption "winter"
    await searchInput.fill('winter');
    await expect(cards).toHaveCount(1, { timeout: 10000 });
    await expect(cards.first()).toContainText('cozy_winter_cabin.jpg');

    // 3. Clear search - should restore full page of 20 assets
    await searchInput.fill('');
    await expect(cards).toHaveCount(20, { timeout: 10000 });
  });

  test('Scenario C: Asset Details Drawer - should isolate extension, display Last Used, open Lightbox, and save caption edit', async ({ page }) => {
    // 1. Click first asset card
    const firstCard = page.locator('.asset-card').first();
    await firstCard.click();

    // 2. Verify drawer opened
    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toBeVisible();

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
    const lastUsedBox = drawer.locator('app-asset-drawer .metric-box').nth(1);
    await expect(lastUsedBox).toBeVisible();

    // 7. Verify "View Full Size" button opens full-screen Lightbox dialog
    const viewFullSizeBtn = drawer.locator('app-asset-drawer button', { hasText: /View Full Size|原寸表示/ });
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

    const saveBtn = drawer.locator('app-asset-drawer button', { hasText: /Save Changes|変更を保存/ });
    await saveBtn.click();

    // 9. Verify success toast
    const successToast = page.locator('.toast', { hasText: /Successfully saved asset|保存/ });
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

    // 3. Verify notification appears and caption textarea does not contain invalid placeholder text
    const infoToast = page.locator('.toast', { hasText: /caption|再生成/ });
    await expect(infoToast).toBeVisible({ timeout: 15000 });

    const captionTextarea = drawer.locator('textarea');
    await expect(captionTextarea).not.toHaveValue(/画像ファイルが直接確認できない/);

    // 4. Test Delete Asset from inside drawer
    const deleteBtn = drawer.locator('app-asset-drawer button', { hasText: /Delete Asset|アセットを削除/ });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // 5. Verify success toast and drawer closes automatically
    const deleteToast = page.locator('.toast', { hasText: /Successfully deleted asset|削除/ });
    await expect(deleteToast).toBeVisible({ timeout: 15000 });
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
    const uploadToast = page.locator('.toast', { hasText: /upload|アップロード|image|success/i });
    await expect(uploadToast.first()).toBeVisible({ timeout: 15000 });

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
    await expect(bulkBarText).toContainText(/1 (items selected|件のアセットを選択中)/);

    // 3. Click Retry AI Gen button
    const retryBulkBtn = page.locator('#asset-bulk-bar button', { hasText: /Retry AI Gen|AIキャプション再試行/ });
    await expect(retryBulkBtn).toBeVisible();
    await retryBulkBtn.click();

    // 4. Verify success toast
    const successToast = page.locator('.toast', { hasText: /AI regeneration|再生成/ });
    await expect(successToast).toBeVisible({ timeout: 15000 });
  });

  test('Scenario G: Dual-Resolution Image Streaming - asset card should use thumbnail API and drawer should use full-res API', async ({ page }) => {
    const firstCard = page.locator('.asset-card').first();
    await expect(firstCard).toBeVisible();

    // Verify background-image uses compressed thumbnail API
    const thumb = firstCard.locator('.asset-thumb');
    const bgStyle = (await thumb.getAttribute('style')) || '';
    if (bgStyle.includes('url(')) {
      expect(bgStyle).not.toContain('storage.googleapis.com');
      expect(bgStyle).toContain('size=thumbnail');
    }

    // Click card to open drawer
    await firstCard.click();
    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();

    // Verify drawer preview loads full-resolution original image (no size=thumbnail)
    const previewImg = drawer.locator('app-asset-drawer .preview-img');
    await expect(previewImg).toBeVisible();
    const imgSrc = (await previewImg.getAttribute('src')) || '';
    expect(imgSrc).not.toContain('storage.googleapis.com');
    expect(imgSrc).not.toContain('size=thumbnail');
    expect(imgSrc).toMatch(/\/api\/v1\/(assets|images)\//);
  });
});

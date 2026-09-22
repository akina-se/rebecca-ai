import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(__dirname, '../artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

test.describe('Campaign Full End-to-End User Flow Verification', () => {
  test('Complete lifecycle: List -> Create -> Edit/Upload -> List Verification -> Clone -> Delete', async ({ page }) => {
    test.setTimeout(90000);

    page.on('console', (msg) => console.log('[BROWSER LOG]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[BROWSER ERROR]', err));

    // 1. Authenticate via emulator
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // 2. Navigate to campaigns list
    await page.goto('/campaigns');
    await expect(page.locator('.view-header h1')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_01_campaign_list.png'), fullPage: true });

    // 3. Click "+ New Campaign" button to open editor
    const newBtn = page.locator('.view-header .btn-primary');
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await page.waitForURL('**/campaigns/new', { timeout: 15000 });
    await expect(page.locator('.editor-heading h2')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_02_campaign_editor_empty.png'), fullPage: true });

    // 4. Fill Campaign Title & Period & Context Layers with unique future dates
    const uniqueId = Date.now().toString().slice(-6);
    const title = `Akihabara Tech Arc ${uniqueId}`;
    const titleInput = page.locator('input.form-input').first();
    await titleInput.fill(title);

    const descTextarea = page.locator('textarea.form-textarea').first();
    await descTextarea.fill('Special episodic storyline exploring Akihabara retro arcades and tech shops with Rebecca.');

    // Compute unique future dates to prevent 409 Date Overlap Conflict
    const offsetDays = (parseInt(uniqueId, 10) % 500) + 100;
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    const endDateObj = new Date(baseDate);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);

    const startDateStr = baseDate.toISOString().slice(0, 10);
    const endDateStr = endDateObj.toISOString().slice(0, 10);

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await startDateInput.fill(startDateStr);
    await endDateInput.fill(endDateStr);

    // Step 1: Create draft and proceed to Step 2 (Progressive Disclosure)
    const createBtn = page.locator('.step1-bottom-bar button.btn-primary');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();
    await expect(page).toHaveURL(/\/campaigns\/camp_/, { timeout: 15000 });

    // Fill Context Layers
    const masterContext = page.locator('.form-grid textarea.form-textarea').nth(1);
    await masterContext.fill('Master narrative context: Rebecca is exploring retro electronics in Akihabara.');

    const replyContext = page.locator('.form-grid textarea.form-textarea').nth(2);
    await replyContext.fill('Reply context: Show enthusiasm for retro gaming consoles and maid cafe snacks.');

    // 5. Configure Itinerary Slots
    const slotCards = page.locator('app-itinerary-slot-card');
    await expect(slotCards.first()).toBeVisible({ timeout: 10000 });

    // Slot 1: Fixed text mode
    const firstCard = slotCards.first();
    const fixedModeBtn = firstCard.locator('.mode-btn', { hasText: /Fixed Text|固定テキスト/ });
    await fixedModeBtn.click();
    await firstCard.locator('textarea.form-textarea').fill('Good morning from Akihabara station! Heading to Radio Kaikan.');

    // Slot 2: Toggle Skip
    const secondCard = slotCards.nth(1);
    const skipBtn = secondCard.locator('.status-badge');
    await skipBtn.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_03_campaign_editor_filled.png'), fullPage: true });

    // 6. Save as Draft
    const saveDraftBtn = page.locator('.topbar-actions button.btn-secondary');
    await saveDraftBtn.click();

    // Wait for redirect to /campaigns
    await page.waitForURL('**/campaigns', { timeout: 20000 });
    await page.waitForTimeout(1000);

    // 7. Verify the created campaign is listed
    const campaignRow = page.locator('.campaign-row', { hasText: title });
    await expect(campaignRow).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_04_campaign_created_in_list.png'), fullPage: true });

    // 8. Open the created campaign to test image upload
    await campaignRow.locator('.btn-icon', { hasText: 'edit' }).click();
    await page.waitForURL('**/campaigns/**', { timeout: 15000 });
    await expect(page.locator('.editor-heading h2')).toBeVisible();

    // Attach sample image to Slot 1
    const slot1 = page.locator('app-itinerary-slot-card').first();
    await expect(slot1).toBeVisible({ timeout: 20000 });

    const uploadBtn = slot1.locator('.upload-btn');
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.resolve(__dirname, '../test-assets/sample.png'));

    // Wait for image thumbnail preview to appear
    const thumbPreview = slot1.locator('.attached-media-preview');
    await expect(thumbPreview).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05_campaign_image_uploaded.png'), fullPage: true });

    // Save changes
    const saveBtn = page.locator('.topbar-actions button.btn-secondary');
    await saveBtn.click();
    await page.waitForURL('**/campaigns', { timeout: 20000 });

    // 9. Test Campaign Clone
    const targetRow = page.locator('.campaign-row', { hasText: title });
    await expect(targetRow).toBeVisible();
    const cloneBtn = targetRow.locator('.btn-icon', { hasText: 'content_copy' });
    await cloneBtn.click();

    const cloneModal = page.locator('.modal-backdrop');
    await expect(cloneModal).toBeVisible();

    // Set clone start and end date (30 days after original end date)
    const cloneStartObj = new Date(endDateObj);
    cloneStartObj.setUTCDate(cloneStartObj.getUTCDate() + 30);
    const cloneEndObj = new Date(cloneStartObj);
    cloneEndObj.setUTCDate(cloneEndObj.getUTCDate() + 1);

    const cloneStartDate = cloneModal.locator('input[type="date"]').first();
    const cloneEndDate = cloneModal.locator('input[type="date"]').nth(1);
    await cloneStartDate.fill(cloneStartObj.toISOString().slice(0, 10));
    await cloneEndDate.fill(cloneEndObj.toISOString().slice(0, 10));

    const confirmCloneBtn = cloneModal.locator('button.btn-primary');
    await confirmCloneBtn.click();

    // Frontend router navigates to newly cloned campaign editor
    await page.waitForURL('**/campaigns/**', { timeout: 15000 });
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_06_campaign_cloned_editor.png'), fullPage: true });

    // Return to /campaigns list to verify cloned entry alongside original
    await page.goto('/campaigns');
    await expect(page.locator('.view-header h1')).toBeVisible({ timeout: 15000 });
    const clonedRow = page.locator('.campaign-row', { hasText: `Copy of ${title}` });
    await expect(clonedRow).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_06_campaign_cloned.png'), fullPage: true });

    // 10. Test Campaign Deletion of Cloned Campaign
    const clonedDeleteBtn = clonedRow.locator('.btn-icon-danger');
    await clonedDeleteBtn.click();

    const deleteModal = page.locator('.modal-card-danger');
    await expect(deleteModal).toBeVisible();
    const confirmDeleteBtn = deleteModal.locator('button.btn-danger');
    await confirmDeleteBtn.click();

    // Verify cloned row disappears
    await expect(clonedRow).toBeHidden({ timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_07_campaign_deleted.png'), fullPage: true });

    // Clean up original campaign
    const originalRow = page.locator('.campaign-row', { hasText: title });
    await originalRow.locator('.btn-icon-danger').click();
    await expect(deleteModal).toBeVisible();
    await confirmDeleteBtn.click();
    await expect(originalRow).toBeHidden({ timeout: 15000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_08_final_clean_state.png'), fullPage: true });
  });
});

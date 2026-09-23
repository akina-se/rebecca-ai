import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(__dirname, '../../test-artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

test.describe('Campaign Full End-to-End User Flow Verification', () => {
  test('Complete lifecycle: List -> Create -> Edit/Upload -> Reload Persistence -> Schedule -> Save Changes -> Revert to Draft -> Clone -> Delete', async ({ page }) => {
    test.setTimeout(120000);

    page.on('console', (msg) => console.log(`[BROWSER LOG] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err}`));
    page.on('dialog', (dialog) => {
      console.log(`[BROWSER DIALOG] ${dialog.type()}: ${dialog.message()}`);
      dialog.accept();
    });

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

    // Compute unique future dates in year 2035 to ensure top of Page 1 and prevent 409 Conflict
    const baseDate = new Date();
    baseDate.setFullYear(2035);
    baseDate.setUTCMonth(5);
    baseDate.setUTCDate(1 + (parseInt(uniqueId, 10) % 20));
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

    // 6. Test Atomic Image Upload & Browser Reload Persistence (Zero Zombie Guarantee)
    const fileInput1 = firstCard.locator('input[type="file"]');
    await fileInput1.setInputFiles(path.resolve(__dirname, '../test-assets/sample.png'));

    // Wait for image thumbnail preview to appear
    const thumbPreview = firstCard.locator('.attached-media-preview');
    await expect(thumbPreview).toBeVisible({ timeout: 15000 });
    const thumbImg = thumbPreview.locator('img.media-thumb');
    await expect(thumbImg).toBeVisible();
    expect(await thumbImg.getAttribute('src')).toContain('size=thumbnail');
    await firstCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05_campaign_image_uploaded.png') });

    // RELOAD browser page directly WITHOUT clicking save!
    // The image must remain intact because it is atomically saved to Firestore on upload!
    await page.reload();
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });
    const reloadedFirstCard = page.locator('app-itinerary-slot-card').first();
    await expect(reloadedFirstCard).toBeVisible({ timeout: 10000 });
    const reloadedThumbPreview = reloadedFirstCard.locator('.attached-media-preview');
    await expect(reloadedThumbPreview).toBeVisible({ timeout: 15000 });
    const reloadedThumbImg = reloadedThumbPreview.locator('img.media-thumb');
    await expect(reloadedThumbImg).toBeVisible();
    await reloadedFirstCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05_campaign_image_persisted_after_reload.png') });

    // 6b. Test Lightbox Open on Thumbnail Click
    await reloadedThumbPreview.click();
    const lightbox = page.locator('app-lightbox .lightbox-overlay');
    await expect(lightbox).toBeVisible({ timeout: 10000 });
    const lightboxImg = lightbox.locator('.image-container img');
    await expect(lightboxImg).toBeVisible({ timeout: 10000 });
    expect(await lightboxImg.getAttribute('src')).toContain('size=full');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05b_campaign_lightbox_open.png') });

    // 6c. Close Lightbox
    const closeLightboxBtn = lightbox.locator('.close-btn');
    await closeLightboxBtn.click();
    await expect(lightbox).toBeHidden({ timeout: 5000 });

    // 6d. Test Image Deletion (Atomic GCS Purge & Firestore Reset)
    const deleteMediaBtn = reloadedFirstCard.locator('.btn-delete-media');
    await expect(deleteMediaBtn).toBeVisible({ timeout: 5000 });
    await deleteMediaBtn.click();

    // Verify thumbnail is removed and upload button is restored
    await expect(reloadedThumbPreview).toBeHidden({ timeout: 10000 });
    const restoredUploadBtn = reloadedFirstCard.locator('.upload-btn');
    await expect(restoredUploadBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05c_campaign_image_deleted.png') });

    // Re-upload image so campaign has an asset for scheduling & clone
    await reloadedFirstCard.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, '../test-assets/sample.png'));
    await expect(reloadedFirstCard.locator('.attached-media-preview')).toBeVisible({ timeout: 15000 });

    // Refill Context Layers that were reset during browser reload before scheduling
    const masterContextPostReload = page.locator('.form-grid textarea.form-textarea').nth(1);
    await masterContextPostReload.fill('Master narrative context: Rebecca is exploring retro electronics in Akihabara.');
    const replyContextPostReload = page.locator('.form-grid textarea.form-textarea').nth(2);
    await replyContextPostReload.fill('Reply context: Show enthusiasm for retro gaming consoles and maid cafe snacks.');

    // 7. Test Transition to Scheduled Status & State-Driven Topbar Actions
    // In draft status: buttons must be [削除] [下書き保存] [配信スケジュール登録]
    const scheduleBtn = page.locator('.topbar-actions button').filter({ hasText: /スケジュール確定|Schedule Campaign/ });
    await expect(scheduleBtn).toBeVisible();
    await scheduleBtn.click();

    // Wait for redirect to /campaigns
    await page.waitForURL('**/campaigns', { timeout: 20000 });
    await page.waitForTimeout(1000);

    // Verify the created campaign is listed with scheduled status
    const campaignRow = page.locator('.campaign-row', { hasText: title });
    await expect(campaignRow).toBeVisible({ timeout: 15000 });
    await expect(campaignRow.locator('.badge-scheduled')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_04_campaign_created_in_list.png'), fullPage: true });

    // 8. Re-open the scheduled campaign and verify State-Driven Action Bar
    await campaignRow.locator('.btn-icon', { hasText: 'edit' }).click();
    await page.waitForURL('**/campaigns/**', { timeout: 15000 });
    await expect(page.locator('.editor-heading h2')).toBeVisible();

    // Verify "変更を保存" (Save Changes) and "下書きに戻す" (Revert to Draft) appear!
    const saveChangesBtn = page.locator('.topbar-actions button').filter({ hasText: /変更を保存|Save Changes/ });
    const revertToDraftBtn = page.locator('.topbar-actions button').filter({ hasText: /下書きに戻す|Revert to Draft/ });
    await expect(saveChangesBtn).toBeVisible({ timeout: 10000 });
    await expect(revertToDraftBtn).toBeVisible({ timeout: 10000 });

    // Verify old "配信スケジュール登録" and "下書き保存" are NOT visible
    await expect(page.locator('.topbar-actions button').filter({ hasText: /スケジュール確定|Schedule Campaign/ })).toBeHidden();
    await expect(page.locator('.topbar-actions button').filter({ hasText: /下書き保存|Save as Draft/ })).toBeHidden();

    // Verify Pause toggle is available
    const pauseBtn = page.locator('.topbar-actions button').filter({ hasText: /一時停止|Pause/ });
    await expect(pauseBtn).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05d_campaign_scheduled_action_bar.png'), fullPage: true });

    // 8a. Test "変更を保存" (Save Changes) keeps scheduled status
    const descInputInEdit = page.locator('textarea.form-textarea').first();
    await descInputInEdit.fill('Updated narrative context: Exploring Radio Kaikan with Rebecca in Akihabara.');
    await saveChangesBtn.click();
    await page.waitForURL('**/campaigns', { timeout: 20000 });

    // Verify row still has scheduled status
    const updatedRow = page.locator('.campaign-row', { hasText: title });
    await expect(updatedRow.locator('.badge-scheduled')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05e_campaign_scheduled_changes_saved.png'), fullPage: true });

    // 8b. Test "下書きに戻す" (Revert to Draft)
    await updatedRow.locator('.btn-icon', { hasText: 'edit' }).click();
    await page.waitForURL('**/campaigns/**', { timeout: 15000 });
    const revertBtn = page.locator('.topbar-actions button').filter({ hasText: /下書きに戻す|Revert to Draft/ });
    await expect(revertBtn).toBeVisible();
    await revertBtn.click();
    await page.waitForURL('**/campaigns', { timeout: 20000 });

    // Verify campaign is now in draft status
    const draftRow = page.locator('.campaign-row', { hasText: title });
    await expect(draftRow.locator('.badge-draft')).toBeVisible();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'e2e_05f_campaign_reverted_to_draft.png'), fullPage: true });

    // 9. Test Campaign Clone
    const cloneBtn = draftRow.locator('.btn-icon', { hasText: 'content_copy' });
    await cloneBtn.click();

    const cloneModal = page.locator('.modal-backdrop');
    await expect(cloneModal).toBeVisible();

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

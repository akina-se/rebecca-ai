import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(__dirname, '../../test-artifacts');
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

test.describe('Active Campaign Critical User Journey (CUJ)', () => {
  test('Complete Active Campaign Lifecycle: API Seed -> Active Action Bar Invariants -> Pause/Resume Persistence -> Emergency Kill-Switch Banner -> Modify Description -> Delete', async ({ page }) => {
    test.setTimeout(120000);

    page.on('console', (msg) => console.log(`[BROWSER LOG] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => console.log(`[BROWSER ERROR] ${err}`));

    // 1. Authenticate via emulator
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.evaluate(() => localStorage.setItem('rebecca_lang', 'ja'));

    // 2. Seed an Active Campaign directly via backend API
    const uniqueId = Date.now().toString().slice(-6);
    const campaignTitle = `Active Shinjuku Cyber Arc ${uniqueId}`;

    // Unique future date interval to prevent overlapping collisions
    const baseDate = new Date();
    baseDate.setFullYear(2042);
    baseDate.setUTCMonth(2);
    baseDate.setUTCDate(10 + (parseInt(uniqueId, 10) % 15));
    const endDateObj = new Date(baseDate);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 2);

    const startDate = baseDate.toISOString().slice(0, 10);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const createPayload = {
      title: campaignTitle,
      description: 'Live running campaign exploring Tokyo cyberpunk aesthetic.',
      startDate,
      endDate,
      status: 'active',
      masterContext: 'Rebecca is currently broadcasting live from Shinjuku Kabukicho.',
      replyContextSummary: 'Engage actively about neon streetscapes, synthwave music, and late-night ramen.',
      hashtag: `Cyber${uniqueId}`,
      dailySlotTimes: ['12:00', '18:00', '21:00'],
    };

    const createResponse = await page.request.post('http://127.0.0.1:8081/api/v1/campaigns', {
      data: createPayload,
    });
    expect(createResponse.status()).toBe(201);
    const createdCampaign = await createResponse.json();
    const campaignId = createdCampaign.id;
    expect(campaignId).toBeTruthy();
    expect(createdCampaign.status).toBe('active');

    // 3. Navigate to /campaigns list & verify Active Status presentation
    await page.goto('/campaigns');
    await expect(page.locator('.view-header h1')).toBeVisible({ timeout: 15000 });

    // Filter by "実施中" (Active) tab
    const activeFilterTab = page.locator('.rank-tab', { hasText: '実施中' });
    await expect(activeFilterTab).toBeVisible();
    await activeFilterTab.click();

    // Verify row for our active campaign
    const campaignRow = page.locator(`tr:has-text("${campaignTitle}")`);
    await expect(campaignRow).toBeVisible({ timeout: 10000 });

    // Verify active badge is present
    await expect(campaignRow.locator('.badge.badge-active')).toBeVisible();

    // Verify neither paused badge nor emergency banner is visible yet
    await expect(campaignRow.locator('.badge-paused')).toHaveCount(0);
    await expect(page.locator('.alert-banner')).toHaveCount(0);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_01_campaign_list_active.png'),
      fullPage: true,
    });

    // 4. Navigate into Campaign Editor & Verify Action Bar Invariants for Active status
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });

    // Invariant Check 1: Delete button MUST be present
    const deleteBtn = page.locator('.topbar-actions button.btn-danger-outline');
    await expect(deleteBtn).toBeVisible();

    // Invariant Check 2: Pause toggle MUST be present (status === 'active' || status === 'scheduled')
    const pauseToggleBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("pause"))');
    await expect(pauseToggleBtn).toBeVisible();

    // Invariant Check 3: Save Changes button MUST be present
    const saveChangesBtn = page.locator('.topbar-actions button.btn-primary:has-text("変更を保存")');
    await expect(saveChangesBtn).toBeVisible();

    // Invariant Check 4: Revert to Draft button MUST NEVER be rendered for an active campaign
    const revertToDraftBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("undo"))');
    await expect(revertToDraftBtn).toHaveCount(0);

    // Invariant Check 5: Schedule Campaign / Save Draft buttons MUST NOT be rendered
    const scheduleBtn = page.locator('.topbar-actions button:has-text("スケジュール確定")');
    await expect(scheduleBtn).toHaveCount(0);
    const saveDraftBtn = page.locator('.topbar-actions button:has-text("下書き保存")');
    await expect(saveDraftBtn).toHaveCount(0);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_02_active_editor_action_bar.png'),
      fullPage: true,
    });

    // 5. Test Pause Action in Editor
    await pauseToggleBtn.click();

    // Verify toggle flips to Resume (play_arrow)
    const resumeToggleBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("play_arrow"))');
    await expect(resumeToggleBtn).toBeVisible({ timeout: 10000 });
    await expect(resumeToggleBtn).toHaveClass(/btn-warning/);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_03_active_editor_paused.png'),
      fullPage: true,
    });

    // 6. Test Browser Reload Persistence (Ensuring Firestore mutation persisted)
    await page.reload();
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });
    const persistedResumeBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("play_arrow"))');
    await expect(persistedResumeBtn).toBeVisible({ timeout: 10000 });

    // 7. Navigate back to /campaigns: Verify Emergency Kill-Switch Warning Banner
    await page.goto('/campaigns');
    await expect(page.locator('.view-header h1')).toBeVisible({ timeout: 15000 });

    // Emergency kill-switch banner must be displayed because active campaign is paused
    const emergencyBanner = page.locator('.alert-banner');
    await expect(emergencyBanner).toBeVisible({ timeout: 10000 });
    await expect(emergencyBanner).toContainText(campaignTitle);

    // Filter by active to see row paused badge
    await page.locator('.rank-tab', { hasText: '実施中' }).click();
    const pausedRow = page.locator(`tr:has-text("${campaignTitle}")`);
    await expect(pausedRow.locator('.badge-paused')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_04_campaign_list_emergency_banner.png'),
      fullPage: true,
    });

    // 8. Resume campaign via Emergency Banner Resume Button
    const bannerResumeBtn = emergencyBanner.locator('button.btn-resume-banner');
    await expect(bannerResumeBtn).toBeVisible();
    await bannerResumeBtn.click();

    // Verify banner disappears and row badge-paused is removed
    await expect(emergencyBanner).toHaveCount(0, { timeout: 10000 });
    await expect(pausedRow.locator('.badge-paused')).toHaveCount(0, { timeout: 10000 });

    // 9. Return to Editor: Update description and Save Changes
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });

    // Verify pause toggle is back to "pause" icon
    await expect(page.locator('.topbar-actions button:has(.material-icons:has-text("pause"))')).toBeVisible({ timeout: 10000 });

    // Modify description
    const descTextarea = page.locator('textarea.form-textarea').first();
    const updatedDesc = 'Updated active live briefing: Shinjuku Omoide Yokocho culinary tour.';
    await descTextarea.fill(updatedDesc);

    // Click Save Changes (redirects back to /campaigns upon success)
    const saveBtn = page.locator('.topbar-actions button.btn-primary:has-text("変更を保存")');
    await saveBtn.click();
    await page.waitForURL('**/campaigns', { timeout: 20000 });

    // Navigate back to editor to verify description was saved into Firestore
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('textarea.form-textarea').first()).toHaveValue(updatedDesc);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_05_active_editor_resumed_and_edited.png'),
      fullPage: true,
    });

    // 10. Delete Active Campaign from Editor
    const finalDeleteBtn = page.locator('.topbar-actions button.btn-danger-outline');
    await finalDeleteBtn.click();

    // Verify Delete Confirmation Modal
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible({ timeout: 10000 });
    await expect(modal.locator('.delete-target-title')).toContainText(campaignTitle);

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_06_active_campaign_delete_modal.png'),
      fullPage: true,
    });

    // Confirm deletion
    const confirmDeleteBtn = modal.locator('button.btn-danger');
    await confirmDeleteBtn.click();

    // Verify redirected to /campaigns
    await expect(page).toHaveURL(/\/campaigns$/, { timeout: 15000 });

    // Verify campaign is cleanly removed from list
    await expect(page.locator(`tr:has-text("${campaignTitle}")`)).toHaveCount(0, { timeout: 10000 });

    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'active_cuj_07_campaign_list_after_deletion.png'),
      fullPage: true,
    });
  });
});

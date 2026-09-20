import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

const artifactsDir = process.env.ARTIFACTS_DIR || path.join(__dirname, '../screenshots');

test.describe('Campaign Progressive Disclosure, Pause/Resume & Delete Actions', () => {
  test('progressive disclosure creation, topbar pause toggle, list pause toggle, and editor delete', async ({ page }) => {
    // 1. Authenticate
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.evaluate(() => localStorage.setItem('rebecca_lang', 'ja'));

    // 2. Navigate to /campaigns/new
    await page.goto('/campaigns/new');
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });

    // Verify Step 1 Notice is visible
    const step1Notice = page.locator('.step1-notice');
    await expect(step1Notice).toBeVisible();

    // Verify Step 1 Section 1 is visible
    const overviewSection = page.locator('.form-section').first();
    await expect(overviewSection).toBeVisible();

    // Verify Step 2 (Narrative Context) and Step 3 (Slots) are NOT rendered in DOM
    const narrativeSection = page.locator('.form-section').filter({ has: page.locator('span.material-icons:has-text("psychology")') });
    await expect(narrativeSection).toHaveCount(0);
    const slotsSection = page.locator('.slots-section');
    await expect(slotsSection).toHaveCount(0);

    // Capture Screenshot 1: Step 1 Progressive Disclosure Creation Form
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, '01_step1_progressive_disclosure.png'),
      fullPage: true,
    });

    // 3. Fill Step 1 form fields
    const testTitle = `Hokkaido Winter Odyssey ${Date.now()}`;
    const titleInput = page.locator('input.form-input').first();
    await titleInput.fill(testTitle);

    const descTextarea = page.locator('textarea.form-textarea').first();
    await descTextarea.fill('Exploring snowy Otaru canal and Sapporo night markets.');

    // Generate unique future date range to prevent overlapping date collision
    const offsetDays = 100 + Math.floor(Math.random() * 800);
    const startObj = new Date(Date.now() + offsetDays * 86400000);
    const endObj = new Date(startObj.getTime() + 2 * 86400000);
    const testStartDate = startObj.toISOString().split('T')[0];
    const testEndDate = endObj.toISOString().split('T')[0];

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await startDateInput.fill(testStartDate);
    await endDateInput.fill(testEndDate);

    page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('[PAGE ERROR]', err));
    page.on('requestfailed', (req) => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));

    // Click "Create Campaign & Configure Details"
    const createBtn = page.locator('.step1-bottom-bar button.btn-primary');
    await expect(createBtn).toBeEnabled();
    console.log('[TEST] Clicking createBtn...');
    await createBtn.click();

    // 4. Verify transition to edit mode /campaigns/:id
    await expect(page).toHaveURL(/\/campaigns\/camp_/, { timeout: 15000 });
    const currentUrl = page.url();
    const campaignIdMatch = currentUrl.match(/campaigns\/(camp_[^/?#]+)/);
    expect(campaignIdMatch).toBeTruthy();
    const campaignId = campaignIdMatch![1];

    // Verify full editor is now unlocked
    const narrativeSectionInEdit = page.locator('.form-section').filter({ has: page.locator('span.material-icons:has-text("psychology")') });
    await expect(narrativeSectionInEdit).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.slots-section')).toBeVisible({ timeout: 10000 });

    // Test "Sync Slots" / "スロット再同期" button
    const syncSlotsBtn = page.locator('.slots-header-actions button:has(.material-icons:has-text("autorenew"))');
    await expect(syncSlotsBtn).toBeVisible();
    await syncSlotsBtn.click();
    await expect(page.locator('.toast')).toBeVisible({ timeout: 5000 });

    // Capture Screenshot 2: Full Editor Unlocked
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(artifactsDir, '02_step2_full_editor_unlocked.png'),
    });

    // Scroll to and capture Slot Cards
    await page.locator('.slots-section').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, '02_step2_slots_accordion.png'),
    });

    // 5. Fill Narrative Context and Schedule Campaign so we can test Pause/Resume
    await page.locator('.form-section').first().scrollIntoViewIfNeeded();
    const masterContextInput = narrativeSectionInEdit.locator('textarea').first();
    await masterContextInput.fill('Rebecca is staying at a cozy ryokan in Jozankei hot springs.');

    const replyContextInput = narrativeSectionInEdit.locator('textarea').nth(1);
    await replyContextInput.fill('Enjoying hot springs and Hokkaido milk soft serve.');

    // Click "Schedule Campaign" button in topbar
    const scheduleBtn = page.locator('.topbar-actions button.btn-primary');
    await scheduleBtn.click();

    // After scheduling, it returns to /campaigns list
    await expect(page).toHaveURL(/\/campaigns$/, { timeout: 15000 });

    // 6. Test Pause / Resume directly on Campaign List
    // Find row for our scheduled campaign
    const campaignRow = page.locator(`tr:has-text("${testTitle}")`);
    await expect(campaignRow).toBeVisible({ timeout: 10000 });

    // Click Pause button on the row
    const rowPauseBtn = campaignRow.locator('button:has(.material-icons:has-text("pause"))');
    await expect(rowPauseBtn).toBeVisible();
    await rowPauseBtn.click();

    // Verify toast or paused badge appears
    await expect(campaignRow.locator('.badge-paused')).toBeVisible({ timeout: 10000 });

    // Capture Screenshot 3: Campaign List Paused
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(artifactsDir, '03_campaign_list_paused.png'),
      fullPage: true,
    });

    // Click Resume button on the row
    const rowResumeBtn = campaignRow.locator('button:has(.material-icons:has-text("play_arrow"))');
    await rowResumeBtn.click();
    await expect(campaignRow.locator('.badge-paused')).toHaveCount(0, { timeout: 10000 });

    // Capture Screenshot 4: Campaign List Resumed
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(artifactsDir, '04_campaign_list_resumed.png'),
      fullPage: true,
    });

    // 7. Test Pause/Resume and Delete from inside the Campaign Editor
    // Click into the campaign editor
    await page.goto(`/campaigns/${campaignId}`);
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });

    // Verify Pause button is in topbar (since status is scheduled)
    const topbarPauseBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("pause"))');
    await expect(topbarPauseBtn).toBeVisible();

    // Toggle Pause in editor
    await topbarPauseBtn.click();
    // Verify toggle changes to resume (play_arrow)
    const topbarResumeBtn = page.locator('.topbar-actions button:has(.material-icons:has-text("play_arrow"))');
    await expect(topbarResumeBtn).toBeVisible({ timeout: 10000 });

    // Capture Screenshot 5: Editor Topbar Paused State
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, '05_editor_topbar_paused.png'),
      fullPage: true,
    });

    // Resume in editor
    await topbarResumeBtn.click();
    await expect(page.locator('.topbar-actions button:has(.material-icons:has-text("pause"))')).toBeVisible({ timeout: 10000 });

    // 8. Test Delete Confirmation Modal in Editor
    const deleteBtn = page.locator('.topbar-actions button.btn-danger-outline');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify modal is open
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.delete-target-title')).toContainText(testTitle);

    // Capture Screenshot 6: Delete Confirmation Modal in Editor
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, '06_editor_delete_modal.png'),
      fullPage: true,
    });

    // Confirm delete
    const confirmDeleteBtn = modal.locator('button.btn-danger');
    await confirmDeleteBtn.click();

    // Verify redirect to /campaigns
    await expect(page).toHaveURL(/\/campaigns$/, { timeout: 15000 });

    // Verify deleted campaign is gone
    await expect(page.locator(`tr:has-text("${testTitle}")`)).toHaveCount(0, { timeout: 10000 });

    // Capture Screenshot 7: Campaign Cleanly Deleted
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(artifactsDir, '07_campaign_cleanly_deleted.png'),
      fullPage: true,
    });
  });
});

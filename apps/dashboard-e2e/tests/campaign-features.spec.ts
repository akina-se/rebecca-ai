import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Campaign Narrative Engine Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Authenticate via emulator
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // 2. Navigate to campaigns page
    await page.goto('/campaigns');
    await expect(page.locator('.view-header h1')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario A: Navigation & UI Guidelines - should render campaigns dashboard without emojis and display clean Glassmorphism UI', async ({ page }) => {
    // Verify title and subtitle
    const headerTitle = page.locator('.view-header h1');
    await expect(headerTitle).toContainText(/Campaign Narrative Engine|キャンペーン管理/);

    // Verify zero emojis in header and filter tabs
    const headerText = await page.locator('.view-header').innerText();
    expect(headerText).not.toMatch(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);

    // Verify filter tabs are rendered
    const filterTabs = page.locator('.rank-tab');
    await expect(filterTabs.first()).toBeVisible();
    expect(await filterTabs.count()).toBe(5);

    // Verify "+ New Campaign" button
    const newBtn = page.locator('.view-header .btn-primary');
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Verify navigation to editor
    await page.waitForURL('**/campaigns/new', { timeout: 10000 });
    await expect(page.locator('.editor-heading h2')).toContainText(/Create Campaign|キャンペーン新規作成/);
  });

  test('Scenario B: Campaign Creation & Itinerary Slot Cards - should auto-generate slot cards with Material Icons', async ({ page }) => {
    await page.goto('/campaigns/new');
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });

    // 1. Fill campaign title
    const uniqueId = Date.now().toString().slice(-6);
    const title = `Hawaii Story Arc ${uniqueId}`;
    const titleInput = page.locator('input.form-input').first();
    await titleInput.fill(title);

    // 2. Set unique dates
    const offsetDays = (parseInt(uniqueId, 10) % 500) + 100;
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    const endDateObj = new Date(baseDate);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 2);

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);

    await startDateInput.fill(baseDate.toISOString().slice(0, 10));
    await endDateInput.fill(endDateObj.toISOString().slice(0, 10));

    // 3. Step 1: Create draft and proceed to Step 2 (Detailed configuration)
    const createBtn = page.locator('.step1-bottom-bar button.btn-primary');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Wait for transition to edit mode (/campaigns/camp_*)
    await expect(page).toHaveURL(/\/campaigns\/camp_/, { timeout: 15000 });

    // 4. Verify slot cards rendered (3 days * 3 slots = 9 slots)
    const slotCards = page.locator('app-itinerary-slot-card');
    await expect(slotCards.first()).toBeVisible({ timeout: 10000 });
    const slotCount = await slotCards.count();
    expect(slotCount).toBeGreaterThanOrEqual(6);

    // 5. Verify Material icons inside slot card (NO emojis)
    const firstCard = slotCards.first();
    const periodIcon = firstCard.locator('.period-icon');
    await expect(periodIcon).toBeVisible();
    const iconText = await periodIcon.innerText();
    expect(['light_mode', 'wb_sunny', 'nights_stay', 'bedtime', 'schedule']).toContain(iconText.trim());

    // 6. Test mode switch: AI Generated to Fixed Text
    const fixedModeBtn = firstCard.locator('.mode-btn', { hasText: /Fixed Text|固定テキスト/ });
    await fixedModeBtn.click();
    await expect(firstCard.locator('textarea.form-textarea')).toBeVisible();

    // Fill fixed text
    await firstCard.locator('textarea.form-textarea').fill('Aloha from Waikiki beach! Testing slot narrative.');

    // 7. Verify back button navigates back to /campaigns
    const backBtn = page.locator('.btn-back');
    await backBtn.click();
    await page.waitForURL('**/campaigns', { timeout: 10000 });
  });

  test('Scenario C: Filter Tabs & Clone Modal Interaction', async ({ page }) => {
    // 1. Click filter tabs
    const scheduledTab = page.locator('.rank-tab', { hasText: /Scheduled|予定/ });
    await scheduledTab.click();
    await expect(scheduledTab).toHaveClass(/active/);

    const allTab = page.locator('.rank-tab', { hasText: /All|すべて/ });
    await allTab.click();
    await expect(allTab).toHaveClass(/active/);

    // 2. If table rows exist, test clone modal open/close
    const rows = page.locator('.campaign-row');
    if ((await rows.count()) > 0) {
      const cloneBtn = rows.first().locator('.btn-icon', { hasText: 'content_copy' });
      if (await cloneBtn.isVisible()) {
        await cloneBtn.click();
        const cloneModal = page.locator('.modal-card');
        await expect(cloneModal).toBeVisible();
        await expect(cloneModal.locator('h3')).toContainText(/Clone Campaign|キャンペーンの複製/);

        // Cancel modal
        const cancelBtn = cloneModal.locator('.btn-secondary');
        await cancelBtn.click();
        await expect(cloneModal).toBeHidden();
      }
    }
  });
});

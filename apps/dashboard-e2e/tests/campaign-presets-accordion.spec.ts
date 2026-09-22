import { test, expect } from '@playwright/test';
import * as path from 'path';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

const artifactsDir = process.env.ARTIFACTS_DIR || path.join(__dirname, '../artifacts');

test.describe('Campaign Presets, Hourly Chips & Accordion E2E Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/campaigns/new');
    await expect(page.locator('.editor-heading h2')).toBeVisible({ timeout: 15000 });
  });

  test('should display standard preset, custom 24h hourly chips, and day-level accordion with screenshots', async ({ page }) => {
    // 1. Setup campaign basics
    const uniqueId = Date.now().toString().slice(-6);
    const title = `Autumn Foliage Tour ${uniqueId}`;
    const titleInput = page.locator('input.form-input').first();
    await titleInput.fill(title);

    const offsetDays = (parseInt(uniqueId, 10) % 500) + 100;
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
    const endDateObj = new Date(baseDate);
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 2);

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await startDateInput.fill(baseDate.toISOString().slice(0, 10));
    await endDateInput.fill(endDateObj.toISOString().slice(0, 10));

    // Verify Standard Preset is active in Step 1
    const standardBtn = page.locator('.preset-btn').first();
    await expect(standardBtn).toHaveClass(/active/);

    // 2. Switch to Custom Preset Mode in Step 1
    const customBtn = page.locator('.preset-btn').nth(1);
    await customBtn.click();
    await expect(customBtn).toHaveClass(/active/);

    // Verify 24h Hourly Pill Chips are visible
    const chipsContainer = page.locator('.custom-chips-container');
    await expect(chipsContainer).toBeVisible();

    const hourChips = page.locator('.hour-chip');
    await expect(hourChips).toHaveCount(24);

    // Toggle chip: Add 15:00
    const chip15 = page.locator('.hour-chip').filter({ hasText: '15:00' });
    await chip15.click();
    await expect(chip15).toHaveClass(/selected/);

    // Toggle chip: Add 22:00
    const chip22 = page.locator('.hour-chip').filter({ hasText: '22:00' });
    await chip22.click();
    await expect(chip22).toHaveClass(/selected/);

    // Capture Screenshot 1: Custom Hourly Chips Active in Step 1
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, 'preset_custom_chips.png'),
      fullPage: true,
    });

    // 3. Click "Create Campaign & Configure Details" to transition to Step 2
    const createBtn = page.locator('.step1-bottom-bar button.btn-primary');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    await expect(page).toHaveURL(/\/campaigns\/camp_/, { timeout: 15000 });

    // Now in Step 2: 5 slots per day * 3 days = 15 slots
    await expect(page.locator('.slots-count-badge')).toContainText('15 slots');

    // Verify Day Accordion Cards (Day 1, Day 2, Day 3)
    const dayCards = page.locator('.day-accordion-card');
    await expect(dayCards).toHaveCount(3);

    // Scroll to slot card and capture close-up
    const firstSlotCard = page.locator('app-itinerary-slot-card').first();
    await firstSlotCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await firstSlotCard.screenshot({
      path: path.join(artifactsDir, 'slot_card_day_badge.png'),
    });

    // Capture Screenshot 2: Accordion in Step 2
    await page.screenshot({
      path: path.join(artifactsDir, 'preset_standard_accordion.png'),
      fullPage: true,
    });

    // 4. Test Accordion Interaction: Collapse All, then toggle Day 1
    const collapseAllBtn = page.locator('.slots-header-actions button').nth(1);
    await collapseAllBtn.click();

    // All accordion bodies should be hidden
    await expect(page.locator('.day-accordion-body')).toHaveCount(0);

    // Click Day 1 header to expand Day 1 only
    const day1Header = page.locator('.day-accordion-header').first();
    await day1Header.click();
    await expect(page.locator('.day-accordion-body')).toHaveCount(1);

    // Capture Screenshot 3: Accordion Collapsed & Day 1 Expanded
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(artifactsDir, 'accordion_collapsed_expanded.png'),
      fullPage: true,
    });
  });
});

import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Memory Features E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Authenticate via emulator API and inject session directly
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');

    // 2. Navigate to memory management page and verify it loads
    await page.goto('/memory');
    await expect(page.locator('h2', { hasText: /System Memory Layers|システム記憶レイヤー/ })).toBeVisible({ timeout: 15000 });
  });

  test('Scenario A: Memory Layers Table - should render 3 layers with valid dates and no Invalid Date', async ({ page }) => {
    const rows = page.locator('table.data-table tbody tr');
    await expect(rows).toHaveCount(3, { timeout: 10000 });

    // Assert layer names
    await expect(rows.nth(0)).toContainText('Layer 0');
    await expect(rows.nth(0)).toContainText(/Core Prompt|コアプロンプト/);
    await expect(rows.nth(1)).toContainText('Layer 1');
    await expect(rows.nth(1)).toContainText(/Extended Persona Tuning|拡張ペルソナ調整/);
    await expect(rows.nth(2)).toContainText('Layer 2');
    await expect(rows.nth(2)).toContainText(/Global Timeline Summary|全体タイムライン要約/);

    // Assert that no row contains "Invalid Date"
    const tableText = await page.locator('table.data-table').innerText();
    expect(tableText).not.toContain('Invalid Date');
  });

  test('Scenario B: Layer 0 Core Prompt - should open read-only drawer with persona prompt', async ({ page }) => {
    const rows = page.locator('table.data-table tbody tr');
    await rows.nth(0).click();

    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText(/Layer 0|Persona Core Prompt|コアプロンプト/);

    const textarea = drawer.locator('app-memory-drawer textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await expect(textarea).toHaveAttribute('readonly', '');
    const promptValue = await textarea.inputValue();
    expect(promptValue.length).toBeGreaterThan(10);
    expect(promptValue).not.toContain('Loading...');

    // Read-only indicator
    await expect(drawer.locator('app-memory-drawer')).toContainText(/Hardcoded in source code \(Read-only\)|読み取り専用/);

    // Close drawer
    await drawer.locator('.drawer-header .close-btn').click();
    await expect(drawer).not.toHaveClass(/open/);
  });

  test('Scenario C: Layer 1 Extended Persona Tuning - should load from API, save modifications, and persist', async ({ page }) => {
    const rows = page.locator('table.data-table tbody tr');
    await rows.nth(1).click();

    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText(/Layer 1|Extended Persona Tuning|拡張ペルソナ調整/);

    const textarea = drawer.locator('app-memory-drawer textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    
    // Initial value loaded from Firestore
    await expect(textarea).not.toHaveValue('Loading...', { timeout: 10000 });

    const newTuningText = 'Always use gal slang and support Master unconditionally. ' + Date.now();
    await textarea.fill(newTuningText);

    // Click Save Tuning
    const saveBtn = drawer.locator('app-memory-drawer button', { hasText: /Save Tuning|チューニングを保存/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Assert toast
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/Successfully saved Extended Persona Tuning|正常に保存|保存/);

    // Close and reopen to verify persistence from real API/DB
    await drawer.locator('.drawer-header .close-btn').click();
    await expect(drawer).not.toHaveClass(/open/);

    await rows.nth(1).click();
    await expect(drawer).toHaveClass(/open/);
    await expect(textarea).toHaveValue(newTuningText, { timeout: 10000 });

    // Close drawer
    await drawer.locator('.drawer-header .close-btn').click();
  });

  test('Scenario D: Layer 2 Global Timeline Summary - should render drawer correctly and save summary updates', async ({ page }) => {
    const rows = page.locator('table.data-table tbody tr');
    await rows.nth(2).click();

    const drawer = page.locator('.right-drawer.glass-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.drawer-header h3')).toContainText(/Layer 2|Global Timeline Summary|全体タイムライン要約/);

    // Verify textarea is rendered (verifying level 2 fix)
    const textarea = drawer.locator('app-memory-drawer textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await expect(textarea).not.toHaveValue('Loading...', { timeout: 10000 });

    const newSummaryText = 'Rebecca recently posted about anime recommendations and late night coding. ' + Date.now();
    await textarea.fill(newSummaryText);

    // Click Save Summary
    const saveBtn = drawer.locator('app-memory-drawer button', { hasText: /Save Summary|要約を保存/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Assert toast
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/Successfully saved Global Timeline Summary|正常に保存|保存/);

    // Close and reopen to verify persistence
    await drawer.locator('.drawer-header .close-btn').click();
    await expect(drawer).not.toHaveClass(/open/);

    await rows.nth(2).click();
    await expect(drawer).toHaveClass(/open/);
    await expect(textarea).toHaveValue(newSummaryText, { timeout: 10000 });

    // Close drawer
    await drawer.locator('.drawer-header .close-btn').click();
  });

  test('Scenario E: Force Dreaming - should trigger dreaming process and show completion toast', async ({ page }) => {
    const forceDreamingBtn = page.locator('.view-header button', { hasText: /Force Dreaming|ドリーミング/ }).first();
    await expect(forceDreamingBtn).toBeVisible();

    await forceDreamingBtn.click();

    // Assert completion toast
    const toast = page.locator('.toast.success');
    await expect(toast).toBeVisible({ timeout: 15000 });
    await expect(toast).toContainText(/Force Dreaming completed|完了/);
  });
});

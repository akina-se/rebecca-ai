import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Responsive Breakpoints Verification (1024px boundary)', () => {

  test('FHD Monitor (1920x1080) - should display full PC layout with left sidebar and topbar', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Verify PC sidebar properties: width is 280px, logo is visible
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeCloseTo(280, -1);

    const logo = sidebar.locator('.logo');
    await expect(logo).toBeVisible();

    await page.screenshot({ path: 'screenshots/responsive_01_fhd_1920x1080.png', fullPage: false });
  });

  test('FHD with DevTools Open (1366x900) - should remain PC layout with left sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Verify PC sidebar: width is 280px, logo is visible
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeCloseTo(280, -1);

    const logo = sidebar.locator('.logo');
    await expect(logo).toBeVisible();

    await page.screenshot({ path: 'screenshots/responsive_02_fhd_devtools_1366x900.png', fullPage: false });
  });

  test('FHD with Wide DevTools Open (1100x800) - should remain PC layout (>1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Verify PC sidebar remains active above 1024px
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeCloseTo(280, -1);

    const logo = sidebar.locator('.logo');
    await expect(logo).toBeVisible();

    await page.screenshot({ path: 'screenshots/responsive_03_fhd_wide_devtools_1100x800.png', fullPage: false });
  });

  test('Tablet / iPad Portrait (834x1194) - should switch to bottom navigation bar (<=1024px)', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1194 });
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // In mobile mode (<=1024px), sidebar width spans 100% of the viewport (834px)
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeCloseTo(834, -1);

    // Sidebar logo is hidden in mobile bottom navigation
    const logo = sidebar.locator('.logo');
    await expect(logo).toBeHidden();

    await page.screenshot({ path: 'screenshots/responsive_04_tablet_834x1194.png', fullPage: false });
  });

  test('Smartphone Viewport (390x844) - should switch to mobile bottom navigation bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginWithEmulatorAndSeedDB(page, 'admin@example.com', 'password123');
    await page.goto('/dashboard');
    await expect(page.locator('.topbar')).toBeVisible({ timeout: 15000 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // Mobile width spans 390px
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeCloseTo(390, -1);

    const logo = sidebar.locator('.logo');
    await expect(logo).toBeHidden();

    await page.screenshot({ path: 'screenshots/responsive_05_mobile_390x844.png', fullPage: false });
  });
});

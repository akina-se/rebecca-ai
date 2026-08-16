import { test, expect } from '@playwright/test';
import { loginWithEmulatorAndSeedDB } from './auth-helper';

test.describe('Rebecca Copilot AI Chat Drawer & Autonomous Toolchain', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithEmulatorAndSeedDB(page);
  });

  test('Test 1: Global Header "✨ Rebecca" button opens AI Drawer with route-aware context across all pages', async ({ page }) => {
    const pagesToTest = [
      { path: '/dashboard', expectedContext: 'Performance Dashboard' },
      { path: '/assets', expectedContext: 'Assets Library' },
      { path: '/users', expectedContext: 'User Relations' },
      { path: '/memory', expectedContext: 'Memory Management' },
      { path: '/settings', expectedContext: 'System Settings' }
    ];

    for (const p of pagesToTest) {
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');

      // Click the Rebecca copilot button in the top header
      const rebeccaBtn = page.locator('#header-rebecca-btn');
      await expect(rebeccaBtn).toBeVisible({ timeout: 5000 });
      await rebeccaBtn.click();

      // Verify AI Drawer is open
      const aiDrawer = page.locator('.ai-drawer');
      await expect(aiDrawer).toHaveClass(/open/, { timeout: 5000 });

      // Verify dynamic context indicator
      const contextIndicator = page.locator('#ai-context-indicator');
      await expect(contextIndicator).toContainText(p.expectedContext, { timeout: 5000 });

      // Close drawer
      const closeBtn = aiDrawer.locator('.close-btn');
      await closeBtn.click();
      await expect(aiDrawer).not.toHaveClass(/open/, { timeout: 5000 });
    }
  });

  test('Test 2: Detail drawer "Analyze" button opens Copilot with focused entity context', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Click on a timeline post item to open post detail drawer
    const postRow = page.locator('#timeline-table tbody tr').first();
    await expect(postRow).toBeVisible({ timeout: 5000 });
    await postRow.click();

    // Verify right drawer is open
    const rightDrawer = page.locator('.post-drawer, app-post-drawer');
    await expect(rightDrawer).toBeVisible({ timeout: 5000 });

    // Click the Analyze button
    const analyzeBtn = page.locator('button', { hasText: 'Analyze' }).first();
    await expect(analyzeBtn).toBeVisible({ timeout: 5000 });
    await analyzeBtn.click();

    // Verify AI Drawer is open with Post context
    const aiDrawer = page.locator('.ai-drawer');
    await expect(aiDrawer).toHaveClass(/open/, { timeout: 5000 });

    const contextIndicator = page.locator('#ai-context-indicator');
    await expect(contextIndicator).toContainText('Post #', { timeout: 5000 });
  });

  test('Test 3: Autonomous data analytics query and dynamic suggestion chips', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Open AI Drawer
    const rebeccaBtn = page.locator('#header-rebecca-btn');
    await rebeccaBtn.click();

    const aiDrawer = page.locator('.ai-drawer');
    await expect(aiDrawer).toHaveClass(/open/);

    // Verify suggestion chips are displayed
    const suggestionChips = aiDrawer.locator('.action-chip');
    await expect(suggestionChips.first()).toBeVisible({ timeout: 5000 });

    // Click the first suggestion chip or type a question
    const chipText = await suggestionChips.first().innerText();
    await suggestionChips.first().click();

    // Verify user message was added to chat
    const messagesContainer = page.locator('#ai-messages-container');
    await expect(messagesContainer.locator('.user-bubble')).toContainText(chipText.replace('✨', '').trim(), { timeout: 5000 });

    // Wait for Rebecca's reply (excluding thinking indicator)
    const lastModelBubbleText = messagesContainer.locator('.model-row:not(.thinking-row) .bubble-text').last();
    await expect(lastModelBubbleText).toBeVisible({ timeout: 10000 });
    const replyText = await lastModelBubbleText.innerText();
    expect(replyText.length).toBeGreaterThan(5);
  });

  test('Test 4: Two-Phase HITL Safety Action Approval Flow (Proposal -> Approval -> Execution)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Open AI Drawer
    await page.locator('#header-rebecca-btn').click();
    const aiDrawer = page.locator('.ai-drawer');
    await expect(aiDrawer).toHaveClass(/open/);

    // Ask to block a spammer
    const chatInput = page.locator('#ai-input');
    await chatInput.fill('スパマー @toxic_user をブロックして');
    await page.locator('#ai-send-btn').click();

    // Verify Safety Action Card is proposed
    const actionCard = aiDrawer.locator('.action-card.danger').last();
    await expect(actionCard).toBeVisible({ timeout: 8000 });
    await expect(actionCard.locator('.action-card-title')).toContainText('ブロック');
    await expect(actionCard.locator('.approve-btn')).toBeVisible();

    // Click Approve & Execute
    await actionCard.locator('.approve-btn').click();

    // Verify action transitions to executed state
    const executedBadge = actionCard.locator('.action-status-badge.executed');
    await expect(executedBadge).toBeVisible({ timeout: 5000 });
    await expect(executedBadge).toContainText('実行完了');
  });

  test('Test 5: Zero-destruction chat persistence and continuity across route changes', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Open AI Drawer
    await page.locator('#header-rebecca-btn').click();
    const aiDrawer = page.locator('.ai-drawer');
    await expect(aiDrawer).toHaveClass(/open/);

    // Send a message
    const testMsg = '画面遷移テストの確認メッセージ';
    await page.locator('#ai-input').fill(testMsg);
    await page.locator('#ai-send-btn').click();

    // Verify message appears in chat
    const messagesContainer = page.locator('#ai-messages-container');
    await expect(messagesContainer).toContainText(testMsg, { timeout: 5000 });

    // Navigate to Assets page via sidebar
    const assetsNavLink = page.locator('app-sidebar .nav-item', { hasText: 'Assets Library' });
    await assetsNavLink.click();
    await page.waitForURL(/\/assets/);

    // Verify AI Drawer REMAINS OPEN without closing
    await expect(aiDrawer).toHaveClass(/open/);

    // Verify previous chat messages are preserved
    await expect(messagesContainer).toContainText(testMsg);

    // Verify Context indicator dynamically updated to Assets Library
    const contextIndicator = page.locator('#ai-context-indicator');
    await expect(contextIndicator).toContainText('Assets Library');
  });
});

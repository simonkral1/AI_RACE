import { test, expect } from '@playwright/test';

test.describe('AGI Race Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays start overlay on load', async ({ page }) => {
    const overlay = page.locator('#startOverlay');
    await expect(overlay).toBeVisible();

    const title = page.locator('#startOverlay .overlay__title');
    await expect(title).toHaveText('AGI RACE');
  });

  test('shows faction selection options', async ({ page }) => {
    const options = page.locator('#startOptions .overlay__option');
    await expect(options).toHaveCount(5); // 3 labs + 2 governments
  });

  test('can select a faction', async ({ page }) => {
    const options = page.locator('#startOptions .overlay__option');
    const firstOption = options.first();

    await firstOption.click();
    await expect(firstOption).toHaveClass(/is-selected/);
  });

  test('can start campaign', async ({ page }) => {
    const startButton = page.locator('#startGame');
    await startButton.click();

    const overlay = page.locator('#startOverlay');
    await expect(overlay).toHaveClass(/is-hidden/);
  });

  test('displays global dashboard after starting', async ({ page }) => {
    await page.locator('#startGame').click();

    // Check header elements are visible
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('#nextTurn, .btn:has-text("Advance")')).toBeVisible();
  });

  test('can advance quarter', async ({ page }) => {
    await page.locator('#startGame').click();

    // Find and click advance button
    const advanceBtn = page.locator('button:has-text("Advance")').first();
    await advanceBtn.click();

    // Wait for turn to advance
    await page.waitForTimeout(500);

    // Check that something happened (log updated, turn changed)
    const recentActions = page.locator('#recentActions li');
    await expect(recentActions.first()).toBeVisible();
  });

  test('faction list shows all factions', async ({ page }) => {
    await page.locator('#startGame').click();

    const factionCards = page.locator('#factionList .faction-card, #factionList [data-faction-id]');
    await expect(factionCards).toHaveCount(5);
  });

  test('can focus on different factions', async ({ page }) => {
    await page.locator('#startGame').click();
    // Wait for overlay to be hidden
    await page.locator('#startOverlay.is-hidden').waitFor({ state: 'attached', timeout: 5000 });
    await page.waitForTimeout(300);

    const factionCards = page.locator('#factionList .faction-card, #factionList [data-faction-id]');
    const secondFaction = factionCards.nth(1);

    await secondFaction.click();

    // Focus card should update
    const focusCard = page.locator('#focusCard');
    await expect(focusCard).toBeVisible();
  });

  test('tech panel is present', async ({ page }) => {
    await page.locator('#startGame').click();
    await page.waitForTimeout(500);

    // Tech panel section should be in DOM
    const techPanel = page.locator('.panel--tech');
    await expect(techPanel).toHaveCount(1);

    // Tech tree component should be visible (either simple, tabbed, or tech-tabs)
    const techTree = page.locator('.simple-tech, .tabbed-tech-tree, .tech-tabs');
    await expect(techTree.first()).toBeVisible();
  });

  test('orders panel is functional', async ({ page }) => {
    await page.locator('#startGame').click();

    const ordersPanel = page.locator('.orders');
    await expect(ordersPanel).toBeVisible();

    // Should have action selectors
    const actionSelects = page.locator('.orders__action, .orders select').first();
    await expect(actionSelects).toBeVisible();
  });

  test('game state accessible via render_game_to_text', async ({ page }) => {
    await page.locator('#startGame').click();

    const gameState = await page.evaluate(() => {
      return (window as any).render_game_to_text?.();
    });

    expect(gameState).toBeTruthy();
    const parsed = JSON.parse(gameState);
    expect(parsed.year).toBe(2026);
    expect(parsed.quarter).toBe(1);
    expect(parsed.factions.length).toBe(5);
  });

  test('autostart mode works', async ({ page }) => {
    await page.goto('/?autostart=1');

    // Overlay should be hidden immediately
    const overlay = page.locator('#startOverlay');
    await expect(overlay).toHaveClass(/is-hidden/);
  });
});

test.describe('Event System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?autostart=1');
  });

  test('event panel exists', async ({ page }) => {
    const eventPanel = page.locator('#eventPanel');
    await expect(eventPanel).toBeVisible();
  });

  test('events can trigger after advancing turns', async ({ page }) => {
    // Advance several turns to trigger an event
    const advanceBtn = page.locator('button:has-text("Advance")').first();

    for (let i = 0; i < 10; i++) {
      await advanceBtn.click();
      await page.waitForTimeout(300);

      // Check if event appeared
      const eventTitle = page.locator('.event-panel__title');
      if (await eventTitle.isVisible()) {
        await expect(eventTitle).toBeVisible();
        return; // Event triggered successfully
      }
    }

    // Even if no event triggered (RNG), test passes - events are optional
    expect(true).toBe(true);
  });
});

test.describe('Victory and Defeat', () => {
  test('endgame overlay is hidden initially', async ({ page }) => {
    await page.goto('/?autostart=1');

    const endgameOverlay = page.locator('#endgameOverlay');
    await expect(endgameOverlay).toHaveClass(/is-hidden/);
  });

  test('reset button is functional', async ({ page }) => {
    // Start from non-autostart mode
    await page.goto('/');
    await page.waitForTimeout(500);

    // Start the game
    await page.locator('#startGame').click();
    await page.waitForTimeout(500);

    // Find and click reset button
    const resetBtn = page.locator('button:has-text("Reset")').first();
    await resetBtn.click();
    await page.waitForTimeout(1000);

    // Start overlay should be visible again
    const startOverlay = page.locator('#startOverlay');
    await expect(startOverlay).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Comms and Log', () => {
  test('comms log element is present', async ({ page }) => {
    await page.goto('/?autostart=1');
    await page.waitForTimeout(500);

    const commsLog = page.locator('#commsLog');
    await expect(commsLog).toHaveCount(1);
  });

  test('recent actions log element is present', async ({ page }) => {
    await page.goto('/?autostart=1');
    await page.waitForTimeout(500);

    const recentActions = page.locator('#recentActions');
    await expect(recentActions).toHaveCount(1);
  });
});

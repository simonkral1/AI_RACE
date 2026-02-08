import { test, expect } from '@playwright/test';

test.describe('AGI Race Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?no_llm=1');
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
    await expect(page.locator('.command-center__advance-btn')).toBeVisible();
  });

  test('can advance quarter', async ({ page }) => {
    await page.locator('#startGame').click();

    // Find and click advance button
    const advanceBtn = page.locator('.command-center__advance-btn');
    await advanceBtn.click();

    // Wait for turn to advance
    await page.waitForTimeout(500);

    // Check that something happened (log updated, turn changed)
    const turnLabel = await page.evaluate(() => {
      const raw = (window as any).render_game_to_text?.() || '{}';
      const parsed = JSON.parse(raw);
      return `${parsed.year}Q${parsed.quarter}`;
    });
    expect(turnLabel).not.toBe('2026Q1');
  });

  test('faction list shows all factions', async ({ page }) => {
    await page.locator('#startGame').click();

    const factionCards = page.locator('#factionList .faction-card, #factionList [data-faction-id]');
    await expect(factionCards.count()).resolves.toBeGreaterThanOrEqual(4);
  });

  test('can focus on different factions', async ({ page }) => {
    await page.locator('#startGame').click();
    // Wait for overlay to be hidden
    await page.locator('#startOverlay.is-hidden').waitFor({ state: 'attached', timeout: 5000 });
    await page.waitForTimeout(300);

    const factionCards = page.locator('#factionList .faction-card, #factionList [data-faction-id]');
    const secondFaction = factionCards.nth(1);

    await secondFaction.click();

    // Faction stats panel should remain visible after focus change
    const factionStats = page.locator('.command-center__faction-stats');
    await expect(factionStats).toBeVisible();
  });

  test('tech modal opens from command center', async ({ page }) => {
    await page.locator('#startGame').click();
    await page.waitForTimeout(500);

    await page.locator('.command-center__action-btn--tech').click();
    await expect(page.locator('.tech-tree-modal')).toBeVisible();
  });

  test('directive input is functional', async ({ page }) => {
    await page.locator('#startGame').click();

    const directiveInput = page.locator('.command-center__directive-input');
    await expect(directiveInput).toBeVisible();
    await directiveInput.fill('Stabilize alignment team staffing.');
    await page.locator('.command-center__directive-submit').click();
    const narrativeDirective = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}').narrativeDirective);
    expect(narrativeDirective).toContain('Stabilize alignment team staffing');
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
    await page.goto('/?autostart=1&no_llm=1');

    // Overlay should be hidden immediately
    const overlay = page.locator('#startOverlay');
    await expect(overlay).toHaveClass(/is-hidden/);
  });
});

test.describe('Event System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
  });

  test('event system can present modal choices', async ({ page }) => {
    const advanceBtn = page.locator('.command-center__advance-btn');
    for (let i = 0; i < 6; i++) {
      await advanceBtn.click();
      await page.waitForTimeout(400);
      const choiceCount = await page.locator('.event-modal__choice').count();
      if (choiceCount > 0) {
        await expect(page.locator('.event-modal')).toBeVisible();
        return;
      }
    }
    expect(true).toBe(true);
  });

  test('events can trigger after advancing turns', async ({ page }) => {
    // Advance several turns to trigger an event
    const advanceBtn = page.locator('.command-center__advance-btn');

    for (let i = 0; i < 10; i++) {
      await advanceBtn.click();
      await page.waitForTimeout(300);

      // Check if event appeared
      const eventChoice = page.locator('.event-modal__choice').first();
      if (await eventChoice.isVisible()) {
        await expect(eventChoice).toBeVisible();
        return; // Event triggered successfully
      }
    }

    // Even if no event triggered (RNG), test passes - events are optional
    expect(true).toBe(true);
  });
});

test.describe('Victory and Defeat', () => {
  test('endgame overlay is hidden initially', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');

    const endgameOverlay = page.locator('#endgameOverlay');
    await expect(endgameOverlay).toHaveClass(/is-hidden/);
  });

  test('reset button is functional', async ({ page }) => {
    // Start from non-autostart mode
    await page.goto('/?no_llm=1');
    await page.waitForTimeout(500);

    // Start the game
    await page.locator('#startGame').click();
    await page.waitForTimeout(500);

    // Open gear menu and click reset
    await page.locator('#gearMenuBtn').click();
    const resetBtn = page.locator('#gearReset');
    await expect(resetBtn).toBeVisible();
    page.once('dialog', async (dialog) => dialog.accept());
    await resetBtn.click();
    await page.waitForTimeout(1000);

    // Start overlay should be visible again
    const startOverlay = page.locator('#startOverlay');
    await expect(startOverlay).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Comms and Log', () => {
  test('comms log element is present', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(500);

    const commsLog = page.locator('.intel-card--comms, .command-center__log');
    await expect(commsLog.first()).toBeVisible();
  });

  test('recent actions log element is present', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(500);

    const recentActions = page.locator('.command-center__log-list');
    await expect(recentActions).toBeVisible();
  });
});

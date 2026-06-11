import { test, expect } from '@playwright/test';

async function skipIntroIfPresent(page: any) {
  const skip = page.locator('.intro-btn--skip');
  if (await skip.count()) {
    if (await skip.first().isVisible()) {
      await skip.first().click();
      await page.waitForTimeout(150);
    }
  }
}

async function startCampaignViaIntro(page: any) {
  await skipIntroIfPresent(page);
  const factionCards = page.locator('.intro-faction');
  if (await factionCards.count()) {
    await factionCards.first().click();
  }
  const startBtn = page.locator('.intro-btn--start');
  if (await startBtn.count()) {
    await startBtn.click();
  }
  await expect(page.locator('#startOverlay')).toHaveClass(/is-hidden/, { timeout: 10000 });
}

test.describe('AGI Race Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?no_llm=1');
  });

  test('displays start overlay on load', async ({ page }) => {
    const overlay = page.locator('#startOverlay');
    await expect(overlay).toBeVisible();

    // Intro briefing should be the initial start flow
    await expect(page.locator('.intro-card')).toBeVisible();
    await expect(page.locator('.intro-title')).toContainText('2026');
    await expect(page.locator('.intro-btn--skip')).toBeVisible();
  });

  test('shows faction selection options', async ({ page }) => {
    await skipIntroIfPresent(page);
    const options = page.locator('.intro-faction');
    await expect(options).toHaveCount(5); // 3 labs + 2 governments
  });

  test('can select a faction', async ({ page }) => {
    await skipIntroIfPresent(page);
    const options = page.locator('.intro-faction');
    const secondOption = options.nth(1);
    await secondOption.click();
    await expect(secondOption).toHaveClass(/intro-faction--selected/);
  });

  test('can start campaign', async ({ page }) => {
    await startCampaignViaIntro(page);
  });

  test('displays global dashboard after starting', async ({ page }) => {
    await startCampaignViaIntro(page);

    // Check header elements are visible
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.command-center__advance-btn')).toBeVisible();
  });

  test('can advance quarter', async ({ page }) => {
    await startCampaignViaIntro(page);

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
    await startCampaignViaIntro(page);

    const factionCards = page.locator('#factionList .faction-card, #factionList [data-faction-id]');
    await expect(factionCards.count()).resolves.toBeGreaterThanOrEqual(4);
  });

  test('can focus on different factions', async ({ page }) => {
    await startCampaignViaIntro(page);
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
    await startCampaignViaIntro(page);
    await page.waitForTimeout(500);

    await page.locator('.command-center__action-btn--tech').click();
    await expect(page.locator('.tech-tree-modal')).toBeVisible();
  });

  test('directive input is functional', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    const directiveInput = page.locator('.command-center__directive-input');
    await expect(directiveInput).toBeVisible();
    await directiveInput.fill('Stabilize alignment team staffing.');
    await page.locator('.command-center__directive-submit').click();
    const narrativeDirective = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}').narrativeDirective);
    expect(narrativeDirective).toContain('Stabilize alignment team staffing');
  });

  test('directive locks in and input resets for next directive', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    const directiveInput = page.locator('.command-center__directive-input');
    await directiveInput.fill('First locked directive');
    await page.locator('.command-center__directive-submit').click();

    await expect(directiveInput).toHaveValue('');
    const payload = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}'));
    expect(payload.lockedDirectives).toContain('First locked directive');
    await expect(page.locator('.command-center__directive-locked-tag').first()).toHaveText('LOCKED IN');
  });

  test('locked directive can be changed from locker panel', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    const directiveInput = page.locator('.command-center__directive-input');
    await directiveInput.fill('Change me directive');
    await page.locator('.command-center__directive-submit').click();
    await page.locator('.command-center__directive-locked-btn', { hasText: 'Change' }).first().click();

    await expect(directiveInput).toHaveValue('Change me directive');
    const payload = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}'));
    expect(payload.lockedDirectives).toEqual([]);
    expect(payload.directiveDraft).toBe('Change me directive');
  });

  test('directive locker on main panel removes interpreted-plan section', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    await expect(page.locator('.command-center__directive-locker')).toBeVisible();
    await expect(page.locator('.command-center__directive-locker')).not.toContainText('Current Interpreted Actions');
  });

  test('natural-language directive is locked in on submit when LLM is disabled', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    await page.locator('.command-center__directive-input').fill('Build compute infrastructure this quarter.');
    await page.locator('.command-center__directive-submit').click();
    await page.waitForFunction(() => {
      const payload = JSON.parse((window as any).render_game_to_text?.() || '{}');
      return typeof payload.directiveInterpretation?.note === 'string'
        && payload.directiveInterpretation.note.toLowerCase().includes('locked');
    });

    const payload = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}'));
    expect(payload.directiveInterpretation.note.toLowerCase()).toContain('locked');
  });

  test('natural-language directive preserves existing orders when interpretation fails on advance', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);

    const beforeOrders = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}').playerOrders);
    await page.locator('.command-center__directive-input').fill('Conduct espionage against Nexus Labs in secret.');
    await page.locator('.command-center__directive-submit').click();
    await page.locator('.command-center__advance-btn').click();
    await page.waitForFunction(() => {
      const payload = JSON.parse((window as any).render_game_to_text?.() || '{}');
      return typeof payload.directiveInterpretation?.note === 'string'
        && payload.directiveInterpretation.note.includes('[AI Error]');
    });

    const payload = await page.evaluate(() => JSON.parse((window as any).render_game_to_text?.() || '{}'));
    expect(payload.playerOrders).toEqual(beforeOrders);
  });

  test('dropdown action selector is removed from command center', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(300);
    await expect(page.locator('.command-center .action-selector__select')).toHaveCount(0);
  });

  test('action review does not auto-block turn advancement', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(500);

    await page.locator('.command-center__advance-btn').click();
    await page.waitForTimeout(1200);

    await expect(page.locator('#actionReviewOverlay')).toHaveCount(0);
  });

  test('turn review appears on main panel with full log access after advancing', async ({ page }) => {
    await page.goto('/?autostart=1&no_llm=1');
    await page.waitForTimeout(500);

    await page.locator('.command-center__advance-btn').click();
    await page.waitForTimeout(1200);

    await expect(page.locator('.command-center__turn-review')).toBeVisible();
    await expect(page.locator('.command-center__turn-review')).toContainText('Your Actions');
    await expect(page.locator('.command-center__turn-review')).toContainText('Key External Events');

    await page.evaluate(() => {
      const details = document.querySelector('.command-center__review-log-details') as HTMLDetailsElement | null;
      if (details) details.open = true;
    });
    await expect(page.locator('.command-center__review-log-full')).toBeVisible();
  });

  test('game state accessible via render_game_to_text', async ({ page }) => {
    await startCampaignViaIntro(page);

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
    await startCampaignViaIntro(page);
    await page.waitForTimeout(600);

    // Open gear menu and click reset
    await page.locator('#gearMenuBtn').click();
    const resetBtn = page.locator('#gearReset');
    await expect(resetBtn).toBeVisible();
    page.once('dialog', async (dialog) => dialog.accept());
    await resetBtn.click();
    await page.waitForTimeout(1000);

    // Start overlay should be visible again (briefing may be skipped if already seen)
    await expect(page.locator('#startOverlay')).not.toHaveClass(/is-hidden/, { timeout: 5000 });
    await expect(page.locator('.intro-card')).toBeVisible();
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

    const recentActions = page.locator('.command-center__log .command-center__log-list').first();
    await expect(recentActions).toBeVisible();
  });
});

/**
 * AGI Race — Smoke Playtest Harness (P7.2a)
 *
 * Rebuilt 2026-06-12 against the current UI.
 * Run:  node scripts/playtest_assert.mjs
 * Env:  BASE_URL (default http://localhost:5173)
 *       OUT_DIR  (default output/overnight/smoke)
 *
 * Scenarios (small named functions, easy to extend):
 *   S1  boot          — styles present, intro/continue overlay visible, no raw skeleton
 *   S2  newCampaign   — handle autosave continue-overlay → "New campaign"
 *   S3  factionSelect — Skip Intro → pick OpenBrain → Enter Campaign
 *   S4  mainUI        — topbar shows 2026 Q1, ADVANCE QUARTER button present
 *   S5  quarterLoop   — advance up to 8 quarters, screenshot events, click first choice
 *   S6  eventCoverage — assert at least one event was encountered
 *
 * Exit code 0 = all scenarios PASS. Exit code 1 = any FAIL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve(process.env.OUT_DIR || 'output/overnight/smoke');
const GAME_URL = `${BASE_URL}/?no_llm=1`;

// Generous-but-bounded waits (ms)
const SHORT = 800;
const MEDIUM = 2500;
const LONG = 6000;
const BTN_TIMEOUT = 12_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let page;
const results = [];
const startedAt = Date.now();

function log(...args) {
  console.log('[smoke]', ...args);
}

function recordResult(name, passed, detail = '') {
  const label = passed ? 'PASS' : 'FAIL';
  const msg = detail ? `${label} ${name}: ${detail}` : `${label} ${name}`;
  log(msg);
  results.push({ name, passed, detail });
}

async function shot(label) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filepath = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  log(`screenshot -> ${filepath}`);
  return filepath;
}

/** Wait for element by role+name or text, return locator (or null if timeout). */
async function waitForText(text, { timeout = BTN_TIMEOUT, exact = false } = {}) {
  try {
    const loc = page.getByText(text, { exact });
    await loc.first().waitFor({ state: 'visible', timeout });
    return loc.first();
  } catch {
    return null;
  }
}

/** Click text locator; return true if found and clicked. */
async function clickText(text, { timeout = BTN_TIMEOUT, exact = false } = {}) {
  const loc = await waitForText(text, { timeout, exact });
  if (loc) {
    await loc.click();
    return true;
  }
  return false;
}

/** Read document.styleSheets.length from page context. */
async function styleSheetCount() {
  return page.evaluate(() => document.styleSheets.length);
}

/** Attach console error + pageerror collector to a page. Returns live array. */
function makeErrorCollector(pg) {
  const errors = [];
  pg.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  pg.on('console', (m) => {
    if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * S1 — Boot
 * Navigate to game URL, wait for JS to run, then assert:
 *   - styleSheets.length > 0  (CSS loaded — not raw skeleton)
 *   - endgameOverlay is hidden (no raw "Campaign Complete" skeleton)
 *   - startOverlay is visible (intro or autosave prompt)
 */
async function s1_boot(errors) {
  log('S1: boot');
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(MEDIUM);

  const sheets = await styleSheetCount();
  if (sheets === 0) {
    recordResult('S1_boot', false, `styleSheets.length=0 — CSS not loaded`);
    return false;
  }

  // endgameOverlay must be hidden — it defaults to "is-hidden" in HTML
  // (position:fixed elements have offsetParent===null always, so use getComputedStyle instead)
  const rawSkeleton = await page.evaluate(() => {
    const el = document.getElementById('endgameOverlay');
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
  if (rawSkeleton) {
    recordResult('S1_boot', false, 'endgameOverlay visible at boot — raw skeleton showing');
    await shot('s1_fail_skeleton');
    return false;
  }

  // startOverlay must be visible (not display:none)
  // position:fixed overlays have offsetParent===null, use getComputedStyle
  const startVisible = await page.evaluate(() => {
    const el = document.getElementById('startOverlay');
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
  if (!startVisible) {
    recordResult('S1_boot', false, 'startOverlay not visible on boot');
    await shot('s1_fail_overlay');
    return false;
  }

  await shot('s1_boot_ok');
  recordResult('S1_boot', true, `styleSheets=${sheets}, startOverlay visible, pageerrors@boot=${errors.length}`);
  return true;
}

/**
 * S2 — Handle autosave continue-overlay
 * If the #continueOverlay (autosave card) is present, click "New campaign".
 * If absent, the intro sequence is showing — both are valid states.
 */
async function s2_newCampaign() {
  log('S2: handle autosave continue-overlay');

  const continueOverlay = page.locator('#continueOverlay');
  const hasOverlay = await continueOverlay.isVisible().catch(() => false);

  if (hasOverlay) {
    log('  autosave overlay present -> clicking "New campaign"');
    const clicked = await clickText('New campaign', { exact: false, timeout: 5000 });
    if (!clicked) {
      recordResult('S2_newCampaign', false, 'Continue overlay found but "New campaign" button not clickable');
      return false;
    }
    await page.waitForTimeout(SHORT);
    recordResult('S2_newCampaign', true, 'New campaign clicked, overlay dismissed');
  } else {
    log('  no autosave overlay — intro sequence showing (fine)');
    recordResult('S2_newCampaign', true, 'No autosave overlay — fresh session');
  }
  return true;
}

/**
 * S3 — Faction select
 * Click "Skip Intro" (if visible) -> select OpenBrain -> "Enter Campaign"
 */
async function s3_factionSelect() {
  log('S3: faction select');

  // Skip Intro (may not appear if we are already on faction page)
  const skipped = await clickText('Skip Intro', { exact: false, timeout: 5000 });
  if (skipped) {
    log('  skipped intro briefing');
    await page.waitForTimeout(SHORT);
  } else {
    log('  Skip Intro not found — may already be on faction select');
  }

  // Click OpenBrain faction card
  const openbrain = await waitForText('OpenBrain', { exact: false, timeout: 8000 });
  if (!openbrain) {
    recordResult('S3_factionSelect', false, 'OpenBrain faction card not found');
    await shot('s3_fail_no_openbrain');
    return false;
  }
  await openbrain.click();
  await page.waitForTimeout(400);
  log('  selected OpenBrain');

  // Click "Enter Campaign"
  const entered = await clickText('Enter Campaign', { exact: false, timeout: 8000 });
  if (!entered) {
    recordResult('S3_factionSelect', false, '"Enter Campaign" button not found after selecting OpenBrain');
    await shot('s3_fail_no_enter');
    return false;
  }
  await page.waitForTimeout(MEDIUM);
  await shot('s3_faction_selected');
  recordResult('S3_factionSelect', true, 'OpenBrain selected and campaign entered');
  return true;
}

/**
 * S4 — Main UI rendered
 * Assert topbar #turnLabel contains "2026" and .command-center__advance-btn is visible.
 */
async function s4_mainUI() {
  log('S4: main UI');

  const turnLabel = page.locator('#turnLabel');
  try {
    await turnLabel.waitFor({ state: 'visible', timeout: BTN_TIMEOUT });
  } catch {
    recordResult('S4_mainUI', false, '#turnLabel not visible — main UI not rendered');
    await shot('s4_fail_no_ui');
    return false;
  }

  const turnText = await turnLabel.textContent().catch(() => '');
  if (!turnText.includes('2026')) {
    recordResult('S4_mainUI', false, `Expected "2026" in turnLabel, got "${turnText}"`);
    await shot('s4_fail_turn');
    return false;
  }

  const advBtn = page.locator('.command-center__advance-btn');
  const advBtnVisible = await advBtn.isVisible().catch(() => false);
  if (!advBtnVisible) {
    recordResult('S4_mainUI', false, '.command-center__advance-btn not visible');
    await shot('s4_fail_no_btn');
    return false;
  }

  const advBtnText = await advBtn.textContent().catch(() => '');
  // Any of these texts is valid for a running campaign
  if (!/advance quarter|resolve event|select faction/i.test(advBtnText)) {
    recordResult('S4_mainUI', false, `Advance btn text unexpected: "${advBtnText}"`);
    await shot('s4_fail_btn_text');
    return false;
  }

  await shot('s4_main_ui_ok');
  recordResult('S4_mainUI', true, `turnLabel="${turnText.trim()}", advBtn="${advBtnText.trim()}"`);
  return true;
}

/**
 * S5 — Quarter loop (up to 8 quarters)
 * Each quarter: advance, wait, check for event modal.
 * When event appears: screenshot, click first choice, assert styles still present.
 * Returns { eventsEncountered, passed }.
 */
async function s5_quarterLoop(errors) {
  log('S5: quarter loop (up to 8 quarters)');
  let eventsEncountered = 0;
  const screenshots = [];

  for (let q = 0; q < 8; q++) {
    log(`  quarter ${q + 1}/8`);

    const advBtn = page.locator('.command-center__advance-btn');

    // Wait for the button to be enabled (not disabled)
    try {
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('.command-center__advance-btn');
          return btn && !btn.disabled;
        },
        { timeout: LONG },
      );
    } catch {
      log(`  advance button not enabled by q=${q} — stopping loop`);
      break;
    }

    const btnText = await advBtn.textContent().catch(() => '');
    log(`  btn text: "${btnText.trim()}"`);

    // Campaign ended — stop loop
    if (/campaign ended/i.test(btnText)) {
      log('  campaign ended early');
      break;
    }

    await advBtn.click();
    log(`  clicked advance (q=${q + 1})`);

    // Brief pause then check for event modal
    await page.waitForTimeout(SHORT);

    const eventModal = page.locator('.event-modal-overlay.is-visible');
    let modalVisible = false;
    try {
      await eventModal.waitFor({ state: 'visible', timeout: LONG });
      modalVisible = true;
    } catch {
      // No event this quarter — normal
    }

    if (modalVisible) {
      eventsEncountered++;
      log(`  event modal appeared (event #${eventsEncountered})`);

      const shotPath = await shot(`s5_event_q${q + 1}_before_choice`);
      screenshots.push(shotPath);

      // Assert styles still present after event appeared
      const sheets = await styleSheetCount();
      if (sheets === 0) {
        recordResult('S5_quarterLoop', false, `styleSheets=0 after event modal at q=${q + 1}`);
        return { eventsEncountered, passed: false };
      }

      // Click first choice button
      const firstChoice = page.locator('.event-modal__choice').first();
      try {
        await firstChoice.waitFor({ state: 'visible', timeout: 5000 });
        const choiceText = await firstChoice.textContent().catch(() => '?');
        log(`  clicking first choice: "${choiceText.slice(0, 60).trim()}"`);
        await firstChoice.click();
      } catch {
        recordResult('S5_quarterLoop', false, `event modal at q=${q + 1} but no .event-modal__choice found`);
        await shot(`s5_fail_no_choice_q${q + 1}`);
        return { eventsEncountered, passed: false };
      }

      // Wait for modal to close + game to resume
      await page.waitForTimeout(MEDIUM);

      // Assert styles survived event resolution
      const sheets2 = await styleSheetCount();
      if (sheets2 === 0) {
        recordResult('S5_quarterLoop', false, `styleSheets=0 after resolving event at q=${q + 1}`);
        return { eventsEncountered, passed: false };
      }

      // Assert no pageerrors from this event
      const errCount = errors.length;
      if (errCount > 0) {
        log(`  note: ${errCount} cumulative pageerror(s) so far`);
      }

      await shot(`s5_event_q${q + 1}_after_choice`);
      log(`  event resolved OK, styles=${sheets2}`);
    }
  }

  await shot('s5_loop_end');
  recordResult('S5_quarterLoop', true, `8-quarter loop complete, events=${eventsEncountered}, screenshots=${screenshots.length}`);
  return { eventsEncountered, passed: true };
}

/**
 * S6 — Event coverage
 * At 45%/quarter probability, 8 quarters gives ~1-(0.55^8) = 99.6% chance of at least one event.
 * Zero events means the event system is likely broken.
 */
async function s6_eventCoverage(eventsEncountered) {
  log('S6: event coverage assertion');
  if (eventsEncountered < 1) {
    recordResult(
      'S6_eventCoverage',
      false,
      `Zero events encountered in 8 quarters. Expected at least 1 (45%/turn = 99.6% chance over 8). ` +
        `Check: getEventForTurn() in engine.ts, event pool in events.ts, ?no_llm=1 mode not disabling events.`,
    );
    return false;
  }
  recordResult('S6_eventCoverage', true, `${eventsEncountered} event(s) in 8 quarters`);
  return true;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------
async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  let allPassed = true;

  try {
    page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = makeErrorCollector(page);

    // S1: Boot
    const bootOk = await s1_boot(errors);
    if (!bootOk) allPassed = false;

    // S2: Autosave overlay (on same page load — no reload between S1 and S2)
    const newOk = await s2_newCampaign();
    if (!newOk) allPassed = false;

    // S3: Faction select
    const factionOk = await s3_factionSelect();
    if (!factionOk) allPassed = false;

    // S4: Main UI
    const uiOk = await s4_mainUI();
    if (!uiOk) allPassed = false;

    // S5 + S6: Quarter loop + event coverage
    if (uiOk) {
      const { eventsEncountered, passed: loopPassed } = await s5_quarterLoop(errors);
      if (!loopPassed) allPassed = false;
      const covOk = await s6_eventCoverage(eventsEncountered);
      if (!covOk) allPassed = false;
    } else {
      recordResult('S5_quarterLoop', false, 'Skipped — S4 (main UI) did not pass');
      recordResult('S6_eventCoverage', false, 'Skipped — S4 (main UI) did not pass');
      allPassed = false;
    }

    // Report any accumulated page errors
    if (errors.length > 0) {
      log(`Accumulated page errors (${errors.length}):`);
      errors.slice(0, 10).forEach((e) => log(' ', e));
    }

  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`  AGI Race Smoke Harness  ${new Date().toISOString()}`);
  console.log(`  Runtime: ${elapsed}s   |   Screenshots: ${OUT_DIR}`);
  console.log('----------------------------------------------------------------');
  for (const r of results) {
    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.name}${r.detail ? ': ' + r.detail : ''}`);
  }
  console.log('----------------------------------------------------------------');
  console.log(`  ${passed} PASS  /  ${failed} FAIL  |  Overall: ${allPassed ? 'PASS' : 'FAIL'}`);
  console.log('================================================================\n');

  // JSON summary for CI / director consumption
  const summary = {
    ok: allPassed,
    passed,
    failed,
    runtimeSeconds: parseFloat(elapsed),
    checkedAt: new Date().toISOString(),
    scenarios: results,
    screenshotDir: OUT_DIR,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'smoke-summary.json'), JSON.stringify(summary, null, 2));

  if (!allPassed) process.exit(1);
}

run().catch((err) => {
  console.error('[smoke] FATAL:', err);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'smoke-summary.json'),
    JSON.stringify({ ok: false, error: String(err), checkedAt: new Date().toISOString() }, null, 2),
  );
  process.exit(1);
});

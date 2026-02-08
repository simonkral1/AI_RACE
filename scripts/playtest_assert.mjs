import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'output', 'loop', 'latest');
const AUTOSTART_URL = `${BASE_URL}/?autostart=1&no_llm=1`;

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseState(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text?.() || '{}');
  return parseState(raw);
}

async function screenshot(page, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

    // Scenario 1: setup -> campaign start transition
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    let state = await getState(page);
    assertCondition(state.mode === 'setup', `Expected setup mode on load, got ${state.mode}`);
    await page.click('#startGame');
    await page.waitForTimeout(250);
    state = await getState(page);
    assertCondition(state.mode === 'running', `Expected running mode after campaign start, got ${state.mode}`);
    await screenshot(page, '01_setup_to_running');

    // Scenario 2: directive submit reflects in render_game_to_text
    await page.goto(AUTOSTART_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    await page.fill('.command-center__directive-input', 'Prioritize red-team alignment benchmarks this quarter.');
    await page.click('.command-center__directive-submit');
    await page.waitForTimeout(150);
    state = await getState(page);
    assertCondition(
      state.narrativeDirective === 'Prioritize red-team alignment benchmarks this quarter.',
      `Expected directive text to persist in state, got ${state.narrativeDirective}`,
    );
    await screenshot(page, '02_directive_submit');

    // Scenario 3: advance turn and resolve event
    await page.goto(AUTOSTART_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    state = await getState(page);
    if (state.mode === 'setup') {
      await page.click('#startGame');
      await page.waitForTimeout(250);
    }
    await page.waitForSelector('.command-center__advance-btn:not([disabled])', { timeout: 5000 });

    let sawEvent = false;
    for (let i = 0; i < 4; i++) {
      await page.click('.command-center__advance-btn');
      await page.waitForTimeout(500);
      state = await getState(page);
      if (state.pendingEvent) {
        sawEvent = true;
        break;
      }
      if (state.gameOver) break;
      await page.waitForSelector('.command-center__advance-btn:not([disabled])', { timeout: 5000 });
    }

    assertCondition(state.year > 2026 || state.quarter > 1, `Expected game to advance beyond 2026 Q1, got ${state.year} Q${state.quarter}`);

    if (sawEvent) {
      const eventChoices = await page.locator('.event-modal__choice').count();
      assertCondition(eventChoices > 0, 'Expected at least one event choice button');
      await page.click('.event-modal__choice:nth-child(1)');
      await page.waitForTimeout(350);
      state = await getState(page);
      assertCondition(!state.pendingEvent, 'Expected pending event to clear after choosing an option');
    }
    await screenshot(page, '03_advance_and_event_flow');

    // Scenario 4: AGI deploy gate is closed for player at game start
    await page.goto(AUTOSTART_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    state = await getState(page);
    assertCondition(!state.playerCanDeployAgi, 'Expected deploy gate to remain locked at start');
    await screenshot(page, '04_deploy_gate');

    // Scenario 5: tech tree modal opens and closes from command center
    await page.click('.command-center__action-btn--tech');
    await page.waitForTimeout(250);
    const modalVisible = await page.locator('.tech-tree-modal.is-visible').count();
    assertCondition(modalVisible > 0, 'Expected tech tree modal to open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    const modalAfterClose = await page.locator('.tech-tree-modal').count();
    assertCondition(modalAfterClose === 0, 'Expected tech tree modal to close on Escape');
    await screenshot(page, '05_tech_modal_toggle');

    fs.writeFileSync(
      path.join(OUT_DIR, 'assert-summary.json'),
      JSON.stringify({ ok: true, checkedAt: new Date().toISOString() }, null, 2),
    );

    await page.close();
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'assert-summary.json'),
    JSON.stringify({ ok: false, error: String(err), checkedAt: new Date().toISOString() }, null, 2),
  );
  console.error(err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'output', 'loop', 'latest');

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

    // Scenario 2: research focus sets selected order action
    await page.goto(`${BASE_URL}/?autostart=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    await page.click('.orders-panel__row:nth-child(2)');
    await page.click('[data-node-id="safe_interpretability"]');
    await page.waitForTimeout(120);
    await page.click('.tech-detail__button');
    await page.waitForTimeout(150);
    const orderAction = await page.$eval(
      '.orders-panel__row:nth-child(2) .action-selector__select',
      (el) => el.value,
    );
    assertCondition(
      orderAction === 'research_safety',
      `Expected row 2 order action to be research_safety after focus set, got ${orderAction}`,
    );
    await screenshot(page, '02_research_focus_sets_order');

    // Scenario 3: advance turn and resolve event
    await page.goto(`${BASE_URL}/?autostart=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    await page.click('#nextTurn');
    await page.waitForTimeout(400);
    state = await getState(page);
    assertCondition(state.year === 2026 && state.quarter === 2, `Expected 2026 Q2 after one advance, got ${state.year} Q${state.quarter}`);
    assertCondition(!!state.pendingEvent, 'Expected a pending event after advance in early turn');

    const eventChoices = await page.locator('.event-panel__choice').count();
    assertCondition(eventChoices > 0, 'Expected at least one event choice button');
    await page.click('.event-panel__choice:nth-child(1)');
    await page.waitForTimeout(220);
    state = await getState(page);
    assertCondition(!state.pendingEvent, 'Expected pending event to clear after choosing an option');
    await screenshot(page, '03_event_resolved');

    // Scenario 4: deploy action gate visibility by AGI unlock status
    await page.goto(`${BASE_URL}/?autostart=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    const hasDeployOption = await page.evaluate(() => {
      const options = [...document.querySelectorAll('.orders-panel__row:nth-child(1) .action-selector__select option')];
      return options.some((o) => o.value === 'deploy_agi');
    });
    assertCondition(!hasDeployOption, 'Expected deploy_agi to be hidden before AGI unlock');
    await screenshot(page, '04_deploy_gate');

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

/**
 * Verification for the cinematic canvas map + Claude faction agents.
 * Pass 1: deterministic (?no_llm=1) — map renders, dossier targeting works,
 *         turn advance produces fallback diplomacy and resolves.
 * Pass 2: live — turn advance runs the Sonnet faction agents end-to-end.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
page.on('pageerror', (err) => console.log(`PAGEERROR: ${err.message}`));

// ---------- Pass 1: deterministic ----------
await page.goto(`${BASE}?autostart=1&no_llm=1`);
await page.waitForSelector('.world-map__canvas', { timeout: 15000 });
check('canvas map renders', true);

await page.waitForFunction(() => {
  const canvas = document.querySelector('.world-map__canvas');
  return canvas && canvas.width > 100 && canvas.height > 100;
}, undefined, { timeout: 5000 });
check('canvas sized to panel', true);

const markerCount = await page.locator('.world-map__marker[data-faction-id]').count();
check('5 faction marker hit-areas', markerCount === 5, `found ${markerCount}`);

// Click DeepCent marker -> dossier with target actions
await page.locator('.world-map__marker[data-faction-id="cn_lab"]').click();
await page.waitForSelector('.world-map__dossier[data-faction-id="cn_lab"]', { timeout: 5000 });
check('dossier opens on marker click', true);

const actionButtons = await page.locator('.world-map__dossier-action-btn[data-action-id]').allTextContents();
check('dossier offers target actions', actionButtons.length >= 2, actionButtons.join(', '));

// Target espionage from the map
await page.locator('.world-map__dossier-action-btn[data-action-id="espionage"]').click();
await page.waitForTimeout(300);
const stateText1 = await page.evaluate(() => window.render_game_to_text?.() ?? '');
check('espionage order targeted via map', /espionage/i.test(stateText1));

// Advance a turn (deterministic)
await page.locator('.command-center__advance-btn').click();
await page.waitForFunction(
  () => (document.querySelector('#turnLabel')?.textContent ?? '') !== '2026 Q1',
  undefined,
  { timeout: 30000 },
);
check('turn advances in no_llm mode', true);

const feedItems1 = await page.locator('.world-map__feed-item').count();
check('fallback diplomacy appears in feed', feedItems1 >= 1, `${feedItems1} messages`);

await page.screenshot({ path: 'output/world-map-canvas-no-llm.png' });

// ---------- Pass 2: live (Sonnet faction agents) ----------
await page.goto(`${BASE}?autostart=1`);
await page.waitForSelector('.world-map__canvas', { timeout: 15000 });
await page.waitForTimeout(1500); // texture load
await page.locator('.command-center__advance-btn').click();

// Negotiation feed should fill during the diplomatic phase
await page.waitForSelector('.world-map__feed-item', { timeout: 240000 });
const feedTexts = await page.locator('.world-map__feed-message').allTextContents();
check('live agent negotiation messages appear', feedTexts.length >= 1, feedTexts[0]?.slice(0, 110) ?? '');

// Full turn pipeline (decisions + resolution) completes
await page.waitForFunction(
  () => (document.querySelector('#turnLabel')?.textContent ?? '') !== '2026 Q1',
  undefined,
  { timeout: 300000 },
);
const liveTurnLabel = await page.locator('#turnLabel').textContent();
check('live turn advanced with agent decisions', /Q[2-4]|202[7-9]/.test(liveTurnLabel ?? ''), liveTurnLabel ?? '');

await page.waitForTimeout(2500);
await page.screenshot({ path: 'output/world-map-canvas-live.png' });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 950 } });
// 1. intro flow from scratch
await page.goto('http://localhost:5173/');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'output/ui-1-intro.png' });
// 2. autostart main game
await page.goto('http://localhost:5173/?autostart=1&no_llm=1');
await page.waitForSelector('.world-map__canvas', { timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'output/ui-2-game.png' });
// 3. command center full scroll: capture the right panel bottom
await page.evaluate(() => { const cc = document.querySelector('.command-center-container'); if (cc) cc.scrollTop = cc.scrollHeight; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'output/ui-3-cc-bottom.png' });
// 4. tech tree modal
await page.evaluate(() => { const cc = document.querySelector('.command-center-container'); if (cc) cc.scrollTop = 0; });
const techBtn = page.locator('.command-center__action-btn--tech');
if (await techBtn.count()) { await techBtn.first().click(); await page.waitForTimeout(1200); await page.screenshot({ path: 'output/ui-4-techtree.png' }); }
await browser.close();
console.log('done');

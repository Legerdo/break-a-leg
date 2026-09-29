// End-to-end browser check: the dev build plays itself (?autoplay) from ACT I to the
// curtain call using the same routes as the headless suite. Fails on any death, page
// error, or if the curtain call is not reached. Usage: node tests/fullrun.mjs (dev server on :5199)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 576 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5199/?autoplay');

const t0 = Date.now();
let lastAct = -1;
let result = null;
while (Date.now() - t0 < 240_000) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => {
    const g = window.__game;
    return { state: g.state, act: g.act, deaths: g.takesBefore + (g.world ? g.world.deaths : 0), wstate: g.world?.state, x: g.world?.player.x };
  });
  if (s.act !== lastAct) {
    console.log(`  act ${s.act + 1} started (${((Date.now() - t0) / 1000).toFixed(1)}s wall clock)`);
    lastAct = s.act;
  }
  if (s.deaths > 0) {
    result = { ok: false, why: `death in act ${s.act + 1} at x=${Math.round(s.x)}` };
    break;
  }
  if (s.state === 'end') {
    await page.waitForTimeout(2600);
    await page.locator('#game').screenshot({ path: 'shots/fullrun-end.png' });
    const fin = await page.evaluate(() => ({ time: window.__game.timeBefore, takes: window.__game.takesBefore + 1 }));
    result = { ok: true, why: `curtain call reached: ${fin.takes} take(s), in-game time ${fin.time.toFixed(1)}s` };
    break;
  }
}
if (!result) result = { ok: false, why: 'timed out before the curtain call' };
if (errors.length) result = { ok: false, why: `${result.why}; page errors: ${errors.join(' | ')}` };
console.log(result.ok ? 'PASS' : 'FAIL', result.why);
await browser.close();
process.exit(result.ok ? 0 : 1);

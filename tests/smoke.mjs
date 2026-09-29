// Smoke test of the production build (vite preview on :5200): title -> menu -> play,
// real keyboard input only. Verifies the player moves, a death respawns within ~1s, and no errors.
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 576 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5200/');
await page.waitForTimeout(500);
const st = () => page.evaluate(() => ({ s: window.__game.state, x: window.__game.world?.player.x ?? -1, d: window.__game.world?.deaths ?? 0, w: window.__game.world?.state }));
await page.keyboard.press('Enter'); // NEW PERFORMANCE
await page.waitForTimeout(1700); // act card
let a = await st();
console.log('after card:', a.s);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
const b = await st();
console.log('moved from', a.x.toFixed(1), 'to', b.x.toFixed(1));
// hop onto the crates, then walk into the first pit on purpose: death -> respawn timing
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 200; i++) {
  if ((await st()).x >= 118) break;
  await page.waitForTimeout(10);
}
await page.keyboard.down('Space');
await page.waitForTimeout(450);
await page.keyboard.up('Space');
let tDeath = 0;
const t0 = Date.now();
while (Date.now() - t0 < 6000) {
  const s = await st();
  if (s.w === 'dying' && !tDeath) {
    tDeath = Date.now();
    await page.keyboard.up('ArrowRight');
  }
  if (tDeath && s.w === 'play') {
    console.log(`death -> control again in ${Date.now() - tDeath} ms (deaths=${s.d})`);
    break;
  }
  await page.waitForTimeout(16);
}
await page.keyboard.up('ArrowRight');
// R retry and Esc pause
await page.keyboard.press('KeyR');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const p = await st();
console.log('after Esc:', p.s, '| takes after R:', p.d);
await page.keyboard.press('Escape');
const ok = b.x > a.x + 20 && tDeath > 0 && p.s === 'pause' && errors.length === 0;
console.log(ok ? 'PASS' : 'FAIL', errors.join(' | '));
await browser.close();
process.exit(ok ? 0 : 1);

// Browser screenshots via the locally installed Chrome (playwright-core, no downloads).
// Usage: node tests/shots.mjs [baseUrl]   (expects `npm run dev -- --port 5199` running)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5199/';
const out = 'shots';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 576 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const wait = (ms) => page.waitForTimeout(ms);
async function shot(name) {
  await page.locator('#game').screenshot({ path: `${out}/${name}.png` });
  console.log('saved', name);
}
async function hold(key, ms) {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
}

const scenes = (process.env.SCENES ?? 'title,act1,act2,act3,finale,end').split(',');

if (scenes.includes('title')) {
  await page.goto(base);
  await wait(600);
  await shot('01-title');
  await page.keyboard.press('Space');
  await wait(700);
  await shot('02-card');
}
if (scenes.includes('act1')) {
  await page.goto(base + '?act=1&skipcard');
  await wait(900);
  await shot('10-act1-start');
  await hold('ArrowRight', 1200);
  await shot('11-act1-crates');
  await page.goto(base + '?act=1&cp=1&skipcard');
  await wait(800);
  await hold('ArrowRight', 1500);
  await wait(250);
  await shot('12-act1-headroom-death');
  await page.goto(base + '?act=1&cp=2&skipcard');
  await wait(800);
  await hold('ArrowRight', 900);
  await shot('13-act1-bigger');
}
if (scenes.includes('act2')) {
  await page.goto(base + '?act=2&skipcard');
  await wait(900);
  await hold('ArrowRight', 700);
  await shot('20-act2-knights');
  await page.goto(base + '?act=2&cp=1&skipcard');
  await wait(900);
  await shot('21-act2-probe');
}
if (scenes.includes('act3')) {
  await page.goto(base + '?act=3&skipcard');
  await wait(900);
  await hold('ArrowRight', 600);
  await shot('30-act3-tunnel');
  await page.goto(base + '?act=3&cp=1&skipcard');
  await wait(1400);
  await shot('31-act3-double');
}
if (scenes.includes('finale')) {
  await page.goto(base + '?act=4&skipcard');
  await wait(900);
  await hold('ArrowRight', 1700);
  await shot('40-finale-chase');
  await page.goto(base + '?act=4&cp=1&skipcard');
  await wait(900);
  await hold('ArrowRight', 1200);
  await shot('41-finale-mark');
}
if (scenes.includes('end')) {
  await page.goto(base + '?end');
  await wait(2600);
  await shot('50-curtain-call');
}

if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();

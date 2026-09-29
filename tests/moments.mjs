// Screenshots of specific design moments (teleports the player via the dev handle).
// Usage: node tests/moments.mjs [names...]   (dev server on :5199)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = 'http://localhost:5199/';
mkdirSync('shots', { recursive: true });
const want = process.argv.slice(2);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 576 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => {
  await page.locator('#game').screenshot({ path: `shots/${n}.png` });
  console.log('saved', n);
};
async function hold(key, ms) {
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
}
async function open(act, cp = -1) {
  await page.goto(`${base}?act=${act}&cp=${cp}&skipcard`);
  await wait(700);
}
/** Teleport the player to (segment, tile x) on the floor row given. */
async function tp(seg, tile, row = 8) {
  await page.evaluate(
    ([seg, tile, row]) => {
      const w = window.__game.world;
      w.player.x = w.segX(seg) + tile * 16 + 3;
      w.player.y = (row + 1) * 16 - 14;
      w.player.vx = 0;
      w.player.vy = 0;
      w.snapCamera();
    },
    [seg, tile, row],
  );
  await wait(50);
}

const moments = {
  async t1() {
    await open(1);
    await tp('I-mark', 7);
    await hold('ArrowRight', 380);
    await wait(500);
    await shot('m-t1-mark-pit');
  },
  async t2() {
    await open(1);
    await tp('I-bridge', 3);
    await hold('ArrowRight', 330);
    await wait(700);
    await shot('m-t2-bridge');
  },
  async t3() {
    await open(1, 1);
    await tp('I-headroom', 6);
    await hold('ArrowRight', 800);
    await wait(120);
    await shot('m-t3-headroom');
  },
  async t8() {
    await open(2);
    await tp('II-center', 9);
    await wait(1750);
    await shot('m-t8-center');
  },
  async t9() {
    await open(2, 1);
    await hold('ArrowRight', 420);
    await wait(900);
    await shot('m-t9-probe');
  },
  async t12() {
    await open(3);
    await tp('III-tunnel', 12);
    await hold('ArrowRight', 330);
    await wait(900);
    await shot('m-t12-sealed');
  },
  async t13() {
    await open(3);
    await tp('III-ghost', 17, 4);
    await wait(300);
    await shot('m-t13-ghost-before');
  },
  async t14() {
    await open(3, 1);
    await wait(900);
    await tp('III-double', 3);
    await wait(900);
    await shot('m-t14-double');
  },
  async t15() {
    await open(3, 2);
    await tp('III-bag', 6);
    await wait(600);
    await shot('m-t15-bag');
  },
  async t16() {
    await open(3, 2);
    await tp('III-tape', 4);
    await wait(300);
    await shot('m-t16-tape');
  },
  async chase() {
    await open(4);
    await hold('ArrowRight', 2000);
    await shot('m-f-chase');
  },
  async lift() {
    await open(4, 1);
    await tp('F-mark', 11);
    await wait(1400);
    await shot('m-f-lift');
  },
  async understudy() {
    await open(4, 1);
    await hold('ArrowRight', 900);
    await wait(1300);
    await shot('m-f-understudy');
  },
  async chase2() {
    await open(4);
    await hold('ArrowRight', 1250);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await wait(500);
    await page.keyboard.up('Space');
    await wait(900);
    await page.keyboard.up('ArrowRight');
    await wait(150);
    await shot('m-f-chase2');
  },
  async hint() {
    await open(3);
    await tp('III-tunnel', 12);
    await hold('ArrowRight', 330);
    await wait(2300);
    await shot('m-t12-hint');
  },
  async seams() {
    await open(2, 1);
    await tp('II-seams', 1);
    await hold('ArrowRight', 250);
    await wait(250);
    await shot('m-ii-seams');
  },
  async mixed() {
    await open(3, 2);
    await hold('ArrowRight', 300);
    await wait(400);
    await shot('m-iii-mixed');
  },
  async fwings() {
    await open(4);
    await tp('F-wings', 0);
    await wait(450);
    await shot('m-f-wings');
  },
  async pause() {
    await open(2);
    await page.keyboard.press('Escape');
    await wait(200);
    await shot('m-pause');
  },
  async end() {
    await page.goto(base + '?end');
    await wait(3000);
    await shot('m-end');
  },
};

for (const [name, fn] of Object.entries(moments)) {
  if (want.length && !want.includes(name)) continue;
  await fn();
}
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();

// Compose several screenshots into one contact sheet (max 1440x576) to review them together.
// Usage: node tests/sheet.mjs out.png a.png b.png ...   (up to 6 images, 3 per row)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [out, ...files] = process.argv.slice(2);
const imgs = files.map((f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`);
const cols = Math.min(3, imgs.length);
const rows = Math.ceil(imgs.length / cols);
const W = 480;
const H = 288;
const html = `<html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${W}px);gap:0">
${imgs.map((s, i) => `<div style="position:relative;width:${W}px;height:${H}px"><img src="${s}" style="width:${W}px;height:${H}px;image-rendering:pixelated"><span style="position:absolute;left:4px;bottom:2px;color:#ff0;font:12px monospace;background:#000a">${files[i].split(/[\\/]/).pop()}</span></div>`).join('')}
</body></html>`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: cols * W, height: rows * H } });
await page.setContent(html);
await page.waitForTimeout(200);
await page.screenshot({ path: out });
await browser.close();
console.log('sheet', out, `${cols * W}x${rows * H}`);

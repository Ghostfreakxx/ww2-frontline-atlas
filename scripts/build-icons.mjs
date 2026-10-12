// Renders public/icons/icon.svg to the PNG sizes used by the web app manifest and iOS.
// Usage: node scripts/build-icons.mjs  (uses Playwright's Chromium)
import fs from 'node:fs';
import { chromium } from 'playwright';

const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
const out = [
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/icon-512.png', 512, 1],
  // Maskable: content inside the 80% safe zone; the dark background fills the bleed.
  ['public/icons/maskable-512.png', 512, 0.8],
  ['src/app/apple-icon.png', 180, 1],
  ['src/app/icon.png', 64, 1],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, scale] of out) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * scale);
  await page.setContent(`<html><body style="margin:0;background:#161718;display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: false });
  console.log(file);
}
await browser.close();

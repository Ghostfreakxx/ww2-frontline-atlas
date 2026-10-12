// Dev helper: screenshot a URL. usage: node scripts/dev/shot-url.mjs <url> <out.png> [w] [h] [waitMs]
import { chromium } from 'playwright';
const [url, out, w, h, wait] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w || 1920, height: +h || 1080 }, deviceScaleFactor: 1 });
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(url, { waitUntil: 'load' });
await p.waitForTimeout(+wait || 2500);
await p.screenshot({ path: out });
await b.close();

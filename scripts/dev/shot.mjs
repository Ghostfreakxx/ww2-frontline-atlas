// Dev helper: rasterise an SVG/HTML file with the pre-installed Chromium.
import fs from 'node:fs';
import { chromium } from 'playwright';
const [inp, out, w, h] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w || 1600, height: +h || 1000 } });
await p.setContent(`<html><body style="margin:0">${fs.readFileSync(inp, 'utf8')}</body></html>`);
await p.screenshot({ path: out });
await b.close();

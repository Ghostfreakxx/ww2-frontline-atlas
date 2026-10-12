// Dev helper: render the display for given dates/cameras.
// usage: node scripts/dev/shoot-dates.mjs <base> <outDir> "1942-11-18@40,48,1.8@full" ...
import fs from 'node:fs';
import { chromium } from 'playwright';
import { initialState } from '../../src/lib/sync/state.ts';
const [base, out, ...specs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { code, token } = await (await fetch(`${base}/api/session`, { method: 'POST' })).json();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${base}/display?code=${code}&clean=1`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
let seq = 1;
for (const spec of specs) {
  const [date, cam, layout = 'full', extra = ''] = spec.split('@');
  const [lon, lat, zoom] = cam.split(',').map(Number);
  const s = { ...initialState(), date, layout, camera: { lon, lat, zoom, ms: 0, seq: seq++ }, caption: null };
  if (extra.includes('prev')) s.layers.prevFront = true;
  if (extra.includes('sectors')) s.layers.sectors = true;
  await fetch(`${base}/api/session/${code}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: s }) });
  await page.waitForTimeout(1500);
  const name = `${date}_${layout}.png`;
  await page.screenshot({ path: `${out}/${name}` });
  console.log(name);
}
await b.close();

// Dev helper: measure display frame times during a camera flight with different layer settings.
import { chromium } from 'playwright';
import { initialState } from '../../src/lib/sync/state.ts';
const [base] = process.argv.slice(2);
const { code, token } = await (await fetch(`${base}/api/session`, { method: 'POST' })).json();
const b = await chromium.launch({ args: process.env.GPU ? ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] : [] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${base}/display?code=${code}&clean=1`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
let seq = 1;
const put = (s) => fetch(`${base}/api/session/${code}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: s }) });
for (const [label, patch] of [
  ['all layers', {}],
  ['no relief', { relief: false }],
  ['no rivers/borders', { rivers: false, borders: false }],
  ['no relief/rivers/borders/territory', { relief: false, rivers: false, borders: false, territory: false }],
]) {
  const s0 = { ...initialState(), date: '1941-10-01', layout: 'split-right', layers: { ...initialState().layers, ...patch }, camera: { lon: 25, lat: 52, zoom: 1.4, ms: 0, seq: seq++ } };
  await put(s0);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__f = []; let last = performance.now(); const loop = (t) => { window.__f.push(t - last); last = t; if (window.__f.length < 400) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await put({ ...s0, camera: { lon: 37, lat: 55.5, zoom: 4, ms: 2500, seq: seq++ } });
  await page.waitForTimeout(3000);
  const f = (await page.evaluate(() => window.__f.slice(3))).sort((a, b) => a - b);
  console.log(label.padEnd(36), 'frames', f.length, 'median', f[Math.floor(f.length / 2)]?.toFixed(1), 'p90', f[Math.floor(f.length * 0.9)]?.toFixed(1));
}
await b.close();

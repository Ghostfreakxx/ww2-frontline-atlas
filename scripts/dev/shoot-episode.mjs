// Dev helper: render every scene/step of the Barbarossa episode on the audience display.
// usage: node scripts/dev/shoot-episode.mjs <base-url> <outDir> [filter e.g. "3,4"]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { barbarossaEpisode as ep } from '../../src/data/conflicts/ww2-europe/episodes/barbarossa.ts';
import { sceneState } from '../../src/lib/episodes/apply.ts';
import { initialState } from '../../src/lib/sync/state.ts';
const [base, out, filter] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { code, token } = await (await fetch(`${base}/api/session`, { method: 'POST' })).json();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${base}/display?code=${code}&clean=1`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
let s = initialState();
const only = filter ? filter.split(',').map(Number) : null;
for (let i = 0; i < ep.scenes.length; i++) {
  if (only && !only.includes(i + 1)) continue;
  for (let j = 0; j <= ep.scenes[i].steps.length; j++) {
    s = sceneState({ ...s, sceneId: j === 0 ? null : s.sceneId }, ep, i, j, Date.now(), { animate: false });
    if (s.playback.playing) s = { ...s, date: s.playback.endDate, playback: { ...s.playback, playing: false } };
    s.camera.ms = 0;
    await fetch(`${base}/api/session/${code}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ state: s }) });
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/s${i + 1}-${j}.png` });
    console.log(`s${i + 1}-${j}`, s.date, ep.scenes[i].steps[j - 1]?.label ?? 'base');
  }
}
await b.close();

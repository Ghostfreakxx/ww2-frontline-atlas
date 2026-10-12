// Builds a shaded-relief raster in the atlas projection from AWS Open Data terrain tiles
// (Mapzen "terrarium" encoding; sources include SRTM, GMTED2010 and ETOPO1).
// Output: public/geo/relief.jpg + public/geo/relief.json (world-coordinate placement).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { makeProjection } from '../src/lib/map/makeProjection.mjs';

const Z = Number(process.env.RELIEF_ZOOM || 6);
const CACHE = process.env.TILE_CACHE || path.resolve('.geo-raw/terrarium');
const cfg = JSON.parse(fs.readFileSync('src/data/geo/projection.json', 'utf8'));
const projection = makeProjection(cfg);
const [W, S, E, N] = cfg.dataBBox;
fs.mkdirSync(CACHE, { recursive: true });

const lon2x = (lon) => ((lon + 180) / 360) * 2 ** Z;
const lat2y = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z; };
const tx0 = Math.floor(lon2x(W)), tx1 = Math.floor(lon2x(E));
const ty0 = Math.floor(lat2y(N)), ty1 = Math.floor(lat2y(S));
const cols = tx1 - tx0 + 1, rows = ty1 - ty0 + 1;
console.log(`tiles z${Z}: ${cols}x${rows} = ${cols * rows}`);

async function getTile(x, y) {
  const f = path.join(CACHE, `${Z}-${x}-${y}.png`);
  if (!fs.existsSync(f)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${url}`);
        fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
        break;
      } catch (e) { if (attempt > 3) throw e; await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt)); }
    }
  }
  return PNG.sync.read(fs.readFileSync(f));
}

const mosaicW = cols * 256, mosaicH = rows * 256;
const elev = new Float32Array(mosaicW * mosaicH);
const jobs = [];
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty]);
let done = 0;
async function worker() {
  while (jobs.length) {
    const [tx, ty] = jobs.shift();
    const png = await getTile(tx, ty);
    const ox = (tx - tx0) * 256, oy = (ty - ty0) * 256;
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const k = (j * 256 + i) * 4;
      elev[(oy + j) * mosaicW + ox + i] = png.data[k] * 256 + png.data[k + 1] + png.data[k + 2] / 256 - 32768;
    }
    if (++done % 50 === 0) console.log('tiles', done);
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

function sample(lon, lat) {
  const fx = (lon2x(lon) - tx0) * 256 - 0.5, fy = (lat2y(lat) - ty0) * 256 - 0.5;
  const x0 = Math.max(0, Math.min(mosaicW - 2, Math.floor(fx))), y0 = Math.max(0, Math.min(mosaicH - 2, Math.floor(fy)));
  const dx = Math.min(1, Math.max(0, fx - x0)), dy = Math.min(1, Math.max(0, fy - y0));
  const a = elev[y0 * mosaicW + x0], b = elev[y0 * mosaicW + x0 + 1], c = elev[(y0 + 1) * mosaicW + x0], d = elev[(y0 + 1) * mosaicW + x0 + 1];
  return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
}

// Output raster covers the projected bounds of the data bbox.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) {
  const p = projection([W + ((E - W) * i) / 60, S + ((N - S) * j) / 60]);
  minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
}
const OUT_W = Number(process.env.RELIEF_WIDTH || 3600);
const scale = OUT_W / (maxX - minX);
const OUT_H = Math.round((maxY - minY) * scale);
console.log(`raster ${OUT_W}x${OUT_H}`);
const grid = new Float32Array(OUT_W * OUT_H);
const lonA = new Float32Array(OUT_W * OUT_H), latA = new Float32Array(OUT_W * OUT_H);
for (let j = 0; j < OUT_H; j++) for (let i = 0; i < OUT_W; i++) {
  const ll = projection.invert([minX + (i + 0.5) / scale, minY + (j + 0.5) / scale]);
  const k = j * OUT_W + i;
  lonA[k] = ll[0]; latA[k] = ll[1];
  grid[k] = ll[0] < W || ll[0] > E || ll[1] < S || ll[1] > N ? 0 : Math.max(0, sample(ll[0], ll[1]));
}
const R = 6371000, rad = Math.PI / 180;
const dist = (k1, k2) => {
  const dLat = (latA[k2] - latA[k1]) * rad, dLon = (lonA[k2] - lonA[k1]) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(latA[k1] * rad) * Math.cos(latA[k2] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};
const ZF = Number(process.env.RELIEF_EXAGGERATION || 9);
const lights = [[315, 45, 0.6], [270, 40, 0.2], [360, 50, 0.2]];
const tints = [[0, [255, 255, 255]], [150, [252, 250, 244]], [400, [244, 238, 224]], [900, [234, 222, 200]], [1800, [222, 204, 176]], [3000, [212, 194, 168]]];
function tint(e) {
  for (let t = 1; t < tints.length; t++) if (e < tints[t][0]) {
    const [e0, c0] = tints[t - 1], [e1, c1] = tints[t];
    const u = (e - e0) / (e1 - e0);
    return c0.map((v, i) => v + (c1[i] - v) * u);
  }
  return tints[tints.length - 1][1];
}
const rgba = Buffer.alloc(OUT_W * OUT_H * 4);
for (let j = 0; j < OUT_H; j++) for (let i = 0; i < OUT_W; i++) {
  const k = j * OUT_W + i;
  const kl = j * OUT_W + Math.max(0, i - 1), kr = j * OUT_W + Math.min(OUT_W - 1, i + 1);
  const ku = Math.max(0, j - 1) * OUT_W + i, kd = Math.min(OUT_H - 1, j + 1) * OUT_W + i;
  const dxm = dist(kl, kr) || 1, dym = dist(ku, kd) || 1;
  const gx = ((grid[kr] - grid[kl]) / dxm) * ZF, gy = ((grid[kd] - grid[ku]) / dym) * ZF;
  const slope = Math.atan(Math.hypot(gx, gy)), aspect = Math.atan2(gy, -gx);
  let shade = 0, flat = 0;
  for (const [az, alt, w] of lights) {
    const zen = (90 - alt) * rad, azr = ((360 - az + 90) % 360) * rad;
    shade += w * Math.max(0, Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(azr - aspect));
    flat += w * Math.cos(zen);
  }
  const s = Math.min(1.0, shade / flat);
  const f = 0.42 + 0.58 * s;
  const c = tint(grid[k]);
  rgba[k * 4] = Math.round(c[0] * f); rgba[k * 4 + 1] = Math.round(c[1] * f); rgba[k * 4 + 2] = Math.round(c[2] * f); rgba[k * 4 + 3] = 255;
}
const out = jpeg.encode({ data: rgba, width: OUT_W, height: OUT_H }, 80);
fs.writeFileSync('public/geo/relief.jpg', out.data);
fs.writeFileSync('public/geo/relief.json', JSON.stringify({ x: minX, y: minY, width: maxX - minX, height: maxY - minY, pixelWidth: OUT_W, pixelHeight: OUT_H, source: 'terrain-tiles' }, null, 2));
console.log('relief.jpg', (out.data.length / 1024).toFixed(0), 'KB');

// Builds the base geography used by the atlas from Natural Earth (public domain).
// Input: raw Natural Earth GeoJSON files (download with scripts/fetch-geo.sh).
// Output: compact, clipped and simplified GeoJSON in public/geo/.
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';

// d3-geo expects exterior rings clockwise and holes anticlockwise (spherical convention, the opposite of RFC 7946).
// polygon-clipping returns exterior rings anticlockwise, so rewind every polygon before writing it.
function shoelace(r) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; }
function rewindForD3(mp) {
  return mp.map((poly) => poly.map((r, k) => {
    const ccw = shoelace(r) > 0;
    return (k === 0 ? ccw : !ccw) ? r.slice().reverse() : r;
  }));
}

const RAW = process.env.NE_RAW_DIR || path.resolve('.geo-raw');
const OUT = path.resolve('public/geo');
const proj = JSON.parse(fs.readFileSync('src/data/geo/projection.json', 'utf8'));
const [W, S, E, N] = proj.dataBBox;
const load = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const round = (v) => Math.round(v * 1000) / 1000;

function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const ringClean = (ring, tol) => {
  const r = dp(ring, tol).map(([x, y]) => [round(x), round(y)]);
  return r.length >= 4 ? r : null;
};
const clipBox = [[[W, S], [E, S], [E, N], [W, N], [W, S]]];
function polys(geom) {
  if (!geom) return [];
  return geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
}
function clipPolygonFeature(f, tol, minArea = 0) {
  let mp;
  try { mp = polygonClipping.intersection(polys(f.geometry), clipBox); } catch { return null; }
  const out = [];
  for (const poly of mp) {
    const rings = poly.map((r) => ringClean(r, tol)).filter(Boolean);
    if (!rings.length) continue;
    if (minArea && Math.abs(area(rings[0])) < minArea) continue;
    out.push(rings);
  }
  if (!out.length) return null;
  return { type: 'Feature', properties: f.properties, geometry: { type: 'MultiPolygon', coordinates: rewindForD3(out) } };
}
function area(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return a / 2;
}
const inBox = ([x, y]) => x >= W && x <= E && y >= S && y <= N;
function clipLineFeature(f, tol) {
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [];
  const out = [];
  for (const line of lines) {
    let cur = [];
    for (const p of line) {
      if (inBox(p)) cur.push(p);
      else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
  }
  const simplified = out.map((l) => dp(l, tol).map(([x, y]) => [round(x), round(y)])).filter((l) => l.length > 1);
  if (!simplified.length) return null;
  return { type: 'Feature', properties: f.properties, geometry: { type: 'MultiLineString', coordinates: simplified } };
}
const write = (name, features) => {
  const fc = { type: 'FeatureCollection', features };
  const s = JSON.stringify(fc);
  fs.writeFileSync(path.join(OUT, name), s);
  console.log(name, features.length, 'features', (s.length / 1024).toFixed(0) + ' KB');
};

fs.mkdirSync(OUT, { recursive: true });

// Land
const land = load('ne_50m_land.geojson').features.map((f) => clipPolygonFeature(f, 0.012, 0.004)).filter(Boolean)
  .map((f) => ({ ...f, properties: {} }));
write('land.json', land);

// Modern countries: used only as building blocks for historical reconstructions and as an optional faint reference layer.
const countries = load('ne_50m_admin_0_countries.geojson').features.map((f) => clipPolygonFeature(f, 0.012, 0.002)).filter(Boolean)
  .map((f) => ({ ...f, properties: { iso: f.properties.ADM0_A3, name: f.properties.NAME } }));
write('modern-countries.json', countries);

// Lakes
const lakes = load('ne_10m_lakes.geojson').features
  .map((f) => clipPolygonFeature(f, 0.01, 0.02)).filter(Boolean)
  .map((f) => ({ ...f, properties: { name: f.properties.name || null } }));
write('lakes.json', lakes);

// Rivers: major world rivers + selected European rivers that matter for 1939–45 operations.
const EU_RIVERS = new Set(['Narew', 'San', 'Prypyat', 'Byarezina', 'Sozh', 'Seversky Donets', 'Luga', 'Shelon', 'Pilica', 'Bzura', 'Haryn', 'Sluch', 'Styr', 'Teteriv', 'Ros', 'Daugava', 'Oskol', 'Chyr', 'Khoper', 'Manych', 'Sal', 'Desna', 'Oka', 'Pissa', 'Drysa', 'Kasplya', 'Ilovlya', 'Medveditsa', 'Bityog', 'Siret', 'Ialomița', 'Argeș', 'Jiu', 'Timiş', 'Maritsa', 'Strimonas', 'Saône', 'Somme', 'Oder', 'Elbe', 'Saale', 'Spree', 'Neckar', 'Isar', 'Sava', 'Arno', 'Piave', 'Adige', 'Moldova', 'Prut', 'Snov', 'Msta', 'Mologa', 'Klyazma', 'Sura', 'Samara', 'Noteć', 'Ruhr', 'Lippe', 'Sarre', 'Sûre', 'Dyje', 'Vah', 'Hron', 'Warta', 'Synyukha', 'Mius', 'Volkhov', 'Lovat']);
const MIN_RANK = 8;
const rivers = [];
for (const f of load('ne_10m_rivers_lake_centerlines.geojson').features) {
  if (f.properties.featurecla && /Lake Centerline/.test(f.properties.featurecla) && !f.properties.name) continue;
  if (f.properties.scalerank > MIN_RANK) continue;
  const c = clipLineFeature(f, 0.01);
  if (c) rivers.push({ ...c, properties: { name: f.properties.name_en || f.properties.name || null, rank: f.properties.scalerank } });
}
for (const f of load('ne_10m_rivers_europe.geojson').features) {
  if (!EU_RIVERS.has(f.properties.name)) continue;
  const c = clipLineFeature(f, 0.01);
  if (c) rivers.push({ ...c, properties: { name: f.properties.name_en || f.properties.name, rank: f.properties.scalerank } });
}
write('rivers.json', rivers);

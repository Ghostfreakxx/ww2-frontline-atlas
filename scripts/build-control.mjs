// Builds historical political-control polygons and frontline geometry from the reconstruction data.
// Inputs:  raw Natural Earth 1:50m countries + 1:10m rivers (NE_RAW_DIR), src/data/conflicts/ww2-europe/*.ts
// Outputs: public/geo/territory-<date>.json, public/geo/fronts.json
import fs from 'node:fs';
import { projectionConfig } from '../src/data/geo/projection.ts';
import path from 'node:path';
import pc from 'polygon-clipping';
import { territorySnapshots, GERMAN_SOVIET_1939, RIGA_1921, BESSARABIA_BUKOVINA } from '../src/data/conflicts/ww2-europe/territory.ts';
import { frontlines, closingRoutes, frontTerritoryBasis } from '../src/data/conflicts/ww2-europe/frontlines.ts';

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
const cfg = projectionConfig;
const [W, S, E, N] = cfg.dataBBox;
const load = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const round = (v) => Math.round(v * 1000) / 1000;
const clipBox = [[[W, S], [E, S], [E, N], [W, N], [W, S]]];

// ---------- geometry helpers ----------
const asMulti = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const closeRing = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]);
const ringPoly = (r) => [[closeRing(r)]];
function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]]; const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop(); const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy; let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]; let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0; t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py, d = ex * ex + ey * ey; if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; }
function simplifyMulti(mp, tol, minArea = 0.0005) {
  const out = [];
  for (const poly of mp) {
    const rings = poly.map((r) => dp(r, tol).map(([x, y]) => [round(x), round(y)])).filter((r) => r.length >= 4 && Math.abs(ringArea(r)) > minArea / 10);
    if (rings.length && Math.abs(ringArea(rings[0])) > minArea) out.push(rings);
  }
  return rewindForD3(out);
}
function pointInRing(pt, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInMulti(pt, mp) {
  for (const poly of mp) {
    if (!pointInRing(pt, poly[0])) continue;
    let hole = false; for (let k = 1; k < poly.length; k++) if (pointInRing(pt, poly[k])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}
const safe = (fn, label) => { try { return fn(); } catch (e) { console.warn('polygon op failed:', label, e.message); return []; } };

// ---------- inputs ----------
const countries = new Map();
for (const f of load('ne_50m_admin_0_countries.geojson').features) {
  const iso = f.properties.ADM0_A3;
  const clipped = safe(() => pc.intersection(asMulti(f.geometry), clipBox), iso);
  if (!clipped.length) continue;
  countries.set(iso, countries.has(iso) ? pc.union(countries.get(iso), clipped) : clipped);
}
const riversWorld = load('ne_10m_rivers_lake_centerlines.geojson').features;
const riversEurope = load('ne_10m_rivers_europe.geojson').features;

function riverReach(name, file, from, to) {
  const feats = (file === 'world' ? riversWorld : riversEurope).filter((f) => f.properties.name === name);
  const lines = feats.flatMap((f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates));
  // Join parts end-to-end where they touch so a reach can span several parts.
  const merged = [];
  const pool = lines.map((l) => l.slice());
  while (pool.length) {
    let cur = pool.shift(); let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]; const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d(cur[cur.length - 1], l[0]) < 0.02) { cur = cur.concat(l.slice(1)); pool.splice(i, 1); grew = true; break; }
        if (d(l[l.length - 1], cur[0]) < 0.02) { cur = l.concat(cur.slice(1)); pool.splice(i, 1); grew = true; break; }
      }
    }
    merged.push(cur);
  }
  let best = null;
  for (const line of merged) {
    let iF = 0, iT = 0, dF = Infinity, dT = Infinity;
    line.forEach((p, i) => {
      const a = Math.hypot(p[0] - from[0], p[1] - from[1]); if (a < dF) { dF = a; iF = i; }
      const b = Math.hypot(p[0] - to[0], p[1] - to[1]); if (b < dT) { dT = b; iT = i; }
    });
    if (!best || dF + dT < best.score) best = { score: dF + dT, line, iF, iT };
  }
  if (!best || best.score > 0.3) throw new Error(`river reach ${name} not found near ${from} → ${to} (score ${best && best.score})`);
  const { line, iF, iT } = best;
  return iF <= iT ? line.slice(iF, iT + 1) : line.slice(iT, iF + 1).reverse();
}
function assemble(parts) {
  const out = [];
  for (const part of parts) {
    const pts = 'pts' in part ? part.pts : riverReach(part.river, part.file, part.from, part.to);
    for (const p of pts) { const last = out[out.length - 1]; if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p); }
  }
  return out;
}

const line1939 = assemble(GERMAN_SOVIET_1939);
const dniesterReach = riverReach('Dniester', 'world', [26.42, 48.53], [25.73, 48.62]);
const bessLine = assemble(BESSARABIA_BUKOVINA);
const NAMED = {
  EAST_OF_1939_LINE: [[...line1939, [22.87, 48.5], [32, 48.5], [32, 56], [23.5, 56]]],
  WEST_OF_RIGA: [[...RIGA_1921, ...dniesterReach.slice(1), [25.57, 48.45], [25.18, 48.26], [24.85, 47.95], [20, 47.95], [20, 56], [28.15, 56]]],
  BESSARABIA_BUKOVINA: [[...bessLine]],
};
const ringOf = (ref) => (Array.isArray(ref) ? ringPoly(ref) : [NAMED[ref.ref].map(closeRing)]);

function buildUnit(u) {
  let geom = [];
  for (const iso of u.include) {
    const g = countries.get(iso);
    if (!g) { console.warn(`  [${u.id}] missing country ${iso}`); continue; }
    geom = geom.length ? robust('union', geom, g, u.id) : g;
  }
  for (const r of u.intersect || []) geom = robust('intersection', geom, ringOf(r), u.id + ' intersect');
  for (const r of u.subtract || []) geom = robust('difference', geom, ringOf(r), u.id + ' subtract');
  for (const r of u.add || []) geom = pc.union(geom, ringPoly(r));
  return geom;
}

// ---------- territory snapshots ----------
const territoryGeom = new Map(); // snapshot id -> Map(unit id -> {unit, geom})
for (const snap of territorySnapshots) {
  const units = new Map();
  const features = [];
  for (const u of snap.units) {
    const geom = buildUnit(u);
    units.set(u.id, { unit: u, geom });
    const simple = simplifyMulti(geom, 0.01);
    if (!simple.length) { console.warn(`  [${snap.id}] empty unit ${u.id}`); continue; }
    features.push({ type: 'Feature', properties: { id: u.id, name: u.name, status: u.status, note: u.note || null, confidence: u.confidence, labelAt: u.labelAt || null }, geometry: { type: 'MultiPolygon', coordinates: simple } });
  }
  territoryGeom.set(snap.id, units);
  const file = `territory-${snap.date}.json`;
  const s = JSON.stringify({ type: 'FeatureCollection', id: snap.id, features });
  fs.writeFileSync(path.join(OUT, file), s);
  console.log(file, features.length, 'units', (s.length / 1024).toFixed(0) + ' KB');
}

// ---------- fronts ----------
const AXIS_STATUSES = new Set(['reich', 'reich-annexed', 'german-occupied', 'german-civil-admin', 'axis', 'axis-occupied', 'cobelligerent']);
const roundGeom = (g, d = 1e5) => g.map((poly) => poly.map((r) => r.map(([x, y]) => [Math.round(x * d) / d, Math.round(y * d) / d])));
/** polygon-clipping occasionally fails on nearly-coincident edges; retry with coordinates snapped to a grid. */
function robust(op, a, b, label) {
  for (const d of [0, 1e6, 1e5, 1e4]) {
    try { return d ? pc[op](roundGeom(a, d), roundGeom(b, d)) : pc[op](a, b); } catch { /* retry */ }
  }
  console.warn('polygon op failed after retries:', op, label);
  return op === 'union' ? a : op === 'difference' ? a : [];
}
function unionWhere(snapId, pred) {
  let g = [];
  for (const { unit, geom } of territoryGeom.get(snapId).values()) if (pred(unit)) g = g.length ? robust('union', g, geom, unit.id) : geom;
  return g;
}

/** Edges of `home` that border `other` (tested by offsetting edge midpoints). Returns polylines. */
function sharedBoundary(home, others) {
  const chains = [];
  for (const poly of home) for (const ring of poly) {
    const flags = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len * 0.02, ny = (x2 - x1) / len * 0.02;
      let hit = null;
      for (const [label, g] of others) if (pointInMulti([mx + nx, my + ny], g) || pointInMulti([mx - nx, my - ny], g)) { hit = label; break; }
      flags.push(hit);
    }
    let cur = null;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i]) {
        if (!cur || cur.label !== flags[i]) { cur = { label: flags[i], pts: [ring[i]] }; chains.push(cur); }
        cur.pts.push(ring[i + 1]);
      } else cur = null;
    }
  }
  // merge chains that connect end-to-start
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < chains.length && !merged; i++) for (let j = 0; j < chains.length && !merged; j++) {
      if (i === j || chains[i].label !== chains[j].label) continue;
      const a = chains[i].pts, b = chains[j].pts;
      if (a[a.length - 1][0] === b[0][0] && a[a.length - 1][1] === b[0][1]) { chains[i].pts = a.concat(b.slice(1)); chains.splice(j, 1); merged = true; }
    }
  }
  return chains.filter((c) => c.pts.length > 1);
}

const fronts = [];
const homeCache = new Map();
for (const fl of frontlines) {
  const basisAll = frontTerritoryBasis[fl.theatre];
  const basis = basisAll && (!basisAll.from || fl.date >= basisAll.from) ? basisAll : null;
  const homeKey = basis ? basis.territory + '|' + basis.defenderStatus.join(',') : null;
  if (homeKey && !homeCache.has(homeKey)) homeCache.set(homeKey, unionWhere(basis.territory, (u) => basis.defenderStatus.includes(u.status)));
  const home = homeKey ? homeCache.get(homeKey) : [];
  const entry = { id: fl.id, theatre: fl.theatre, date: fl.date, lines: [], held: null, heldSide: basis ? basis.heldSide : null, pockets: [] };
  if (!fl.segments.length && basis && basis.heldSide === 'axis') {
    // Derived frontier: boundary between the defender's territory and Axis-controlled territory.
    const axisFin = unionWhere(basis.territory, (u) => u.status === 'cobelligerent');
    const axisMain = unionWhere(basis.territory, (u) => AXIS_STATUSES.has(u.status) && u.status !== 'cobelligerent');
    const chains = sharedBoundary(home, [['main', axisMain], ['finnish', axisFin]]);
    for (const ch of chains) {
      const pts = dp(ch.pts, 0.004).map(([x, y]) => [round(x), round(y)]);
      entry.lines.push({ segment: ch.label, kind: ch.label === 'main' ? 'main' : 'secondary', label: ch.label === 'finnish' ? 'Finnish border (Continuation War from 25 June)' : null, q: 'a', coordinates: pts });
    }
  } else {
    const order = { a: 0, b: 1, c: 2 };
    for (const seg of fl.segments) {
      let run = null;
      for (let i = 0; i < seg.points.length - 1; i++) {
        const p = seg.points[i], q = seg.points[i + 1];
        const qual = order[p.q] >= order[q.q] ? p.q : q.q;
        if (!run || run.q !== qual) { run = { segment: seg.id, kind: seg.kind, label: seg.label || null, q: qual, coordinates: [p.at] }; entry.lines.push(run); }
        run.coordinates.push(q.at);
      }
    }
    const route = closingRoutes[fl.id] || {};
    const main = fl.segments.find((s) => s.kind === 'main') || (route.ring ? fl.segments[0] : undefined);
    if (main && home.length) {
      const pts = main.points.map((p) => p.at);
      const first = pts[0], last = pts[pts.length - 1];
      const tail = route.southTail || [[last[0], 30]];
      const head = route.northHead || [[first[0], 80]];
      const ring = route.ring ? [...pts, ...route.ring] : [...pts, ...tail, [-30, 30], [-30, 80], ...head];
      let held = robust('intersection', home, ringPoly(ring), fl.id + ' held');
      for (const x of fl.extraHeld || []) held = robust('union', held, robust('intersection', home, ringPoly(x.ring), x.id), fl.id + ' extra');
      for (const pk of fl.pockets || []) held = robust('difference', held, ringPoly(pk.ring), fl.id + ' pocket');
      entry.held = simplifyMulti(held, 0.008);
      entry.pockets = (fl.pockets || []).map((pk) => ({ id: pk.id, label: pk.label, side: pk.side, geometry: simplifyMulti(safe(() => pc.intersection(home, ringPoly(pk.ring)), pk.id), 0.005, 0.00001) }));
    }
  }
  fronts.push(entry);
  console.log('front', fl.id, entry.lines.length, 'lines', entry.held ? entry.held.length + ' held polys' : '');
}
const s = JSON.stringify({ fronts });
fs.writeFileSync(path.join(OUT, 'fronts.json'), s);
console.log('fronts.json', (s.length / 1024).toFixed(0) + ' KB');

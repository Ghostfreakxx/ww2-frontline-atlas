// Screen-space shape helpers: smooth curves, tapered campaign arrows, label boxes.

export type Pt = [number, number];

/** Catmull–Rom spline through points, sampled to roughly `step` px spacing. */
export function smoothPolyline(pts: Pt[], step = 6): Pt[] {
  if (pts.length < 2) return pts;
  if (pts.length === 2) {
    const [a, b] = pts;
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    return Array.from({ length: n + 1 }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n] as Pt);
  }
  const out: Pt[] = [];
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function polylineLength(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Cut a polyline to a fraction of its length. */
export function trimPolyline(pts: Pt[], frac: number): Pt[] {
  if (frac >= 1) return pts;
  const target = polylineLength(pts) * Math.max(0, frac);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + seg >= target) {
      const t = seg ? (target - acc) / seg : 0;
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
      return out;
    }
    acc += seg;
    out.push(pts[i]);
  }
  return out;
}

/**
 * Tapered arrow outline (atlas style): the body widens from `w0` to `w1`, then an arrowhead of
 * length `head` and half-width `headW`. Returns an SVG path string.
 */
export function arrowPath(center: Pt[], w0: number, w1: number, head: number, headW: number): string {
  if (center.length < 2) return '';
  const L = polylineLength(center);
  if (L < 2) return '';
  const bodyLen = Math.max(0, L - head);
  const body = trimPolyline(center, bodyLen / L);
  const left: Pt[] = [];
  const right: Pt[] = [];
  let acc = 0;
  for (let i = 0; i < body.length; i++) {
    const a = body[Math.max(0, i - 1)], b = body[Math.min(body.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    if (i > 0) acc += Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]);
    const w = (w0 + (w1 - w0) * (bodyLen ? acc / bodyLen : 1)) / 2;
    left.push([body[i][0] - dy * w, body[i][1] + dx * w]);
    right.push([body[i][0] + dy * w, body[i][1] - dx * w]);
  }
  const end = body[body.length - 1];
  const tip = center[center.length - 1];
  let hx = tip[0] - end[0], hy = tip[1] - end[1];
  const hl = Math.hypot(hx, hy) || 1;
  hx /= hl; hy /= hl;
  const hl1: Pt = [end[0] - hy * headW, end[1] + hx * headW];
  const hr1: Pt = [end[0] + hy * headW, end[1] - hx * headW];
  const f = (p: Pt) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  return `M${left.map(f).join('L')}L${f(hl1)}L${f(tip)}L${f(hr1)}L${right.reverse().map(f).join('L')}Z`;
}

/** Simple SVG polyline path. */
export const linePath = (pts: Pt[]) => (pts.length ? 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') : '');

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const overlaps = (a: Box, b: Box, pad = 2) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
/** Text width in px. Uses canvas measurement in the browser; a character-width estimate elsewhere. */
export function textWidth(text: string, size: number, font: string, weight = 400, letterSpacing = 0): number {
  const key = `${weight}|${font}|${text}`;
  let w1 = widthCache.get(key);
  if (w1 === undefined) {
    if (typeof document !== 'undefined') {
      measureCtx ??= document.createElement('canvas').getContext('2d');
      if (measureCtx) {
        measureCtx.font = `${weight} 100px ${font}`;
        w1 = measureCtx.measureText(text).width / 100;
      }
    }
    if (w1 === undefined) w1 = text.length * 0.52;
    widthCache.set(key, w1);
  }
  return w1 * size + letterSpacing * size * Math.max(0, text.length - 1);
}

/** Forget cached widths (call after web fonts load). */
export function clearTextCache() {
  widthCache.clear();
}

/** Greedy word wrap to a max width. */
export function wrapText(text: string, size: number, font: string, maxWidth: number, weight = 400): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (textWidth(candidate, size, font, weight) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

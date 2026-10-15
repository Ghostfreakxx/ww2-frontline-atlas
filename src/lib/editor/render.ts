import type { MediaItem, Project, TextItem, VideoClip } from './types.ts';
import { ASPECTS, TRANSITION_S } from './types.ts';
import { clipAt, clipLen } from './timeline.ts';

// Draws one frame of a project onto a 2D canvas. Shared by the live preview and the exporter so the
// exported video matches what was seen while editing.

/** A frame to draw: an image/video element, or a decoded frame that draws itself (handles rotation). */
export type Source = { el?: CanvasImageSource; w: number; h: number; draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void };

export interface FrameInput {
  project: Project;
  t: number;
  media: Map<string, MediaItem>;
  /** The frame source for a clip (a video element already seeked to the clip's source time, or an image). */
  source: (clip: VideoClip) => Source | null;
  /** Hide a text item (while it is being edited in place). */
  hideText?: string | null;
  /** Play text entrance/exit animations (off while paused, so text being edited is fully visible). */
  animate?: boolean;
}

const SANS = "'Atlas Sans', 'IBM Plex Sans Condensed', 'Arial Narrow', system-ui, sans-serif";
const SERIF = "'Atlas Serif', 'Source Serif 4', Georgia, serif";

const FILTERS = typeof document !== 'undefined' && 'filter' in (document.createElement('canvas').getContext('2d') ?? {});

export function frameSize(p: Project) {
  return ASPECTS[p.aspect];
}

export function drawClip(ctx: CanvasRenderingContext2D, W: number, H: number, clip: VideoClip, src: Source) {
  const base = clip.fit === 'fill' ? Math.max(W / src.w, H / src.h) : Math.min(W / src.w, H / src.h);
  const s = base * clip.zoom;
  const w = src.w * s;
  const h = src.h * s;
  const x = (W - w) / 2 + clip.x * W;
  const y = (H - h) / 2 + clip.y * H;
  if (src.draw) src.draw(ctx, x, y, w, h);
  else if (src.el) ctx.drawImage(src.el, x, y, w, h);
}

/** Opacity of the black/white transition overlay at time t, and its colour. */
export function transitionOverlay(p: Project, t: number): { color: string; alpha: number } | null {
  const hit = clipAt(p, t);
  if (!hit) return null;
  const T = TRANSITION_S;
  if (hit.clip.transition !== 'cut' && hit.index > 0 && hit.local < T) {
    return { color: hit.clip.transition === 'flash' ? '#ffffff' : '#000000', alpha: 1 - hit.local / T };
  }
  const next = p.clips[hit.index + 1];
  const remaining = clipLen(hit.clip) - hit.local;
  if (next && next.transition !== 'cut' && remaining < T) {
    return { color: next.transition === 'flash' ? '#ffffff' : '#000000', alpha: 1 - remaining / T };
  }
  return null;
}

export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, input: FrameInput) {
  const { project: p, t } = input;
  ctx.save();
  ctx.fillStyle = p.background;
  ctx.fillRect(0, 0, W, H);
  const hit = clipAt(p, t);
  if (hit) {
    const src = input.source(hit.clip);
    if (src && src.w > 0) {
      if (hit.clip.fit === 'fit') {
        // Blurred fill behind letterboxed footage, as in most Reels.
        ctx.save();
        // Canvas filters are missing in some Safari versions: then the bars are just darkened, not blurred.
        if (FILTERS) ctx.filter = `blur(${Math.round(W / 27)}px)`;
        drawClip(ctx, W, H, { ...hit.clip, fit: 'fill', zoom: 1.1, x: 0, y: 0 }, src);
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
      }
      drawClip(ctx, W, H, hit.clip, src);
    }
  }
  const ov = transitionOverlay(p, t);
  if (ov && ov.alpha > 0) {
    ctx.globalAlpha = Math.min(1, ov.alpha);
    ctx.fillStyle = ov.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  for (const item of p.texts) if (t >= item.start && t < item.end && item.id !== input.hideText) drawText(ctx, W, H, item, t, input.animate !== false);
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function fontFor(item: TextItem, px: number) {
  if (item.style === 'title') return `700 ${px}px ${SERIF}`;
  if (item.style === 'caption') return `700 ${px}px ${SANS}`;
  return `600 ${px}px ${SANS}`;
}

/** Layout of a text item (lines, box) — used for drawing and for hit-testing drags in the preview. */
export function textLayout(ctx: CanvasRenderingContext2D, W: number, H: number, item: TextItem) {
  const k = W / 1080;
  const px = item.size * k;
  ctx.font = fontFor(item, px);
  const text = item.style === 'label' ? item.text.toUpperCase() : item.text;
  const lines = wrap(ctx, text, W * 0.84);
  const lh = px * (item.style === 'title' ? 1.08 : 1.18);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const w = Math.max(0, ...widths);
  const h = lines.length * lh;
  const cx = item.x * W;
  const cy = item.y * H;
  return { k, px, lines, lh, widths, cx, cy, box: { x: cx - w / 2 - 24 * k, y: cy - h / 2 - 16 * k, w: w + 48 * k, h: h + 32 * k } };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawText(ctx: CanvasRenderingContext2D, W: number, H: number, item: TextItem, t: number, animate = true) {
  const L = textLayout(ctx, W, H, item);
  const { k, px, lines, lh, widths, cx, cy } = L;
  // Entrance/exit animation.
  const inP = Math.min(1, (t - item.start) / 0.28);
  const outP = Math.min(1, (item.end - t) / 0.18);
  let alpha = 1;
  let scale = 1;
  let dy = 0;
  if (!animate) {
    /* static frame */
  } else if (item.anim === 'pop') {
    const e = inP < 1 ? 1 - Math.pow(1 - inP, 3) : 1;
    scale = 0.6 + 0.4 * e + Math.sin(Math.min(1, inP) * Math.PI) * 0.08;
    alpha = Math.min(1, inP * 2);
  } else if (item.anim === 'fade') alpha = Math.min(inP, outP);
  else if (item.anim === 'rise') {
    alpha = Math.min(inP, outP);
    dy = (1 - (1 - Math.pow(1 - inP, 3))) * 50 * k;
  }
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy + dy);
  ctx.scale(scale, scale);
  ctx.font = fontFor(item, px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const top = -((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => {
    const y = top + i * lh;
    const w = widths[i];
    if (item.style === 'box') {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, -w / 2 - 22 * k, y - lh / 2, w + 44 * k, lh, 14 * k);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.fillText(line, 0, y + 2 * k);
    } else if (item.style === 'subtitle') {
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      roundRect(ctx, -w / 2 - 18 * k, y - lh / 2, w + 36 * k, lh, 10 * k);
      ctx.fill();
      ctx.fillStyle = item.color;
      ctx.fillText(line, 0, y + 2 * k);
    } else {
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 18 * k;
      ctx.shadowOffsetY = 4 * k;
      if (item.style === 'caption') {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, px * 0.16);
        ctx.strokeText(line, 0, y);
        ctx.shadowColor = 'transparent';
      }
      ctx.fillStyle = item.color;
      ctx.fillText(line, 0, y);
    }
  });
  ctx.restore();
}

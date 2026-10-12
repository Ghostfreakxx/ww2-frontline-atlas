'use client';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { MediaItem, Project } from '@/lib/editor/types';
import { clipAt } from '@/lib/editor/timeline';
import { frameSize, textLayout } from '@/lib/editor/render';
import { Player } from '@/lib/editor/player';
import type { Selection, Update } from './EditorApp';

interface Props {
  project: Project;
  media: Map<string, MediaItem>;
  urls: Map<string, string>;
  playerRef: MutableRefObject<Player | null>;
  onTime: (t: number, playing: boolean) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  update: Update;
}

/** Live preview canvas. Drag text to move it; drag the picture to reframe the clip; pinch or scroll to zoom it. */
export function PreviewPane({ project, media, urls, playerRef, onTime, selection, setSelection, update }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 270, h: 480 });
  const [safe, setSafe] = useState(false);
  const { w: W, h: H } = frameSize(project);
  const projectRef = useRef(project);
  projectRef.current = project;

  // Fit the frame into the available space.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const cw = e.contentRect.width;
      const ch = e.contentRect.height;
      const s = Math.min(cw / W, ch / H);
      setBox({ w: Math.max(60, Math.floor(W * s)), h: Math.max(60, Math.floor(H * s)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

  // Canvas resolution: display size × pixel ratio, capped at the export size.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.min(W, Math.round(box.w * dpr));
    c.height = Math.round((c.width * H) / W);
    playerRef.current?.draw();
  }, [box, W, H, playerRef]);

  // One player for the lifetime of the pane.
  useEffect(() => {
    if (!canvas.current) return;
    const p = new Player(projectRef.current, { canvas: canvas.current, urls, media, onTime });
    playerRef.current = p;
    p.seek(0);
    return () => {
      p.dispose();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ pointer interaction
  const drag = useRef<null | { kind: 'text'; id: string; dx: number; dy: number } | { kind: 'frame'; id: string; sx: number; sy: number; x0: number; y0: number }>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<null | { d0: number; z0: number; id: string }>(null);

  const toFrame = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
  };

  const onDown = (e: React.PointerEvent) => {
    const c = canvas.current!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
    const t = playerRef.current?.t ?? 0;
    const hit = clipAt(project, t);
    if (pointers.current.size === 2 && hit) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: hit.clip.zoom, id: hit.clip.id };
      drag.current = null;
      return;
    }
    const { fx, fy } = toFrame(e);
    const ctx = c.getContext('2d')!;
    // Topmost visible text under the pointer.
    const texts = project.texts.filter((x) => t >= x.start && t < x.end).reverse();
    for (const x of texts) {
      const L = textLayout(ctx, c.width, c.height, x);
      const px = fx * c.width;
      const py = fy * c.height;
      if (px >= L.box.x && px <= L.box.x + L.box.w && py >= L.box.y && py <= L.box.y + L.box.h) {
        drag.current = { kind: 'text', id: x.id, dx: fx - x.x, dy: fy - x.y };
        setSelection({ kind: 'text', id: x.id });
        return;
      }
    }
    if (hit) {
      drag.current = { kind: 'frame', id: hit.clip.id, sx: fx, sy: fy, x0: hit.clip.x, y0: hit.clip.y };
      setSelection({ kind: 'clip', id: hit.clip.id });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const z = Math.max(0.3, Math.min(5, (pinch.current.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d0));
      const id = pinch.current.id;
      update((p) => ({ ...p, clips: p.clips.map((c) => (c.id === id ? { ...c, zoom: +z.toFixed(3) } : c)) }), { transient: true });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const { fx, fy } = toFrame(e);
    if (d.kind === 'text') {
      const snap = (v: number) => (Math.abs(v - 0.5) < 0.015 ? 0.5 : v);
      update((p) => ({ ...p, texts: p.texts.map((x) => (x.id === d.id ? { ...x, x: snap(Math.max(0.02, Math.min(0.98, fx - d.dx))), y: Math.max(0.02, Math.min(0.98, fy - d.dy)) } : x)) }), { transient: true });
    } else {
      const nx = d.x0 + (fx - d.sx);
      const ny = d.y0 + (fy - d.sy);
      update((p) => ({ ...p, clips: p.clips.map((c) => (c.id === d.id ? { ...c, x: +Math.max(-1, Math.min(1, nx)).toFixed(4), y: +Math.max(-1, Math.min(1, ny)).toFixed(4) } : c)) }), { transient: true });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (drag.current || pinch.current) update((p) => p); // commit one history entry for the drag
    drag.current = null;
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const hit = clipAt(project, playerRef.current?.t ?? 0);
    if (!hit || !(e.ctrlKey || e.altKey)) return;
    const z = Math.max(0.3, Math.min(5, hit.clip.zoom * Math.exp(-e.deltaY * 0.002)));
    update((p) => ({ ...p, clips: p.clips.map((c) => (c.id === hit.clip.id ? { ...c, zoom: +z.toFixed(3) } : c)) }));
  };

  const selText = selection?.kind === 'text' ? project.texts.find((x) => x.id === selection.id) : null;

  return (
    <div className="pv" ref={wrap}>
      <div className="pv-frame" style={{ width: box.w, height: box.h }}>
        <canvas ref={canvas} className="pv-canvas" style={{ width: box.w, height: box.h }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} aria-label="Preview. Drag text to move it, drag the picture to reframe, pinch to zoom." />
        {selText && (
          <div className="pv-sel" style={{ left: `${selText.x * 100}%`, top: `${selText.y * 100}%` }} aria-hidden />
        )}
        {safe && project.aspect === '9:16' && (
          <div className="pv-safe" aria-hidden>
            <div style={{ top: 0, left: 0, right: 0, height: '12%' }} />
            <div style={{ bottom: 0, left: 0, right: 0, height: '22%' }} />
            <div style={{ top: '12%', right: 0, width: '14%', bottom: '22%' }} />
            <span>App buttons and captions cover the shaded areas</span>
          </div>
        )}
        {project.clips.length === 0 && project.texts.length === 0 && (
          <div className="pv-empty">Import videos or photos to start</div>
        )}
      </div>
      {project.aspect === '9:16' && (
        <button className={`btn tiny pv-safe-btn ${safe ? 'on' : ''}`} onClick={() => setSafe((v) => !v)} aria-pressed={safe} title="Show where Instagram/TikTok buttons cover the video">Safe zones</button>
      )}
    </div>
  );
}

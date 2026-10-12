'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Camera, ISODate, LonLat } from '@/lib/history/types';
import { idx } from '@/lib/conflict';
import type { GeoData } from '@/lib/map/geodata';
import { AtlasMap } from '@/components/map/AtlasMap';
import { frameRect, panCamera, transformFor, toWorld, zoomCameraAt, type View } from '@/lib/map/camera';
import { project, unproject } from '@/lib/map/projection';
import { useAnimatedCamera } from '@/lib/map/useStage';
import { LAYOUTS, type Annotation, type AnnotationKind, type PresentationState } from '@/lib/sync/state';

export type Tool = 'pan' | AnnotationKind;

interface Props {
  geo: GeoData;
  state: PresentationState;
  date: ISODate;
  now: number;
  arrowBorn: Map<string, number>;
  tool: Tool;
  color: string;
  strokeWidth: number;
  locked: boolean;
  onCamera: (c: Camera, final: boolean) => void;
  onDraft: (a: Annotation | null) => void;
  onAnnotation: (a: Annotation) => void;
  onTapFeature: (hit: { kind: 'formation' | 'battle'; id: string } | null) => void;
}

const pip = (pt: LonLat, ring: LonLat[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function MapStageInteractive(props: Props) {
  const { geo, state, date, now, arrowBorn, tool, color, strokeWidth, locked, onCamera, onDraft, onAnnotation, onTapFeature } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [gesturing, setGesturing] = useState(false);
  const camera = useAnimatedCamera(state.camera, { immediate: gesturing });
  const camRef = useRef(camera);
  camRef.current = camera;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = LAYOUTS[state.layout].map;
  const aspect = L.w / L.h;
  const frame = frameRect(size.w, size.h, aspect, 14);
  const view: View = { w: size.w, h: size.h, frameH: frame.h };

  // ---- gestures ----
  const pointers = useRef(new Map<number, { x: number; y: number; type: string }>());
  const gesture = useRef<{ mode: 'none' | 'pan' | 'pinch' | 'draw'; cam: Camera; lastDist?: number; lastMid?: [number, number]; start?: { x: number; y: number; t: number }; moved?: boolean; draft?: Annotation; lastSent?: number } | null>(null);
  const liveCam = useRef<Camera>(camera);
  const lastCamSend = useRef(0);

  const toLonLat = useCallback(
    (x: number, y: number): LonLat => {
      const t = transformFor(camRef.current, view);
      return unproject(toWorld(t, [x, y]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size.w, size.h, frame.h],
  );

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const sendCam = (c: Camera, final: boolean) => {
    liveCam.current = c;
    const t = performance.now();
    if (final || t - lastCamSend.current > 33) {
      lastCamSend.current = t;
      onCamera(c, final);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: e.pointerType });
    const drawTool: Tool = e.pointerType === 'pen' && tool === 'pan' ? 'freehand' : tool;
    if (pointers.current.size === 2) {
      // Second finger: switch to pinch (cancel any drawing).
      if (gesture.current?.mode === 'draw') onDraft(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: 'pinch', cam: camRef.current, lastDist: Math.hypot(a.x - b.x, a.y - b.y), lastMid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
      liveCam.current = camRef.current;
      setGesturing(true);
      return;
    }
    if (pointers.current.size > 2) return;
    if (drawTool !== 'pan' && (e.pointerType === 'pen' || e.pointerType === 'mouse' || e.pointerType === 'touch')) {
      const ll = toLonLat(p.x, p.y);
      const draft: Annotation = { id: uid(), kind: drawTool, points: [ll], color, width: drawTool === 'text' ? strokeWidth : strokeWidth };
      gesture.current = { mode: 'draw', cam: camRef.current, draft, start: { ...p, t: performance.now() }, lastSent: 0 };
      if (drawTool !== 'text') onDraft(draft);
      return;
    }
    gesture.current = { mode: 'pan', cam: camRef.current, start: { ...p, t: performance.now() }, moved: false };
    liveCam.current = camRef.current;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || locked) return;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, { ...p, type: prev.type });
    if (g.mode === 'pan') {
      if (!g.moved && g.start && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 6) return;
      if (!g.moved) setGesturing(true);
      g.moved = true;
      const c = panCamera(liveCam.current, view, p.x - prev.x, p.y - prev.y);
      sendCam(c, false);
    } else if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      let c = zoomCameraAt(liveCam.current, view, dist / (g.lastDist || dist), mid[0], mid[1]);
      c = panCamera(c, view, mid[0] - g.lastMid![0], mid[1] - g.lastMid![1]);
      g.lastDist = dist;
      g.lastMid = mid;
      sendCam(c, false);
    } else if (g.mode === 'draw' && g.draft) {
      const ll = toLonLat(p.x, p.y);
      const d = g.draft;
      if (d.kind === 'circle' || d.kind === 'text') d.points = [d.points[0], ll];
      else {
        const last = project(d.points[d.points.length - 1]);
        const t = transformFor(camRef.current, view);
        const lp = [last[0] * t.k + t.tx, last[1] * t.k + t.ty];
        if (Math.hypot(lp[0] - p.x, lp[1] - p.y) < 3) return;
        d.points = [...d.points, ll];
      }
      const tnow = performance.now();
      if (tnow - (g.lastSent ?? 0) > 50) {
        g.lastSent = tnow;
        if (d.kind !== 'text') onDraft({ ...d });
      }
    }
  };

  const finish = (e: React.PointerEvent) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) {
        sendCam(liveCam.current, true);
        gesture.current = pointers.current.size === 1 ? { mode: 'pan', cam: liveCam.current, moved: true } : null;
        if (!gesture.current) setTimeout(() => setGesturing(false), 0);
      }
      return;
    }
    if (pointers.current.size > 0) return;
    if (g.mode === 'pan') {
      if (g.moved) {
        sendCam(liveCam.current, true);
        setTimeout(() => setGesturing(false), 0);
      } else if (g.start && performance.now() - g.start.t < 400) {
        handleTap(g.start.x, g.start.y);
      }
    } else if (g.mode === 'draw' && g.draft) {
      const d = g.draft;
      if (d.kind === 'text') {
        const text = window.prompt('Label text');
        if (text && text.trim()) onAnnotation({ ...d, points: [d.points[0]], text: text.trim().slice(0, 80) });
      } else if (d.kind === 'freehand' && d.points.length > 1) onAnnotation(simplifyAnnotation(d));
      else if (d.kind === 'arrow' && d.points.length > 1) onAnnotation(simplifyAnnotation(d, 10));
      else if (d.kind === 'circle' && d.points.length === 2) onAnnotation(d);
      onDraft(null);
    }
    gesture.current = null;
  };

  const handleTap = (x: number, y: number) => {
    const t = transformFor(camRef.current, view);
    for (const { battle } of idx.battlesAt(date)) {
      const s = project(battle.at);
      if (Math.hypot(s[0] * t.k + t.tx - x, s[1] * t.k + t.ty - y) < 26) return onTapFeature({ kind: 'battle', id: battle.id });
    }
    if (state.layers.sectors) {
      const ll = toLonLat(x, y);
      const groups = idx.armyGroupsAt(date).filter((f) => f.side === 'axis' || state.layers.opposing).sort((a) => (a.side === 'axis' ? -1 : 1));
      for (const f of groups) {
        const s = idx.sectorAt(f, date);
        if (s && pip(ll, s.ring)) return onTapFeature({ kind: 'formation', id: f.id });
      }
    }
    onTapFeature(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (locked) return;
    const p = local(e);
    const c = zoomCameraAt(camRef.current, view, Math.exp(-e.deltaY * 0.0016), p.x, p.y);
    onCamera(c, true);
  };

  const maskPath = `M0,0H${size.w}V${size.h}H0Z M${frame.x},${frame.y}v${frame.h}h${frame.w}v${-frame.h}Z`;

  return (
    <div ref={wrapRef} className="pres-map" data-tool={tool} data-locked={locked || undefined}>
      <AtlasMap idx={idx} geo={geo} state={state} date={date} camera={camera} width={size.w} height={size.h} frameH={frame.h} idPrefix="pres" now={now} arrowBorn={arrowBorn}>
        <path d={maskPath} fillRule="evenodd" fill="#101112" fillOpacity={0.42} pointerEvents="none" />
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="none" stroke="#d8a64a" strokeWidth={1.5} strokeOpacity={0.9} pointerEvents="none" />
        <text x={frame.x + 8} y={frame.y - 4} fill="#d8a64a" fontSize={12} fontFamily="var(--sans)" pointerEvents="none">
          AUDIENCE VIEW · {LAYOUTS[state.layout].label}
        </text>
        {LAYOUTS[state.layout].bubble && (() => {
          // Where the camera bubble covers the map on the audience display.
          const b = LAYOUTS[state.layout].bubble!;
          const k = frame.w / L.w;
          return <circle cx={frame.x + b.cx * k} cy={frame.y + b.cy * k} r={b.r * k} fill="#101112" fillOpacity={0.35} stroke="#d8a64a" strokeWidth={1.5} strokeDasharray="6 5" pointerEvents="none" />;
        })()}
      </AtlasMap>
      <div
        className="pres-map-input"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onWheel={onWheel}
        role="application"
        aria-label="Map. Drag to pan, pinch to zoom, draw with the Pencil."
      />
    </div>
  );
}

/** Reduce stroke points (radial distance in degrees) to keep sync payloads small. */
function simplifyAnnotation(a: Annotation, maxPoints = 160): Annotation {
  const pts = a.points;
  if (pts.length <= 3) return a;
  const out: LonLat[] = [pts[0]];
  const tol = 0.004;
  for (const p of pts.slice(1, -1)) {
    const l = out[out.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) > tol) out.push([Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]);
  }
  out.push(pts[pts.length - 1]);
  if (out.length > maxPoints) {
    const step = out.length / maxPoints;
    return { ...a, points: Array.from({ length: maxPoints }, (_, i) => out[Math.min(out.length - 1, Math.round(i * step))]).concat([out[out.length - 1]]) };
  }
  return { ...a, points: out };
}

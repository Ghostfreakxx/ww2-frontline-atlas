'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LAYOUTS, STAGE, type Layout } from '@/lib/sync/state';

// Extras that live only on the audience display computer (never synced to the iPad):
// - the presenter's own webcam, drawn into the layout's camera area or round camera bubble;
// - a screen pen (mouse, pen tablet or touch screen) for quick highlights straight on the output.

// ------------------------------------------------------------------------------------------ webcam

export interface WebcamPrefs {
  on: boolean;
  deviceId: string | null;
  mirror: boolean;
}
const PREFS_KEY = 'atlas.display.webcam';

export function loadWebcamPrefs(force: boolean): WebcamPrefs {
  let p: WebcamPrefs = { on: false, deviceId: null, mirror: true };
  try {
    p = { ...p, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    /* storage blocked */
  }
  return force ? { ...p, on: true } : p;
}
export function saveWebcamPrefs(p: WebcamPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}

export function useWebcam(prefs: WebcamPrefs) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    if (!prefs.on) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera needs HTTPS or localhost');
      return;
    }
    let alive = true;
    let s: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: prefs.deviceId ? { deviceId: { exact: prefs.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(async (ms) => {
        if (!alive) return ms.getTracks().forEach((t) => t.stop());
        s = ms;
        setStream(ms);
        setError(null);
        setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'));
      })
      .catch((e: Error) => alive && setError(e.name === 'NotAllowedError' ? 'Camera permission was denied' : `Camera unavailable (${e.name || e.message})`));
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [prefs.on, prefs.deviceId]);
  return { stream: prefs.on ? stream : null, error: prefs.on ? error : null, devices };
}

/** Where the camera goes for a layout, in stage coordinates (null = this layout has no camera). */
export function cameraSlot(layout: Layout): { x: number; y: number; w: number; h: number; round: boolean } | null {
  const L = LAYOUTS[layout];
  if (L.bubble) return { x: L.bubble.cx - L.bubble.r, y: L.bubble.cy - L.bubble.r, w: L.bubble.r * 2, h: L.bubble.r * 2, round: true };
  if (L.camera) return { ...L.camera, round: false };
  return null;
}

export const CameraFeed = forwardRef<HTMLVideoElement, { stream: MediaStream; layout: Layout; scale: number; mirror: boolean }>(function CameraFeed({ stream, layout, scale, mirror }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => video.current!, []);
  useEffect(() => {
    if (video.current && video.current.srcObject !== stream) video.current.srcObject = stream;
  }, [stream]);
  const slot = cameraSlot(layout);
  return (
    <video
      ref={video}
      className={`display-camera ${slot?.round ? 'round' : ''}`}
      autoPlay
      muted
      playsInline
      aria-hidden
      style={{
        display: slot ? 'block' : 'none',
        left: (slot?.x ?? 0) * scale,
        top: (slot?.y ?? 0) * scale,
        width: (slot?.w ?? 0) * scale,
        height: (slot?.h ?? 0) * scale,
        borderWidth: slot?.round ? Math.max(2, 6 * scale) : 0,
        transform: mirror ? 'scaleX(-1)' : undefined,
      }}
    />
  );
});

// --------------------------------------------------------------------------------------------- pen

export const PEN_COLORS = [
  { color: '#e6f53a', name: 'Highlighter yellow' },
  { color: '#ff3b30', name: 'Red' },
  { color: '#ffffff', name: 'White' },
  { color: '#3fd0ff', name: 'Cyan' },
];
type Stroke = { color: string; width: number; points: [number, number][] };

export interface InkHandle {
  clear: () => void;
  undo: () => void;
  hasInk: () => boolean;
  /** Draw the ink onto a 1920×1080 canvas context (for screenshots). */
  paint: (ctx: CanvasRenderingContext2D) => void;
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], k: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!s.points.length) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * k;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 3 * k;
    ctx.beginPath();
    const [x0, y0] = s.points[0];
    ctx.moveTo(x0 * k, y0 * k);
    if (s.points.length === 1) ctx.lineTo(x0 * k + 0.01, y0 * k);
    // Smooth through midpoints so fast mouse strokes do not look jagged.
    for (let i = 1; i < s.points.length - 1; i++) {
      const [x, y] = s.points[i];
      const [nx, ny] = s.points[i + 1];
      ctx.quadraticCurveTo(x * k, y * k, ((x + nx) / 2) * k, ((y + ny) / 2) * k);
    }
    if (s.points.length > 1) {
      const [lx, ly] = s.points[s.points.length - 1];
      ctx.lineTo(lx * k, ly * k);
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/**
 * Screen pen over the audience output. Strokes are kept in stage coordinates (1920×1080) so they survive
 * window resizes; they are cleared when `resetKey` changes (new scene/step or "Start over").
 */
export const InkLayer = forwardRef<InkHandle, { active: boolean; color: string; scale: number; resetKey: string }>(function InkLayer({ active, color, scale, resetKey }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(STAGE.w * scale * dpr);
    const h = Math.round(STAGE.h * scale * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    drawStrokes(ctx, current.current ? [...strokes.current, current.current] : strokes.current, scale * dpr);
  }, [scale]);

  useEffect(() => {
    strokes.current = [];
    current.current = null;
    redraw();
    bump();
  }, [resetKey, redraw]);
  useEffect(redraw, [redraw]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        strokes.current = [];
        redraw();
        bump();
      },
      undo: () => {
        strokes.current = strokes.current.slice(0, -1);
        redraw();
        bump();
      },
      hasInk: () => strokes.current.length > 0,
      paint: (ctx) => drawStrokes(ctx, strokes.current, 1),
    }),
    [redraw],
  );

  const toStage = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * STAGE.w, ((e.clientY - r.top) / r.height) * STAGE.h];
  };
  const onDown = (e: React.PointerEvent) => {
    if (!active || e.button > 0) return;
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
    current.current = { color, width: e.pointerType === 'pen' ? 5 + 4 * (e.pressure || 0.5) : 7, points: [toStage(e)] };
    redraw();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!current.current) return;
    const events = 'getCoalescedEvents' in e.nativeEvent ? (e.nativeEvent as PointerEvent).getCoalescedEvents() : [];
    const r = canvas.current!.getBoundingClientRect();
    for (const ev of events.length ? events : [e.nativeEvent]) current.current.points.push([((ev.clientX - r.left) / r.width) * STAGE.w, ((ev.clientY - r.top) / r.height) * STAGE.h]);
    redraw();
  };
  const onUp = () => {
    if (!current.current) return;
    strokes.current = [...strokes.current, current.current];
    current.current = null;
    redraw();
    bump();
  };

  return (
    <canvas
      ref={canvas}
      className={`display-ink ${active ? 'active' : ''}`}
      style={{ width: STAGE.w * scale, height: STAGE.h * scale }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden
    />
  );
});

'use client';
import { useEffect, useRef, useState } from 'react';
import type { Camera } from '../history/types.ts';
import { cameraInterpolator, easeInOutCubic, easeOutCubic } from './camera.ts';
import { clearTextCache } from './shapes.ts';

/**
 * Animates toward a target camera. `ms > 0` flies there with a zoom-and-pan curve; `ms = 0` (live
 * panning from the iPad) eases over a short interval to hide network jitter.
 */
export function useAnimatedCamera(target: Camera & { ms: number; seq: number }, opts: { immediate?: boolean } = {}) {
  const [cam, setCam] = useState<Camera>({ lon: target.lon, lat: target.lat, zoom: target.zoom });
  const camRef = useRef(cam);
  camRef.current = cam;
  const raf = useRef<number | null>(null);
  const key = `${target.seq}|${target.lon}|${target.lat}|${target.zoom}`;

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const from = camRef.current;
    const to = { lon: target.lon, lat: target.lat, zoom: target.zoom };
    if (opts.immediate) {
      setCam(to);
      return;
    }
    const same = Math.abs(from.lon - to.lon) < 1e-6 && Math.abs(from.lat - to.lat) < 1e-6 && Math.abs(from.zoom - to.zoom) < 1e-6;
    if (same) return;
    const flying = target.ms > 0;
    const interp = cameraInterpolator(from, to);
    const duration = flying ? Math.max(500, target.ms) : 160;
    const ease = flying ? easeInOutCubic : easeOutCubic;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setCam(t >= 1 ? to : interp(ease(t)));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else raf.current = null;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.immediate]);
  return cam;
}

/** A frame clock: re-renders on every animation frame while `active`, capped to `fps`. */
export function useFrameClock(active: boolean, fps = 60) {
  const [now, setNow] = useState(() => (typeof performance !== 'undefined' ? performance.now() : 0));
  useEffect(() => {
    if (!active) return;
    let id = 0;
    let last = 0;
    const minDt = 1000 / fps - 1;
    const loop = (t: number) => {
      if (t - last >= minDt) {
        last = t;
        setNow(t);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active, fps]);
  return now;
}

/** Tracks when ids first became visible so new arrows can be drawn in; ids present at mount do not animate. */
export function useBirthTimes(ids: string[], now: number) {
  const ref = useRef<Map<string, number> | null>(null);
  if (!ref.current) {
    ref.current = new Map(ids.map((id) => [id, -1e9]));
  }
  const map = ref.current;
  const set = new Set(ids);
  for (const id of ids) if (!map.has(id)) map.set(id, now);
  for (const id of [...map.keys()]) if (!set.has(id)) map.delete(id);
  return map;
}

/** Re-render once web fonts are ready so text measurement uses the real metrics. */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      setReady(true);
      return;
    }
    document.fonts.ready.then(() => {
      clearTextCache();
      setReady(true);
    });
  }, []);
  return ready;
}

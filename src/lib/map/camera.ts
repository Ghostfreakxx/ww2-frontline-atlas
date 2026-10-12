import { interpolateZoom } from 'd3-interpolate';
import type { Camera } from '../history/types.ts';
import { project, unproject, WORLD } from './projection.ts';

export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 40;

export interface View {
  /** Viewport size in CSS/SVG pixels. */
  w: number;
  h: number;
  /** Height of the audience frame inside this viewport; sets the scale so every screen shows the same span. */
  frameH: number;
}

export interface Transform {
  k: number;
  tx: number;
  ty: number;
}

export function transformFor(cam: Camera, v: View): Transform {
  const k = (cam.zoom * v.frameH) / WORLD.h;
  const [cx, cy] = project([cam.lon, cam.lat]);
  return { k, tx: v.w / 2 - cx * k, ty: v.h / 2 - cy * k };
}

export const toScreen = (t: Transform, p: [number, number]): [number, number] => [p[0] * t.k + t.tx, p[1] * t.k + t.ty];
export const toWorld = (t: Transform, p: [number, number]): [number, number] => [(p[0] - t.tx) / t.k, (p[1] - t.ty) / t.k];

/** The audience frame (aspect = audience map aspect) centred in a viewport. */
export function frameRect(w: number, h: number, aspect: number, margin = 0) {
  const fw = Math.min(w - margin * 2, (h - margin * 2) * aspect);
  const fh = fw / aspect;
  return { x: (w - fw) / 2, y: (h - fh) / 2, w: fw, h: fh };
}

export function clampCamera(c: Camera): Camera {
  return {
    lon: Math.max(-20, Math.min(70, c.lon)),
    lat: Math.max(30, Math.min(72, c.lat)),
    zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, c.zoom)),
  };
}

/** Pan by a screen delta. */
export function panCamera(c: Camera, v: View, dx: number, dy: number): Camera {
  const t = transformFor(c, v);
  const [cx, cy] = project([c.lon, c.lat]);
  const ll = unproject([cx - dx / t.k, cy - dy / t.k]);
  return clampCamera({ ...c, lon: ll[0], lat: ll[1] });
}

/** Zoom by a factor keeping the screen point (px,py) fixed. */
export function zoomCameraAt(c: Camera, v: View, factor: number, px: number, py: number): Camera {
  const t = transformFor(c, v);
  const anchor = toWorld(t, [px, py]);
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, c.zoom * factor));
  const k2 = (zoom * v.frameH) / WORLD.h;
  const cx = anchor[0] - (px - v.w / 2) / k2;
  const cy = anchor[1] - (py - v.h / 2) / k2;
  const ll = unproject([cx, cy]);
  return clampCamera({ lon: ll[0], lat: ll[1], zoom });
}

/** Smooth zoom-and-pan interpolator (van Wijk & Nuij) between two cameras. */
export function cameraInterpolator(a: Camera, b: Camera) {
  const pa = project([a.lon, a.lat]);
  const pb = project([b.lon, b.lat]);
  const interp = interpolateZoom([pa[0], pa[1], WORLD.h / a.zoom], [pb[0], pb[1], WORLD.h / b.zoom]);
  const f = (t: number): Camera => {
    const [x, y, size] = interp(t);
    const ll = unproject([x, y]);
    return { lon: ll[0], lat: ll[1], zoom: WORLD.h / size };
  };
  return Object.assign(f, { duration: interp.duration });
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

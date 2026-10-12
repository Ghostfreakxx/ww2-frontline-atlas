import cfg from '../../data/geo/projection.json';
import { makeProjection } from './makeProjection.mjs';
import type { LonLat } from '../history/types.ts';

export const projection = makeProjection(cfg);
export const WORLD = { w: cfg.worldWidth, h: cfg.worldHeight };

export const project = (ll: LonLat): [number, number] => projection(ll) as [number, number];
export const unproject = (xy: [number, number]): LonLat => projection.invert!(xy) as LonLat;

/** World units per kilometre near a point (used to draw uncertainty bands at true scale). */
export function unitsPerKm(at: LonLat): number {
  const a = project(at);
  const b = project([at[0], at[1] + 1]);
  return Math.hypot(b[0] - a[0], b[1] - a[1]) / 111.2;
}

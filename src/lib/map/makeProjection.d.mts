import type { GeoConicProjection } from 'd3-geo';
export function makeProjection(cfg: {
  parallels: number[];
  rotate: number[];
  fitExtent: { west: number; east: number; south: number; north: number };
  worldWidth: number;
  worldHeight: number;
}): GeoConicProjection;

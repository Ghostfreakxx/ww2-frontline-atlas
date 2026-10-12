'use client';
import { useEffect, useState } from 'react';
import { geoPath } from 'd3-geo';
import { projection } from './projection.ts';
import type { LonLat } from '../history/types.ts';

// Loads the generated geography (public/geo) once per page and pre-computes world-space SVG paths.

type Geometry = { type: string; coordinates: unknown };
type Feature<P = Record<string, unknown>> = { type: 'Feature'; properties: P; geometry: Geometry };
type FC<P = Record<string, unknown>> = { type: 'FeatureCollection'; features: Feature<P>[] };

export interface TerritoryUnitShape {
  id: string;
  name: string;
  status: string;
  note: string | null;
  confidence: string;
  labelAt: LonLat | null;
  d: string;
  /** Projected bounds area (world units²) to decide label visibility. */
  area: number;
  centroid: [number, number];
}

export interface FrontShape {
  id: string;
  theatre: string;
  date: string;
  lines: { segment: string; kind: string; label: string | null; q: 'a' | 'b' | 'c'; d: string; coordinates: LonLat[] }[];
  heldD: string | null;
  pockets: { id: string; label: string; side: string; d: string; centroid: [number, number] | null }[];
}

export interface GeoData {
  landD: string;
  lakesD: string;
  rivers: { d: string; rank: number; name: string | null }[];
  relief: { x: number; y: number; width: number; height: number };
  territories: Map<string, TerritoryUnitShape[]>;
  fronts: Map<string, FrontShape>;
}

const path = geoPath(projection);
let cache: Promise<GeoData> | null = null;

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function loadGeo(territoryFiles: { id: string; file: string }[]): Promise<GeoData> {
  if (cache) return cache;
  cache = (async () => {
    const [land, lakes, rivers, relief, fronts, ...territories] = await Promise.all([
      getJSON<FC>('/geo/land.json'),
      getJSON<FC>('/geo/lakes.json'),
      getJSON<FC<{ name: string | null; rank: number }>>('/geo/rivers.json'),
      getJSON<{ x: number; y: number; width: number; height: number }>('/geo/relief.json'),
      getJSON<{ fronts: { id: string; theatre: string; date: string; lines: { segment: string; kind: string; label: string | null; q: 'a' | 'b' | 'c'; coordinates: LonLat[] }[]; held: unknown; pockets: { id: string; label: string; side: string; geometry: unknown }[] }[] }>('/geo/fronts.json'),
      ...territoryFiles.map((t) => getJSON<FC<{ id: string; name: string; status: string; note: string | null; confidence: string; labelAt: LonLat | null }>>(t.file)),
    ]);
    const join = (fc: FC) => fc.features.map((f) => path(f as never) ?? '').join('');
    const terrMap = new Map<string, TerritoryUnitShape[]>();
    territoryFiles.forEach((t, i) => {
      terrMap.set(
        t.id,
        territories[i].features.map((f) => {
          const b = path.bounds(f as never);
          return {
            ...f.properties,
            d: path(f as never) ?? '',
            area: (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]),
            centroid: path.centroid(f as never) as [number, number],
          };
        }),
      );
    });
    const frontMap = new Map<string, FrontShape>();
    for (const f of fronts.fronts) {
      frontMap.set(f.id, {
        id: f.id,
        theatre: f.theatre,
        date: f.date,
        lines: f.lines.map((l) => ({ ...l, d: path({ type: 'LineString', coordinates: l.coordinates } as never) ?? '' })),
        heldD: f.held ? path({ type: 'MultiPolygon', coordinates: f.held } as never) : null,
        pockets: f.pockets.map((p) => {
          const g = { type: 'MultiPolygon', coordinates: p.geometry } as never;
          const d = path(g) ?? '';
          return { id: p.id, label: p.label, side: p.side, d, centroid: d ? (path.centroid(g) as [number, number]) : null };
        }),
      });
    }
    return {
      landD: join(land),
      lakesD: join(lakes),
      rivers: rivers.features.map((f) => ({ d: path(f as never) ?? '', rank: f.properties.rank, name: f.properties.name })),
      relief,
      territories: terrMap,
      fronts: frontMap,
    };
  })();
  cache.catch(() => {
    cache = null;
  });
  return cache;
}

export function useGeo(territoryFiles: { id: string; file: string }[]) {
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadGeo(territoryFiles).then(
      (g) => alive && setGeo(g),
      (e) => alive && setError(String(e)),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { geo, error };
}

export { path as worldPath };

import type { Camera, ISODate, LonLat } from '../history/types.ts';

// The synchronised presentation state. The presenter (iPad) owns it; the server relays it to every
// display. Everything that changes what the audience sees lives here; presenter-only state (notes,
// lock, open tabs, undo stacks) stays on the iPad.

export type Layout = 'split-right' | 'split-left' | 'full' | 'map-safe' | 'bubble';

type Rect = { x: number; y: number; w: number; h: number };
export const LAYOUTS: Record<Layout, { label: string; description: string; map: Rect; camera?: Rect; /** Round camera inset over a full-frame map. */ bubble?: { cx: number; cy: number; r: number } }> = {
  'split-right': { label: 'Split · map right', description: 'Camera 40% left, map 60% right', map: { x: 768, y: 0, w: 1152, h: 1080 }, camera: { x: 0, y: 0, w: 768, h: 1080 } },
  'split-left': { label: 'Split · map left', description: 'Map 60% left, camera 40% right', map: { x: 0, y: 0, w: 1152, h: 1080 }, camera: { x: 1152, y: 0, w: 768, h: 1080 } },
  full: { label: 'Full-width map', description: 'Map fills the 16:9 frame', map: { x: 0, y: 0, w: 1920, h: 1080 } },
  'map-safe': { label: 'Map, title-safe', description: 'Full map with panels kept inside 90% title-safe area', map: { x: 0, y: 0, w: 1920, h: 1080 } },
  bubble: { label: 'Map + camera bubble', description: 'Full map with a round camera in the bottom-right corner', map: { x: 0, y: 0, w: 1920, h: 1080 }, bubble: { cx: 1920 - 48 - 170, cy: 1080 - 48 - 170, r: 170 } },
};
export const STAGE = { w: 1920, h: 1080 };

export type AnnotationKind = 'freehand' | 'arrow' | 'circle' | 'text';
export interface Annotation {
  id: string;
  kind: AnnotationKind;
  /** Geographic points so annotations stay attached to the map on every screen. */
  points: LonLat[];
  color: string;
  width: number;
  text?: string;
}

export interface Layers {
  relief: boolean;
  territory: boolean;
  borders: boolean;
  rivers: boolean;
  cities: boolean;
  physical: boolean;
  front: boolean;
  prevFront: boolean;
  uncertainty: boolean;
  held: boolean;
  arrows: boolean;
  battles: boolean;
  objectives: boolean;
  sectors: boolean;
  opposing: boolean;
}

export interface Panels {
  title: boolean;
  date: boolean;
  event: boolean;
  commander: boolean;
  portrait: boolean;
  hierarchy: boolean;
  compare: boolean;
  legend: boolean;
  sources: boolean;
}

export interface Focus {
  /** Highlighted formation ids (0–2; two enables comparison). */
  formations: string[];
  dimOthers: boolean;
  battleId: string | null;
  operationId: string | null;
  cities: string[];
  /** Restrict arrows to these ids; null = automatic by date/operation. */
  arrowIds: string[] | null;
}

export interface Playback {
  playing: boolean;
  /** Days per second. */
  speed: number;
  anchorDate: ISODate;
  /** Server time (ms) at which anchorDate applied. */
  anchorAt: number;
  /** Stop automatically at this date. */
  endDate: ISODate | null;
}

export interface PresentationState {
  rev: number;
  origin: string;
  conflictId: string;
  episodeId: string | null;
  sceneId: string | null;
  sceneIndex: number;
  stepIndex: number;
  date: ISODate;
  playback: Playback;
  camera: Camera & { ms: number; seq: number };
  layout: Layout;
  focus: Focus;
  layers: Layers;
  panels: Panels;
  hierarchy: { rootId: string | null; expanded: string[] };
  caption: { title: string; subtitle: string } | null;
  annotations: Annotation[];
  draft: Annotation | null;
  hideUi: boolean;
  /** Fade the map to the background colour (between scenes). */
  curtain: boolean;
  transition: { seq: number; kind: 'fade' | 'cut' };
}

export const DEFAULT_LAYERS: Layers = {
  relief: true, territory: true, borders: true, rivers: true, cities: true, physical: true, front: true, prevFront: false,
  uncertainty: true, held: true, arrows: true, battles: true, objectives: false, sectors: true, opposing: false,
};

export const DEFAULT_PANELS: Panels = {
  title: true, date: true, event: true, commander: false, portrait: true, hierarchy: false, compare: false, legend: true, sources: true,
};

export function initialState(): PresentationState {
  return {
    rev: 0,
    origin: '',
    conflictId: 'ww2-europe',
    episodeId: null,
    sceneId: null,
    sceneIndex: 0,
    stepIndex: 0,
    date: '1941-06-21',
    playback: { playing: false, speed: 3, anchorDate: '1941-06-21', anchorAt: 0, endDate: null },
    camera: { lon: 24.0, lat: 52.0, zoom: 1.15, ms: 0, seq: 0 },
    layout: 'split-right',
    focus: { formations: [], dimOthers: true, battleId: null, operationId: null, cities: [], arrowIds: null },
    layers: { ...DEFAULT_LAYERS },
    panels: { ...DEFAULT_PANELS },
    hierarchy: { rootId: null, expanded: [] },
    caption: null,
    annotations: [],
    draft: null,
    hideUi: false,
    curtain: false,
    transition: { seq: 0, kind: 'fade' },
  };
}

/** Effective date while playing: anchorDate + elapsed seconds × speed (days/s), clamped to endDate. */
export function effectiveDate(s: PresentationState, serverNow: number, addDays: (d: ISODate, n: number) => ISODate): ISODate {
  if (!s.playback.playing) return s.date;
  const days = Math.max(0, ((serverNow - s.playback.anchorAt) / 1000) * s.playback.speed);
  const d = addDays(s.playback.anchorDate, Math.floor(days));
  return s.playback.endDate && d > s.playback.endDate ? s.playback.endDate : d;
}

export const ANNOTATION_COLORS = ['#b3261e', '#1d3557', '#d4a017', '#2d6a4f', '#111111', '#ffffff', '#e6f53a'];

export const SESSION_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

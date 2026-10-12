import type { PresentationState } from '../sync/state.ts';
import { DEFAULT_LAYERS, DEFAULT_PANELS } from '../sync/state.ts';
import type { Episode, Scene, ScenePatch } from './types.ts';

/** Apply one patch on top of a state (shallow-merging nested groups). */
export function applyPatch(s: PresentationState, p: ScenePatch, serverNow: number): PresentationState {
  let next: PresentationState = { ...s };
  if (p.date) next.date = p.date;
  if (p.camera) next.camera = { lon: p.camera.lon, lat: p.camera.lat, zoom: p.camera.zoom, ms: p.camera.ms ?? 1800, seq: s.camera.seq + 1 };
  if (p.layout) next.layout = p.layout;
  if (p.focus) next.focus = { ...next.focus, ...p.focus };
  if (p.layers) next.layers = { ...next.layers, ...p.layers };
  if (p.panels) next.panels = { ...next.panels, ...p.panels };
  if (p.hierarchy) next.hierarchy = p.hierarchy;
  if (p.caption !== undefined) next.caption = p.caption;
  if (p.annotations) next.annotations = p.annotations;
  if (p.curtain !== undefined) next.curtain = p.curtain;
  next.playback = { ...next.playback, playing: false, anchorDate: next.date, anchorAt: serverNow, endDate: null };
  if (p.playTo && p.playTo.date > next.date) {
    next.playback = { playing: true, speed: p.playTo.speed, anchorDate: next.date, anchorAt: serverNow, endDate: p.playTo.date };
  }
  next = { ...next };
  return next;
}

/** State for entering `scene` at build step `stepIndex` (0 = scene base, k = base + first k steps). */
export function sceneState(prev: PresentationState, episode: Episode, sceneIndex: number, stepIndex: number, serverNow: number, opts: { animate: boolean } = { animate: true }): PresentationState {
  const scene: Scene | undefined = episode.scenes[sceneIndex];
  if (!scene) return prev;
  const enteringScene = prev.sceneId !== scene.id;
  let s: PresentationState = { ...prev, episodeId: episode.id, sceneId: scene.id, sceneIndex, stepIndex };
  if (enteringScene || stepIndex === 0) {
    // Reset scene-scoped state so every scene starts from a known look.
    s = {
      ...s,
      layers: { ...DEFAULT_LAYERS },
      panels: { ...DEFAULT_PANELS },
      focus: { formations: [], dimOthers: true, battleId: null, operationId: null, cities: [], arrowIds: null },
      hierarchy: { rootId: null, expanded: [] },
      caption: null,
      annotations: [],
      draft: null,
      curtain: false,
      transition: { seq: prev.transition.seq + (enteringScene ? 1 : 0), kind: 'fade' },
    };
    s = applyPatch(s, scene.base, serverNow);
  }
  const from = enteringScene || stepIndex === 0 ? 0 : Math.min(prev.stepIndex, stepIndex);
  if (stepIndex < prev.stepIndex && !enteringScene) {
    // Going backwards inside a scene: rebuild from the base.
    s = sceneState({ ...prev, sceneId: null }, episode, sceneIndex, 0, serverNow);
    for (let i = 0; i < stepIndex; i++) s = applyPatch(s, scene.steps[i].patch, serverNow);
    s.stepIndex = stepIndex;
    s.playback = { ...s.playback, playing: false };
    return s;
  }
  for (let i = from; i < stepIndex; i++) {
    const isLast = i === stepIndex - 1;
    const patch = scene.steps[i].patch;
    // When jumping several steps at once only the last step animates its timeline.
    s = applyPatch(s, isLast ? patch : { ...patch, playTo: undefined, date: patch.playTo?.date ?? patch.date }, serverNow);
  }
  if (!opts.animate) s.camera = { ...s.camera, ms: 0 };
  s.stepIndex = stepIndex;
  return s;
}

/** Next/previous build step across scene boundaries. */
export function stepPosition(episode: Episode, sceneIndex: number, stepIndex: number, dir: 1 | -1): { sceneIndex: number; stepIndex: number } | null {
  const scene = episode.scenes[sceneIndex];
  if (!scene) return null;
  if (dir === 1) {
    if (stepIndex < scene.steps.length) return { sceneIndex, stepIndex: stepIndex + 1 };
    if (sceneIndex + 1 < episode.scenes.length) return { sceneIndex: sceneIndex + 1, stepIndex: 0 };
    return null;
  }
  if (stepIndex > 0) return { sceneIndex, stepIndex: stepIndex - 1 };
  if (sceneIndex > 0) return { sceneIndex: sceneIndex - 1, stepIndex: episode.scenes[sceneIndex - 1].steps.length };
  return null;
}

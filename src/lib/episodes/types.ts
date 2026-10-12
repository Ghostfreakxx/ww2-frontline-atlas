import type { Camera, ISODate, SourceRef } from '../history/types.ts';
import type { Annotation, Focus, Layers, Layout, Panels } from '../sync/state.ts';

/** A partial presentation state applied when a scene or build step is entered. */
export interface ScenePatch {
  date?: ISODate;
  camera?: Camera & { ms?: number };
  layout?: Layout;
  focus?: Partial<Focus>;
  layers?: Partial<Layers>;
  panels?: Partial<Panels>;
  hierarchy?: { rootId: string | null; expanded: string[] };
  caption?: { title: string; subtitle: string } | null;
  annotations?: Annotation[];
  /** Animate the timeline from the current date to this date. */
  playTo?: { date: ISODate; speed: number };
  curtain?: boolean;
}

export interface SceneStep {
  id: string;
  label: string;
  patch: ScenePatch;
  /** Presenter-only cue for this build step. */
  cue?: string;
}

export interface Scene {
  id: string;
  title: string;
  /** Presenter notes — never sent to the audience display. */
  notes: string;
  sources: SourceRef[];
  base: ScenePatch & { date: ISODate; camera: Camera & { ms?: number } };
  steps: SceneStep[];
}

export interface Episode {
  schema: 1;
  id: string;
  title: string;
  description: string;
  conflictId: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

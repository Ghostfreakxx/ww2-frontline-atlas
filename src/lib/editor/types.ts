// Reels editor project model. Times are in seconds. Media files themselves live in IndexedDB
// (see store.ts); the project only references them by id.

export type MediaKind = 'video' | 'image' | 'audio';

export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  /** Seconds (images: 0 — a still has no length of its own). */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** Small JPEG data URL for the bin and the timeline. */
  thumb: string | null;
  /** Normalised audio peaks (0–1) for waveforms. */
  peaks: number[] | null;
  createdAt: number;
}

export type Fit = 'fill' | 'fit';
export type Transition = 'cut' | 'dip' | 'flash';

export interface VideoClip {
  id: string;
  mediaId: string;
  /** Source in/out points. For images, `in` is 0 and `out` is how long the still is shown. */
  in: number;
  out: number;
  fit: Fit;
  /** Extra zoom on top of fill/fit (1 = none). */
  zoom: number;
  /** Framing offset as a fraction of the frame (-0.5…0.5), e.g. to keep a 16:9 subject centred in 9:16. */
  x: number;
  y: number;
  volume: number;
  /** Transition into this clip from the previous one. */
  transition: Transition;
}

export type TextStyle = 'caption' | 'box' | 'title' | 'subtitle' | 'label';
export type TextAnim = 'none' | 'pop' | 'fade' | 'rise';

export interface TextItem {
  id: string;
  text: string;
  start: number;
  end: number;
  style: TextStyle;
  /** Centre position as a fraction of the frame (0…1). */
  x: number;
  y: number;
  /** Font size in px at 1080 px frame width. */
  size: number;
  color: string;
  anim: TextAnim;
}

export interface AudioClip {
  id: string;
  mediaId: string;
  /** Position on the timeline. */
  start: number;
  in: number;
  out: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export type Aspect = '9:16' | '4:5' | '1:1' | '16:9';
export const ASPECTS: Record<Aspect, { w: number; h: number; label: string }> = {
  '9:16': { w: 1080, h: 1920, label: 'Reels / Shorts / TikTok 9:16' },
  '4:5': { w: 1080, h: 1350, label: 'Feed 4:5' },
  '1:1': { w: 1080, h: 1080, label: 'Square 1:1' },
  '16:9': { w: 1920, h: 1080, label: 'YouTube 16:9' },
};

export interface Project {
  id: string;
  name: string;
  aspect: Aspect;
  fps: number;
  background: string;
  clips: VideoClip[];
  texts: TextItem[];
  audio: AudioClip[];
  updatedAt: number;
}

export const TRANSITION_S = 0.35;
export const DEFAULT_IMAGE_S = 3;

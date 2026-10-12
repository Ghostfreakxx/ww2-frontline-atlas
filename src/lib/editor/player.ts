'use client';
import type { MediaItem, Project, VideoClip } from './types.ts';
import { audioGainAt, clipAt, clipStarts, clipLen, projectDuration, videoDuration } from './timeline.ts';
import { drawFrame, type Source } from './render.ts';

// Real-time playback of a project onto a canvas, with sound. Used by the preview, and by the
// real-time export fallback (MediaRecorder) on browsers without WebCodecs.

export interface PlayerOptions {
  canvas: HTMLCanvasElement;
  urls: Map<string, string>;
  media: Map<string, MediaItem>;
  /** Mute everything (the exporter mixes audio itself). */
  muted?: boolean;
  onTime?: (t: number, playing: boolean) => void;
  hideText?: () => string | null;
}

export class Player {
  private opts: PlayerOptions;
  private project: Project;
  private videos = new Map<string, HTMLVideoElement>();
  private images = new Map<string, HTMLImageElement>();
  private music = new Map<string, HTMLAudioElement>();
  private raf = 0;
  private wallStart = 0;
  private tStart = 0;
  private activeClip: string | null = null;
  t = 0;
  playing = false;

  constructor(project: Project, opts: PlayerOptions) {
    this.project = project;
    this.opts = opts;
  }

  setProject(p: Project) {
    this.project = p;
    if (!this.playing) this.seek(Math.min(this.t, projectDuration(p)));
  }
  setMedia(media: Map<string, MediaItem>, urls: Map<string, string>) {
    this.opts = { ...this.opts, media, urls };
  }

  private video(mediaId: string): HTMLVideoElement | null {
    const url = this.opts.urls.get(mediaId);
    if (!url) return null;
    let v = this.videos.get(mediaId);
    if (!v) {
      v = document.createElement('video');
      v.playsInline = true;
      v.preload = 'auto';
      v.muted = !!this.opts.muted;
      v.src = url;
      v.addEventListener('seeked', () => !this.playing && this.draw());
      v.addEventListener('loadeddata', () => !this.playing && this.draw());
      this.videos.set(mediaId, v);
    }
    return v;
  }
  private image(mediaId: string): HTMLImageElement | null {
    const url = this.opts.urls.get(mediaId);
    if (!url) return null;
    let i = this.images.get(mediaId);
    if (!i) {
      i = new Image();
      i.src = url;
      i.onload = () => !this.playing && this.draw();
      this.images.set(mediaId, i);
    }
    return i;
  }
  private audioEl(clipId: string, mediaId: string): HTMLAudioElement | null {
    const url = this.opts.urls.get(mediaId);
    if (!url) return null;
    let a = this.music.get(clipId);
    if (!a) {
      a = new Audio(url);
      a.preload = 'auto';
      this.music.set(clipId, a);
    }
    return a;
  }

  source = (clip: VideoClip): Source | null => {
    const m = this.opts.media.get(clip.mediaId);
    if (!m) return null;
    if (m.kind === 'image') {
      const i = this.image(clip.mediaId);
      return i && i.complete && i.naturalWidth ? { el: i, w: i.naturalWidth, h: i.naturalHeight } : null;
    }
    const v = this.video(clip.mediaId);
    return v && v.readyState >= 2 ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  };

  draw() {
    const c = this.opts.canvas;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, c.width, c.height, { project: this.project, t: this.t, media: this.opts.media, source: this.source, hideText: this.opts.hideText?.() ?? null, animate: this.playing || !!this.opts.muted });
  }

  /** Show the frame at time t (paused). */
  seek(t: number) {
    this.t = Math.max(0, t);
    const hit = clipAt(this.project, this.t);
    if (hit && this.opts.media.get(hit.clip.mediaId)?.kind === 'video') {
      const v = this.video(hit.clip.mediaId);
      if (v && Math.abs(v.currentTime - hit.source) > 0.01) v.currentTime = hit.source;
    }
    this.pauseMedia();
    this.draw();
    this.opts.onTime?.(this.t, this.playing);
  }

  play() {
    const end = projectDuration(this.project);
    if (end <= 0) return;
    if (this.t >= end - 0.05) this.t = 0;
    this.playing = true;
    this.wallStart = performance.now();
    this.tStart = this.t;
    this.activeClip = null;
    cancelAnimationFrame(this.raf);
    const tick = () => {
      if (!this.playing) return;
      this.step();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.pauseMedia();
    this.opts.onTime?.(this.t, false);
  }

  private pauseMedia() {
    for (const v of this.videos.values()) if (!v.paused) v.pause();
    for (const a of this.music.values()) if (!a.paused) a.pause();
  }

  private step() {
    const p = this.project;
    const end = projectDuration(p);
    const vEnd = videoDuration(p);
    let t = this.tStart + (performance.now() - this.wallStart) / 1000;
    const hit = clipAt(p, Math.min(t, vEnd));
    if (hit && t < vEnd) {
      const m = this.opts.media.get(hit.clip.mediaId);
      if (m?.kind === 'video') {
        const v = this.video(hit.clip.mediaId)!;
        v.volume = Math.max(0, Math.min(1, hit.clip.volume));
        v.muted = !!this.opts.muted || hit.clip.volume <= 0;
        if (this.activeClip !== hit.clip.id) {
          // Entering a clip: start its video at the right point.
          this.activeClip = hit.clip.id;
          for (const [id, other] of this.videos) if (id !== hit.clip.mediaId && !other.paused) other.pause();
          v.currentTime = hit.source;
          v.play().catch(() => {});
        } else if (!v.paused && !v.seeking && v.readyState >= 3) {
          // The video drives the clock while it plays (keeps sound and picture together).
          const vt = hit.start + (v.currentTime - hit.clip.in);
          if (Math.abs(vt - t) < 0.5) {
            t = vt;
            this.tStart = t;
            this.wallStart = performance.now();
          }
          if (v.currentTime >= hit.clip.out - 0.02) {
            t = hit.start + clipLen(hit.clip) + 0.001;
            this.tStart = t;
            this.wallStart = performance.now();
          }
        } else if (v.paused) v.play().catch(() => {});
      } else {
        this.activeClip = hit.clip.id;
        for (const other of this.videos.values()) if (!other.paused) other.pause();
      }
    } else {
      for (const other of this.videos.values()) if (!other.paused) other.pause();
    }
    // Music.
    const musicEnd = vEnd > 0 ? vEnd : end;
    for (const a of p.audio) {
      const el = this.audioEl(a.id, a.mediaId);
      if (!el) continue;
      const g = audioGainAt(a, t, musicEnd);
      const inside = t >= a.start && t < a.start + (a.out - a.in) && t < musicEnd;
      if (inside && !this.opts.muted) {
        el.volume = Math.max(0, Math.min(1, g));
        const want = a.in + (t - a.start);
        if (el.paused) {
          el.currentTime = want;
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
      } else if (!el.paused) el.pause();
    }
    this.t = t;
    if (t >= end) {
      this.t = end;
      this.draw();
      this.pause();
      return;
    }
    this.draw();
    this.opts.onTime?.(this.t, true);
  }

  /** Clip boundaries for snapping. */
  edges() {
    const s = clipStarts(this.project);
    return [...s, videoDuration(this.project)];
  }

  dispose() {
    this.pause();
    for (const v of this.videos.values()) {
      v.removeAttribute('src');
      v.load();
    }
    for (const a of this.music.values()) a.src = '';
    this.videos.clear();
    this.music.clear();
    this.images.clear();
  }
}

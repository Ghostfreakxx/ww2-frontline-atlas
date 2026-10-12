import type { AudioClip, MediaItem, Project, TextItem, VideoClip } from './types.ts';
import { DEFAULT_IMAGE_S } from './types.ts';

// Pure timeline operations. The video track is a gap-free sequence; text and audio items are placed
// at absolute times.

export const uid = (p = 'x') => `${p}${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
export const MIN_CLIP_S = 0.2;

export const clipLen = (c: VideoClip) => Math.max(0, c.out - c.in);

export function newProject(name = 'Untitled reel'): Project {
  return { id: uid('p'), name, aspect: '9:16', fps: 30, background: '#000000', clips: [], texts: [], audio: [], updatedAt: Date.now() };
}

/** Start time of every clip on the video track. */
export function clipStarts(p: Project): number[] {
  const out: number[] = [];
  let t = 0;
  for (const c of p.clips) {
    out.push(t);
    t += clipLen(c);
  }
  return out;
}

export function videoDuration(p: Project) {
  return p.clips.reduce((s, c) => s + clipLen(c), 0);
}

/** Total length: the video track, or longer if text or audio runs past it. */
export function projectDuration(p: Project) {
  const v = videoDuration(p);
  const t = p.texts.reduce((m, x) => Math.max(m, x.end), 0);
  // Music is cut at the end of the video unless there is no video at all.
  const a = v > 0 ? 0 : p.audio.reduce((m, x) => Math.max(m, x.start + (x.out - x.in)), 0);
  return Math.max(v, t, a);
}

/** The clip playing at timeline time `t`, with its local source time. */
export function clipAt(p: Project, t: number): { index: number; clip: VideoClip; start: number; local: number; source: number } | null {
  let s = 0;
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i];
    const len = clipLen(c);
    if (t < s + len || (i === p.clips.length - 1 && t <= s + len)) {
      const local = Math.max(0, Math.min(len, t - s));
      return { index: i, clip: c, start: s, local, source: c.in + local };
    }
    s += len;
  }
  return null;
}

export function makeClip(m: MediaItem): VideoClip {
  const len = m.kind === 'image' ? DEFAULT_IMAGE_S : m.duration;
  return { id: uid('c'), mediaId: m.id, in: 0, out: len, fit: 'fill', zoom: 1, x: 0, y: 0, volume: 1, transition: 'cut' };
}

export function makeAudio(m: MediaItem, start: number): AudioClip {
  return { id: uid('a'), mediaId: m.id, start, in: 0, out: m.duration, volume: 0.8, fadeIn: 0.5, fadeOut: 1.5 };
}

export function makeText(start: number, style: TextItem['style'] = 'caption', text = 'Your text'): TextItem {
  const preset = TEXT_PRESETS[style];
  return { id: uid('t'), text, start, end: start + 2.5, style, x: 0.5, y: preset.y, size: preset.size, color: preset.color, anim: preset.anim };
}

export const TEXT_PRESETS: Record<TextItem['style'], { label: string; y: number; size: number; color: string; anim: TextItem['anim'] }> = {
  caption: { label: 'Caption (bold, outlined)', y: 0.62, size: 72, color: '#ffffff', anim: 'pop' },
  box: { label: 'Box (Reels label)', y: 0.2, size: 56, color: '#111111', anim: 'pop' },
  title: { label: 'Title (serif)', y: 0.38, size: 104, color: '#ffffff', anim: 'rise' },
  subtitle: { label: 'Subtitle (lower)', y: 0.82, size: 50, color: '#ffffff', anim: 'fade' },
  label: { label: 'Small label', y: 0.1, size: 40, color: '#e6f53a', anim: 'fade' },
};

/** Split the clip under timeline time `t` into two. Returns the project unchanged if `t` is too close to an edge. */
export function splitAt(p: Project, t: number): Project {
  const hit = clipAt(p, t);
  if (!hit || hit.local < MIN_CLIP_S || clipLen(hit.clip) - hit.local < MIN_CLIP_S) return p;
  const a: VideoClip = { ...hit.clip, out: hit.source };
  const b: VideoClip = { ...hit.clip, id: uid('c'), in: hit.source, transition: 'cut' };
  const clips = [...p.clips];
  clips.splice(hit.index, 1, a, b);
  return { ...p, clips };
}

/** Remove a clip; following clips close the gap (ripple). Text after it moves left too. */
export function deleteClip(p: Project, id: string, ripple = true): Project {
  const i = p.clips.findIndex((c) => c.id === id);
  if (i < 0) return p;
  const start = clipStarts(p)[i];
  const len = clipLen(p.clips[i]);
  const clips = p.clips.filter((c) => c.id !== id);
  if (i === 0 && clips[0]) clips[0] = { ...clips[0], transition: 'cut' };
  const texts = ripple ? p.texts.map((x) => (x.start >= start + len ? { ...x, start: x.start - len, end: x.end - len } : x)) : p.texts;
  return { ...p, clips, texts };
}

export function moveClip(p: Project, from: number, to: number): Project {
  if (from === to || from < 0 || to < 0 || from >= p.clips.length || to >= p.clips.length) return p;
  const clips = [...p.clips];
  const [c] = clips.splice(from, 1);
  clips.splice(to, 0, c);
  return { ...p, clips };
}

/** Trim a clip's in or out point by `delta` seconds of source time, within the media's length. */
export function trimClip(p: Project, id: string, edge: 'in' | 'out', value: number, media: MediaItem | undefined): Project {
  return {
    ...p,
    clips: p.clips.map((c) => {
      if (c.id !== id) return c;
      const max = media && media.kind !== 'image' ? media.duration : Infinity;
      if (edge === 'in') return { ...c, in: Math.max(0, Math.min(value, c.out - MIN_CLIP_S)) };
      return { ...c, out: Math.min(max, Math.max(value, c.in + MIN_CLIP_S)) };
    }),
  };
}

export function updateClip(p: Project, id: string, patch: Partial<VideoClip>): Project {
  return { ...p, clips: p.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}
export function updateText(p: Project, id: string, patch: Partial<TextItem>): Project {
  return { ...p, texts: p.texts.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}
export function updateAudio(p: Project, id: string, patch: Partial<AudioClip>): Project {
  return { ...p, audio: p.audio.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

/** Gain of an audio clip at timeline time `t` (fades applied), 0 outside it. */
export function audioGainAt(a: AudioClip, t: number, end: number): number {
  const len = a.out - a.in;
  const local = t - a.start;
  if (local < 0 || local > len || t > end) return 0;
  let g = a.volume;
  if (a.fadeIn > 0 && local < a.fadeIn) g *= local / a.fadeIn;
  const tail = Math.min(len, end - a.start) - local;
  if (a.fadeOut > 0 && tail < a.fadeOut) g *= Math.max(0, tail / a.fadeOut);
  return g;
}

/** Parse SubRip (.srt) subtitles into text items. */
export function parseSrt(src: string, style: TextItem['style'] = 'subtitle'): TextItem[] {
  const ts = (s: string) => {
    const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0').slice(0, 3)) / 1000 : NaN;
  };
  return src
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      const ti = lines.findIndex((l) => l.includes('-->'));
      if (ti < 0) return [];
      const [a, b] = lines[ti].split('-->');
      const start = ts(a);
      const end = ts(b);
      const text = lines.slice(ti + 1).join('\n').replace(/<[^>]+>/g, '');
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return [];
      return [{ ...makeText(start, style, text), end }];
    });
}

/** Seconds → "m:ss.d" for the UI. */
export function fmtTime(t: number) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

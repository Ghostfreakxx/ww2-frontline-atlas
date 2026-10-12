'use client';
import type { MediaItem, MediaKind, Project } from './types.ts';
import { uid } from './timeline.ts';

// Browser-local storage for the editor (IndexedDB): media files and projects stay on this device.

const DB = 'atlas-editor';
const VERSION = 1;
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbp = null;
      reject(req.error);
    };
  });
  return dbp;
}

function tx<T>(store: string | string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = fn(t);
        t.oncomplete = () => resolve(r ? r.result : (undefined as T));
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('aborted'));
      }),
  );
}

export const listMedia = () => tx<MediaItem[]>('media', 'readonly', (t) => t.objectStore('media').getAll()).then((m) => m.sort((a, b) => a.createdAt - b.createdAt));
export const getBlob = (id: string) => tx<Blob | undefined>('blobs', 'readonly', (t) => t.objectStore('blobs').get(id));
export const deleteMedia = (id: string) =>
  tx('media', 'readwrite', (t) => {
    t.objectStore('media').delete(id);
  }).then(() => tx('blobs', 'readwrite', (t) => {
    t.objectStore('blobs').delete(id);
  }));

export const listProjects = () => tx<Project[]>('projects', 'readonly', (t) => t.objectStore('projects').getAll()).then((p) => p.sort((a, b) => b.updatedAt - a.updatedAt));
export const getProject = (id: string) => tx<Project | undefined>('projects', 'readonly', (t) => t.objectStore('projects').get(id));
export const saveProject = (p: Project) => tx('projects', 'readwrite', (t) => {
  t.objectStore('projects').put(p);
});
export const deleteProject = (id: string) => tx('projects', 'readwrite', (t) => {
  t.objectStore('projects').delete(id);
});

function kindOf(type: string, name: string): MediaKind | null {
  if (type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(name)) return 'video';
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return 'image';
  if (type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(name)) return 'audio';
  return null;
}

const once = (el: EventTarget, ok: string, timeoutMs = 15000) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ok}`)), timeoutMs);
    el.addEventListener(ok, () => (clearTimeout(t), resolve()), { once: true });
    el.addEventListener('error', () => (clearTimeout(t), reject(new Error('could not read this file'))), { once: true });
  });

function thumbOf(src: CanvasImageSource, w: number, h: number) {
  const c = document.createElement('canvas');
  const s = 160 / Math.max(w, h);
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

/** WebM files from MediaRecorder report Infinity duration until the browser is made to scan to the end. */
async function realDuration(v: HTMLVideoElement | HTMLAudioElement) {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  v.currentTime = 1e7;
  await once(v, 'seeked').catch(() => {});
  const d = v.duration;
  v.currentTime = 0;
  return Number.isFinite(d) ? d : 0;
}

export async function peaksOf(blob: Blob, n = 400): Promise<number[] | null> {
  if (blob.size > 300 * 1024 * 1024) return null;
  try {
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / n));
    const out: number[] = [];
    let max = 0;
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 8) m = Math.max(m, Math.abs(data[j]));
      out.push(m);
      max = Math.max(max, m);
    }
    return max > 0 ? out.map((v) => +(v / max).toFixed(3)) : out;
  } catch {
    return null;
  }
}

/** Read a file's metadata (duration, size, thumbnail, waveform) and store it. */
export async function importMedia(file: Blob, name: string): Promise<MediaItem> {
  const kind = kindOf(file.type, name);
  if (!kind) throw new Error(`${name}: not a video, image or audio file`);
  const url = URL.createObjectURL(file);
  const item: MediaItem = { id: uid('m'), name, kind, mime: file.type, duration: 0, width: 0, height: 0, hasAudio: kind !== 'image', thumb: null, peaks: null, createdAt: Date.now() };
  try {
    if (kind === 'image') {
      const img = new Image();
      img.src = url;
      await img.decode();
      item.width = img.naturalWidth;
      item.height = img.naturalHeight;
      item.thumb = thumbOf(img, item.width, item.height);
    } else if (kind === 'video') {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = url;
      await once(v, 'loadedmetadata');
      item.duration = await realDuration(v);
      item.width = v.videoWidth;
      item.height = v.videoHeight;
      v.currentTime = Math.min(1, item.duration / 3);
      await once(v, 'seeked').catch(() => {});
      if (v.videoWidth) item.thumb = thumbOf(v, v.videoWidth, v.videoHeight);
      item.peaks = await peaksOf(file, 400);
      item.hasAudio = item.peaks !== null && item.peaks.some((p) => p > 0.01);
    } else {
      const a = document.createElement('audio');
      a.preload = 'auto';
      a.src = url;
      await once(a, 'loadedmetadata');
      item.duration = await realDuration(a);
      item.peaks = await peaksOf(file, 600);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  await tx('blobs', 'readwrite', (t) => {
    t.objectStore('blobs').put(file, item.id);
  });
  await tx('media', 'readwrite', (t) => {
    t.objectStore('media').put(item);
  });
  return item;
}

'use client';
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer';
import type { MediaItem, Project, VideoClip } from './types.ts';
import { TRANSITION_S } from './types.ts';
import { clipAt, clipStarts, clipLen, projectDuration, videoDuration } from './timeline.ts';
import { drawFrame, frameSize, type Source } from './render.ts';
import { Player } from './player.ts';

// Export, in order of preference:
// 1. MP4 (H.264 + AAC) with WebCodecs, frame by frame — what Instagram, TikTok and YouTube want (Chrome, Edge).
// 2. MP4 recorded in real time with MediaRecorder (Safari / iPad, where AAC encoding is not in WebCodecs).
// 3. WebM (VP9 + Opus) with WebCodecs — fast, but needs converting for Instagram.
// 4. WebM recorded in real time.

export interface ExportProgress {
  phase: 'audio' | 'video' | 'finishing';
  done: number;
  total: number;
}
export interface ExportResult {
  blob: Blob;
  ext: 'mp4' | 'webm';
  method: 'webcodecs' | 'realtime';
  seconds: number;
}

/** A WebCodecs encoding plan: container plus codec strings. */
export interface CodecPlan {
  container: 'mp4' | 'webm';
  video: string;
  audio: string;
}

const SAMPLE_RATE = 48000;

/** Mix every clip's sound and the music into one stereo buffer. */
export async function mixAudio(p: Project, media: Map<string, MediaItem>, getBlob: (id: string) => Promise<Blob | undefined>): Promise<AudioBuffer> {
  const duration = Math.max(0.1, projectDuration(p));
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const decoded = new Map<string, AudioBuffer | null>();
  const decode = async (id: string) => {
    if (!decoded.has(id)) {
      try {
        const blob = await getBlob(id);
        decoded.set(id, blob ? await ctx.decodeAudioData(await blob.arrayBuffer()) : null);
      } catch {
        decoded.set(id, null); // a clip without a sound track
      }
    }
    return decoded.get(id) ?? null;
  };
  const starts = clipStarts(p);
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i];
    const m = media.get(c.mediaId);
    if (!m || m.kind !== 'video' || !m.hasAudio || c.volume <= 0) continue;
    const buf = await decode(c.mediaId);
    if (!buf) continue;
    const len = clipLen(c);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const t0 = starts[i];
    // Short ramps avoid clicks at cuts; dips/flashes duck the sound with the picture.
    const rampIn = c.transition !== 'cut' && i > 0 ? TRANSITION_S : 0.01;
    const next = p.clips[i + 1];
    const rampOut = next && next.transition !== 'cut' ? TRANSITION_S : 0.01;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(c.volume, t0 + Math.min(rampIn, len / 2));
    g.gain.setValueAtTime(c.volume, Math.max(t0 + Math.min(rampIn, len / 2), t0 + len - Math.min(rampOut, len / 2)));
    g.gain.linearRampToValueAtTime(0, t0 + len);
    src.connect(g).connect(ctx.destination);
    src.start(t0, c.in, len);
  }
  const vEnd = videoDuration(p);
  const musicEnd = vEnd > 0 ? vEnd : duration;
  for (const a of p.audio) {
    const buf = await decode(a.mediaId);
    if (!buf || a.start >= musicEnd) continue;
    const len = Math.min(a.out - a.in, musicEnd - a.start);
    if (len <= 0) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const fi = Math.min(a.fadeIn, len / 2);
    const fo = Math.min(a.fadeOut, len / 2);
    g.gain.setValueAtTime(fi > 0 ? 0 : a.volume, a.start);
    if (fi > 0) g.gain.linearRampToValueAtTime(a.volume, a.start + fi);
    g.gain.setValueAtTime(a.volume, a.start + len - fo);
    g.gain.linearRampToValueAtTime(fo > 0 ? 0 : a.volume, a.start + len);
    src.connect(g).connect(ctx.destination);
    src.start(a.start, a.in, len);
  }
  return ctx.startRendering();
}

const H264 = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640033'];

async function videoOk(codec: string, w: number, h: number) {
  try {
    return !!(await VideoEncoder.isConfigSupported({ codec, width: w, height: h, bitrate: 8_000_000, framerate: 30 })).supported;
  } catch {
    return false;
  }
}
async function audioOk(codec: string) {
  try {
    return !!(await AudioEncoder.isConfigSupported({ codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160_000 })).supported;
  } catch {
    return false;
  }
}
const hasWebCodecs = () => typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
export const realtimeMp4 = () => typeof MediaRecorder !== 'undefined' && ['video/mp4;codecs=avc1,mp4a', 'video/mp4'].some((m) => MediaRecorder.isTypeSupported(m));

/** The best way this browser can export: a WebCodecs plan, or null for real-time recording. */
export async function pickPlan(w: number, h: number): Promise<{ plan: CodecPlan | null; instagramReady: boolean }> {
  // Test hook: force a plan (the test browser has no H.264/AAC encoder).
  const forced = typeof window !== 'undefined' ? (window as unknown as { __atlasExportPlan?: CodecPlan | 'realtime' }).__atlasExportPlan : undefined;
  if (forced === 'realtime') return { plan: null, instagramReady: realtimeMp4() };
  if (forced) return { plan: forced, instagramReady: false };
  if (hasWebCodecs() && (await audioOk('mp4a.40.2'))) {
    for (const codec of H264) if (await videoOk(codec, w, h)) return { plan: { container: 'mp4', video: codec, audio: 'mp4a.40.2' }, instagramReady: true };
  }
  if (realtimeMp4()) return { plan: null, instagramReady: true };
  if (hasWebCodecs() && (await videoOk('vp09.00.40.08', w, h)) && (await audioOk('opus'))) return { plan: { container: 'webm', video: 'vp09.00.40.08', audio: 'opus' }, instagramReady: false };
  return { plan: null, instagramReady: false };
}

const waitFor = (el: EventTarget, ev: string, ms = 4000) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    el.addEventListener(ev, () => (clearTimeout(t), resolve()), { once: true });
  });

export async function exportProject(
  p: Project,
  media: Map<string, MediaItem>,
  getBlob: (id: string) => Promise<Blob | undefined>,
  onProgress: (pr: ExportProgress) => void,
  signal: AbortSignal,
  opts: { forceRealtime?: boolean } = {},
): Promise<ExportResult> {
  const { w: W, h: H } = frameSize(p);
  const started = performance.now();
  onProgress({ phase: 'audio', done: 0, total: 1 });
  const audio = await mixAudio(p, media, getBlob);
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
  const { plan } = opts.forceRealtime ? { plan: null } : await pickPlan(W, H);
  const urls = new Map<string, string>();
  for (const id of new Set([...p.clips.map((c) => c.mediaId), ...p.audio.map((a) => a.mediaId)])) {
    const b = await getBlob(id);
    if (b) urls.set(id, URL.createObjectURL(b));
  }
  try {
    if (plan) {
      const blob = await encodeWebCodecs(p, media, urls, audio, plan, onProgress, signal);
      return { blob, ext: plan.container, method: 'webcodecs', seconds: (performance.now() - started) / 1000 };
    }
    const r = await encodeRealtime(p, media, urls, audio, onProgress, signal);
    return { ...r, method: 'realtime', seconds: (performance.now() - started) / 1000 };
  } finally {
    for (const u of urls.values()) URL.revokeObjectURL(u);
  }
}

async function encodeWebCodecs(p: Project, media: Map<string, MediaItem>, urls: Map<string, string>, audio: AudioBuffer, plan: CodecPlan, onProgress: (pr: ExportProgress) => void, signal: AbortSignal): Promise<Blob> {
  const { w: W, h: H } = frameSize(p);
  const fps = p.fps;
  const duration = projectDuration(p);
  const frames = Math.max(1, Math.round(duration * fps));
  const short = (c: string) => (c.startsWith('avc1') ? 'avc' : c.startsWith('vp09') ? 'vp9' : c.startsWith('av01') ? 'av1' : c);
  const mp4 =
    plan.container === 'mp4'
      ? new Mp4Muxer({
          target: new Mp4Target(),
          video: { codec: short(plan.video) as 'avc' | 'vp9' | 'av1', width: W, height: H, frameRate: fps },
          audio: { codec: plan.audio.startsWith('mp4a') ? 'aac' : 'opus', numberOfChannels: 2, sampleRate: SAMPLE_RATE },
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        })
      : null;
  const webm =
    plan.container === 'webm'
      ? new WebmMuxer({
          target: new WebmTarget(),
          video: { codec: plan.video.startsWith('vp09') ? 'V_VP9' : plan.video.startsWith('av01') ? 'V_AV1' : 'V_VP8', width: W, height: H, frameRate: fps },
          audio: { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: SAMPLE_RATE },
          firstTimestampBehavior: 'offset',
        })
      : null;
  let failure: Error | null = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => (mp4 ? mp4.addVideoChunk(chunk, meta) : webm!.addVideoChunk(chunk, meta)), error: (e) => (failure = e) });
  venc.configure({ codec: plan.video, width: W, height: H, bitrate: W * H > 1_500_000 ? 10_000_000 : 6_000_000, framerate: fps, latencyMode: 'quality' });
  const aenc = new AudioEncoder({ output: (chunk, meta) => (mp4 ? mp4.addAudioChunk(chunk, meta) : webm!.addAudioChunk(chunk, meta)), error: (e) => (failure = e) });
  aenc.configure({ codec: plan.audio, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 160_000 });

  // Audio first (it is already mixed).
  const CH = 4096;
  const L = audio.getChannelData(0);
  const R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
  for (let i = 0; i < audio.length; i += CH) {
    const n = Math.min(CH, audio.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SAMPLE_RATE) * 1e6), data });
    aenc.encode(ad);
    ad.close();
  }

  // Video, frame by frame: seek each clip's video to the exact source time and draw.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const videos = new Map<string, HTMLVideoElement>();
  const images = new Map<string, ImageBitmap>();
  for (const [id, url] of urls) {
    const m = media.get(id);
    if (m?.kind === 'video' && p.clips.some((c) => c.mediaId === id)) {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = url;
      await waitFor(v, 'loadeddata', 10000);
      videos.set(id, v);
    } else if (m?.kind === 'image') {
      images.set(id, await createImageBitmap(await (await fetch(url)).blob()));
    }
  }
  const source = (clip: VideoClip): Source | null => {
    const img = images.get(clip.mediaId);
    if (img) return { el: img, w: img.width, h: img.height };
    const v = videos.get(clip.mediaId);
    return v && v.videoWidth ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  };
  try {
    for (let n = 0; n < frames; n++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      const t = n / fps;
      const hit = clipAt(p, t);
      if (hit) {
        const v = videos.get(hit.clip.mediaId);
        if (v) {
          // Sample the middle of the output frame's interval, clamped inside the clip.
          const target = Math.min(hit.clip.out - 0.001, hit.source + 0.5 / fps);
          if (Math.abs(v.currentTime - target) > 0.0005) {
            v.currentTime = target;
            await waitFor(v, 'seeked');
          }
        }
      }
      drawFrame(ctx, W, H, { project: p, t, media, source });
      const frame = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: n % (fps * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
      if (n % 5 === 0) onProgress({ phase: 'video', done: n, total: frames });
    }
    onProgress({ phase: 'finishing', done: frames, total: frames });
    await venc.flush();
    await aenc.flush();
    if (failure) throw failure;
    if (mp4) {
      mp4.finalize();
      return new Blob([mp4.target.buffer], { type: 'video/mp4' });
    }
    webm!.finalize();
    return new Blob([webm!.target.buffer], { type: 'video/webm' });
  } finally {
    for (const v of videos.values()) {
      v.removeAttribute('src');
      v.load();
    }
    for (const b of images.values()) b.close();
    if (venc.state !== 'closed') venc.close();
    if (aenc.state !== 'closed') aenc.close();
  }
}

function recorderMime(): { mime: string; ext: 'mp4' | 'webm' } {
  const options: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1,mp4a', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [mime, ext] of options) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  throw new Error('This browser cannot export video. Use a current Chrome, Edge or Safari.');
}

async function encodeRealtime(p: Project, media: Map<string, MediaItem>, urls: Map<string, string>, audio: AudioBuffer, onProgress: (pr: ExportProgress) => void, signal: AbortSignal): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  const { w: W, h: H } = frameSize(p);
  const duration = projectDuration(p);
  const { mime, ext } = recorderMime();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const player = new Player(p, { canvas, urls, media, muted: true });
  const actx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const dest = actx.createMediaStreamDestination();
  const src = actx.createBufferSource();
  src.buffer = audio;
  src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(p.fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  // Warm up: seek to the start so the first frame is ready.
  player.seek(0);
  await new Promise((r) => setTimeout(r, 400));
  rec.start(500);
  src.start();
  player.play();
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      onProgress({ phase: 'video', done: Math.round(player.t * 10), total: Math.round(duration * 10) });
      if (signal.aborted || !player.playing) {
        clearInterval(iv);
        resolve();
      }
    }, 200);
  });
  player.pause();
  src.stop();
  rec.stop();
  await stopped;
  player.dispose();
  await actx.close();
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext };
}

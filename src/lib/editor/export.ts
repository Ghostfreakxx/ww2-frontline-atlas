'use client';
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer';
import { ALL_FORMATS, AudioBufferSink, BlobSource, Input, VideoSampleSink, type VideoSample } from 'mediabunny';
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
        let buf: AudioBuffer | null = null;
        if (blob) {
          try {
            buf = await ctx.decodeAudioData(await blob.arrayBuffer());
          } catch {
            buf = await decodeAudioFallback(blob, ctx);
          }
        }
        decoded.set(id, buf);
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

/** Direct decoding of a media file (WebCodecs VideoDecoder via a demuxer): fast, frame-exact, handles rotation. */
interface Decoder {
  input: Input;
  sink: VideoSampleSink;
  /** The file's first timestamp: source times are relative to it. */
  first: number;
}
async function openDecoder(blob: Blob): Promise<Decoder | null> {
  if (typeof VideoDecoder === 'undefined') return null;
  let input: Input | null = null;
  try {
    input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error('cannot decode');
    return { input, sink: new VideoSampleSink(track), first: await track.getFirstTimestamp() };
  } catch {
    input?.dispose();
    return null;
  }
}

/**
 * Walks a clip's decoded frames in order and returns the frame showing at each (increasing) source time.
 * Sequential decoding only — per-timestamp lookups need keyframe indexes, which MediaRecorder WebM
 * files (e.g. "Record tab") often lack.
 */
class SequentialFrames {
  private it: AsyncIterator<VideoSample>;
  private cur: VideoSample | null = null;
  private peek: VideoSample | null = null;
  private done = false;
  private started = false;
  constructor(sink: VideoSampleSink, private first: number, start: number) {
    this.it = sink.samples(Math.max(0, start + first - 0.5))[Symbol.asyncIterator]();
  }
  private async pull() {
    if (this.done) return null;
    const r = await this.it.next();
    if (r.done) {
      this.done = true;
      return null;
    }
    return r.value;
  }
  /** The frame at source time `t` (relative to the file start). The returned sample stays valid until the next call. */
  async at(t: number): Promise<VideoSample | null> {
    const target = t + this.first + 1e-4;
    if (!this.started) {
      this.started = true;
      this.peek = await this.pull();
    }
    while (this.peek && this.peek.timestamp <= target) {
      this.cur?.close();
      this.cur = this.peek;
      this.peek = await this.pull();
    }
    // Before the first decoded frame: show the first one rather than nothing.
    return this.cur ?? this.peek;
  }
  async close() {
    await this.it.return?.(undefined).catch(() => {});
    this.cur?.close();
    this.peek?.close();
    this.cur = this.peek = null;
  }
}

/** Decode a file's sound into one AudioBuffer when the browser's decodeAudioData cannot (e.g. some MOV files). */
async function decodeAudioFallback(blob: Blob, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const first = await track.getFirstTimestamp();
    const parts: { buffer: AudioBuffer; timestamp: number }[] = [];
    for await (const wrapped of new AudioBufferSink(track).buffers()) parts.push(wrapped);
    if (!parts.length) return null;
    const rate = parts[0].buffer.sampleRate;
    const channels = Math.max(...parts.map((x) => x.buffer.numberOfChannels));
    const last = parts[parts.length - 1];
    const length = Math.ceil((last.timestamp - first) * rate) + last.buffer.length;
    const out = ctx.createBuffer(channels, length, rate);
    for (const { buffer, timestamp } of parts) {
      const at = Math.max(0, Math.round((timestamp - first) * rate));
      for (let ch = 0; ch < channels; ch++) out.getChannelData(ch).set(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)).subarray(0, Math.max(0, length - at)), at);
    }
    return out;
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}

/**
 * Reads a video's frames in order for export. Seeking every frame is slow, and very slow in WebM
 * files without a seek index (MediaRecorder output, e.g. "Record tab"), where each seek scans from
 * the start. Instead the muted video plays fast and pauses on each decoded frame
 * (requestVideoFrameCallback); exact seeks are used only for jumps (a new clip, a cut back) or if
 * playback overshoots.
 */
class FrameReader {
  private last = -1;
  private readonly stepping: boolean;
  constructor(private v: HTMLVideoElement) {
    this.stepping = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    v.playbackRate = 8;
  }
  private async seek(t: number) {
    this.v.pause();
    this.v.currentTime = t;
    await waitFor(this.v, 'seeked');
    this.last = t;
  }
  private next(): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.v.removeEventListener('ended', onEnd);
        resolve(ok);
      };
      const onEnd = () => finish(false);
      // No frame (hidden tab, end of file): fall back to seeking.
      const timer = setTimeout(() => finish(false), 2500);
      this.v.addEventListener('ended', onEnd, { once: true });
      this.v.requestVideoFrameCallback((_now, meta) => {
        this.v.pause();
        this.last = meta.mediaTime;
        finish(true);
      });
      this.v.play().catch(() => finish(false));
    });
  }
  /** Show the frame for source time `target`. */
  async at(target: number, frameDur: number) {
    const tol = frameDur / 2;
    if (!this.stepping) {
      if (Math.abs(this.v.currentTime - target) > 0.0005) await this.seek(target);
      return;
    }
    if (this.last < 0 || target < this.last - tol || target > this.last + 2) return this.seek(target);
    for (let guard = 0; this.last < target - tol && guard < 600; guard++) {
      if (!(await this.next())) return this.seek(target);
    }
    if (this.last > target + 3 * frameDur) await this.seek(target);
  }
}

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
      const blob = await encodeWebCodecs(p, media, urls, getBlob, audio, plan, onProgress, signal);
      return { blob, ext: plan.container, method: 'webcodecs', seconds: (performance.now() - started) / 1000 };
    }
    const r = await encodeRealtime(p, media, urls, audio, onProgress, signal);
    return { ...r, method: 'realtime', seconds: (performance.now() - started) / 1000 };
  } finally {
    for (const u of urls.values()) URL.revokeObjectURL(u);
  }
}

async function encodeWebCodecs(p: Project, media: Map<string, MediaItem>, urls: Map<string, string>, getBlob: (id: string) => Promise<Blob | undefined>, audio: AudioBuffer, plan: CodecPlan, onProgress: (pr: ExportProgress) => void, signal: AbortSignal): Promise<Blob> {
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

  // Video, frame by frame.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const decoders = new Map<string, Decoder>();
  const videos = new Map<string, HTMLVideoElement>();
  const readers = new Map<string, FrameReader>();
  const images = new Map<string, ImageBitmap>();
  const stats = { read: 0, draw: 0, encode: 0, decoded: 0, fallback: 0 };
  (globalThis as unknown as { __atlasExportStats?: typeof stats }).__atlasExportStats = stats;
  for (const [id, url] of urls) {
    const m = media.get(id);
    if (m?.kind === 'video' && p.clips.some((c) => c.mediaId === id)) {
      const blob = await getBlob(id);
      const dec = blob ? await openDecoder(blob) : null;
      if (dec) {
        decoders.set(id, dec);
        continue;
      }
      // The browser cannot decode this file directly: read it through a <video> element instead.
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = url;
      await waitFor(v, 'loadeddata', 10000);
      videos.set(id, v);
      readers.set(id, new FrameReader(v));
    } else if (m?.kind === 'image') {
      images.set(id, await createImageBitmap(await (await fetch(url)).blob()));
    }
  }

  // Which clip and source time each output frame shows (middle of the frame's interval, inside the clip).
  const plan2 = Array.from({ length: frames }, (_, n) => {
    const hit = clipAt(p, n / fps);
    return hit ? { clip: hit.index, src: Math.min(hit.clip.out - 0.001, hit.source + 0.5 / fps) } : null;
  });

  let current: VideoSample | null = null;
  let seq: SequentialFrames | null = null;
  let seqClip = -1;
  const closeIter = async () => {
    current = null;
    await seq?.close();
    seq = null;
  };
  const source = (clip: VideoClip): Source | null => {
    const img = images.get(clip.mediaId);
    if (img) return { el: img, w: img.width, h: img.height };
    if (decoders.has(clip.mediaId)) {
      const smp = current;
      return smp ? { w: smp.displayWidth, h: smp.displayHeight, draw: (c, x, y, w, h) => smp.draw(c, x, y, w, h) } : null;
    }
    const v = videos.get(clip.mediaId);
    return v && v.videoWidth ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  };
  try {
    for (let n = 0; n < frames; n++) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      const t = n / fps;
      const f = plan2[n];
      const t0 = performance.now();
      if (f) {
        const clip = p.clips[f.clip];
        const dec = decoders.get(clip.mediaId);
        if (dec) {
          if (seqClip !== f.clip) {
            // New clip: one sequential decoding pass from its in point.
            await closeIter();
            seqClip = f.clip;
            seq = new SequentialFrames(dec.sink, dec.first, f.src);
          }
          current = await seq!.at(f.src);
          stats.decoded++;
        } else {
          const reader = readers.get(clip.mediaId);
          if (reader) await reader.at(f.src, 1 / fps);
          stats.fallback++;
        }
      }
      stats.read += performance.now() - t0;
      const t1 = performance.now();
      drawFrame(ctx, W, H, { project: p, t, media, source });
      stats.draw += performance.now() - t1;
      const t2 = performance.now();
      const frame = new VideoFrame(canvas, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
      venc.encode(frame, { keyFrame: n % (fps * 2) === 0 });
      frame.close();
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 4));
      stats.encode += performance.now() - t2;
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
    await closeIter();
    for (const d of decoders.values()) d.input.dispose();
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

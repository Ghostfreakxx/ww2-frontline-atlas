'use client';
import { useEffect, useRef } from 'react';
import type { MediaItem, Project } from '@/lib/editor/types';
import { clipLen, clipStarts, fmtTime, MIN_CLIP_S, moveClip, trimClip, videoDuration } from '@/lib/editor/timeline';
import type { Selection, Update } from './EditorApp';

interface Props {
  project: Project;
  media: Map<string, MediaItem>;
  t: number;
  duration: number;
  zoom: number;
  setZoom: (z: number) => void;
  seek: (t: number) => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  update: Update;
}

type Drag =
  | { kind: 'scrub' }
  | { kind: 'clip-move'; id: string; x0: number; moved: boolean }
  | { kind: 'clip-trim'; id: string; edge: 'in' | 'out'; x0: number; v0: number }
  | { kind: 'text-move'; id: string; x0: number; s0: number; e0: number; moved: boolean }
  | { kind: 'text-trim'; id: string; edge: 'start' | 'end'; x0: number; v0: number }
  | { kind: 'audio-move'; id: string; x0: number; s0: number; moved: boolean }
  | { kind: 'audio-trim'; id: string; edge: 'in' | 'out'; x0: number; in0: number; out0: number; s0: number };

const HEAD = 84; // track label column

function Wave({ peaks, from, to }: { peaks: number[]; from: number; to: number }) {
  // `from`/`to` are fractions of the source shown by this item.
  const a = Math.floor(from * peaks.length);
  const b = Math.max(a + 1, Math.ceil(to * peaks.length));
  const slice = peaks.slice(a, b);
  const n = slice.length;
  const d = slice.map((v, i) => `M${(i / n) * 100},${50 - v * 46}V${50 + v * 46}`).join('');
  return (
    <svg className="wave" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <path d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Timeline({ project: p, media, t, duration, zoom, setZoom, seek, selection, setSelection, update }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const starts = clipStarts(p);
  const vEnd = videoDuration(p);
  const width = Math.max(duration + 6, 20) * zoom + HEAD;
  const pRef = useRef(p);
  pRef.current = p;

  // Keep the playhead in view while playing.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const x = HEAD + t * zoom;
    if (x < el.scrollLeft + HEAD || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - el.clientWidth / 3);
  }, [t, zoom]);

  const timeAt = (clientX: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + el.scrollLeft - HEAD) / zoom);
  };

  const snapPoints = () => {
    const q = pRef.current;
    const s = clipStarts(q);
    return [0, t, videoDuration(q), ...s, ...q.texts.flatMap((x) => [x.start, x.end]), ...q.audio.map((a) => a.start)];
  };
  const snap = (v: number, exclude: number[] = []) => {
    const th = 8 / zoom;
    let best = v;
    let bd = th;
    for (const s of snapPoints()) {
      if (exclude.some((e) => Math.abs(e - s) < 1e-6)) continue;
      const d = Math.abs(s - v);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };

  const start = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    drag.current = d;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events */
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const q = pRef.current;
    if (d.kind === 'scrub') return seek(timeAt(e.clientX));
    const dt = (e.clientX - ('x0' in d ? d.x0 : 0)) / zoom;
    if (d.kind === 'clip-move') {
      if (Math.abs(e.clientX - d.x0) < 4 && !d.moved) return;
      d.moved = true;
      // Reorder: move the clip to the slot under the pointer.
      const time = timeAt(e.clientX);
      const from = q.clips.findIndex((c) => c.id === d.id);
      // Insertion slot among the other clips: before the first clip whose midpoint is right of the pointer.
      const others = q.clips.filter((c) => c.id !== d.id);
      let acc = 0;
      let to = others.length;
      for (let i = 0; i < others.length; i++) {
        const len = clipLen(others[i]);
        if (time < acc + len / 2) {
          to = i;
          break;
        }
        acc += len;
      }
      if (to !== from) update((x) => moveClip(x, from, to), { transient: true });
    } else if (d.kind === 'clip-trim') {
      const m = media.get(q.clips.find((c) => c.id === d.id)?.mediaId ?? '');
      update((x) => trimClip(x, d.id, d.edge, d.v0 + dt, m), { transient: true });
    } else if (d.kind === 'text-move') {
      if (Math.abs(e.clientX - d.x0) < 4 && !d.moved) return;
      d.moved = true;
      const len = d.e0 - d.s0;
      let ns = Math.max(0, d.s0 + dt);
      const snapped = snap(ns, [d.s0]);
      const snappedEnd = snap(ns + len, [d.e0]);
      if (snapped !== ns) ns = snapped;
      else if (snappedEnd !== ns + len) ns = snappedEnd - len;
      update((x) => ({ ...x, texts: x.texts.map((it) => (it.id === d.id ? { ...it, start: +ns.toFixed(3), end: +(ns + len).toFixed(3) } : it)) }), { transient: true });
    } else if (d.kind === 'text-trim') {
      const v = snap(Math.max(0, d.v0 + dt), [d.v0]);
      update((x) => ({ ...x, texts: x.texts.map((it) => (it.id !== d.id ? it : d.edge === 'start' ? { ...it, start: +Math.min(v, it.end - MIN_CLIP_S).toFixed(3) } : { ...it, end: +Math.max(v, it.start + MIN_CLIP_S).toFixed(3) })) }), { transient: true });
    } else if (d.kind === 'audio-move') {
      if (Math.abs(e.clientX - d.x0) < 4 && !d.moved) return;
      d.moved = true;
      const ns = snap(Math.max(0, d.s0 + dt), [d.s0]);
      update((x) => ({ ...x, audio: x.audio.map((a) => (a.id === d.id ? { ...a, start: +ns.toFixed(3) } : a)) }), { transient: true });
    } else if (d.kind === 'audio-trim') {
      const m = media.get(q.audio.find((a) => a.id === d.id)?.mediaId ?? '');
      const max = m?.duration ?? Infinity;
      update((x) => ({
        ...x,
        audio: x.audio.map((a) => {
          if (a.id !== d.id) return a;
          if (d.edge === 'out') return { ...a, out: +Math.min(max, Math.max(d.in0 + MIN_CLIP_S, d.out0 + dt)).toFixed(3) };
          // Trimming the head moves the start with it, so the music stays in sync.
          const nin = Math.max(0, Math.min(d.out0 - MIN_CLIP_S, d.in0 + dt));
          return { ...a, in: +nin.toFixed(3), start: +Math.max(0, d.s0 + (nin - d.in0)).toFixed(3) };
        }),
      }), { transient: true });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.kind === 'scrub') return;
    if (('moved' in d && d.moved) || d.kind.endsWith('trim')) update((x) => x);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(Math.max(8, Math.min(400, zoom * Math.exp(-e.deltaY * 0.002))));
  };

  const fit = () => {
    const w = (scroller.current?.clientWidth ?? 800) - HEAD - 40;
    setZoom(Math.max(8, Math.min(400, w / Math.max(duration, 5))));
  };

  const tickStep = zoom > 120 ? 0.5 : zoom > 40 ? 1 : zoom > 15 ? 5 : 10;
  const labelEvery = zoom > 120 ? 1 : zoom > 40 ? 5 : zoom > 15 ? 10 : 30;
  const ticks: number[] = [];
  for (let s = 0; s <= duration + 6; s += tickStep) ticks.push(+s.toFixed(2));

  const sel = (k: NonNullable<Selection>['kind'], id: string) => selection?.kind === k && selection.id === id;

  return (
    <div className="tl">
      <div className="tl-bar">
        <span className="small muted">Drag clips to reorder · drag the edges to trim · S splits at the playhead</span>
        <div className="tl-zoom">
          <button className="btn tiny" onClick={() => setZoom(Math.max(8, zoom / 1.4))} aria-label="Zoom timeline out">−</button>
          <input type="range" min={8} max={400} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Timeline zoom" />
          <button className="btn tiny" onClick={() => setZoom(Math.min(400, zoom * 1.4))} aria-label="Zoom timeline in">+</button>
          <button className="btn tiny" onClick={fit}>Fit</button>
        </div>
      </div>
      <div className="tl-scroll" ref={scroller} onWheel={onWheel} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="tl-inner" style={{ width }}>
          <div className="tl-ruler" onPointerDown={(e) => { start(e, { kind: 'scrub' }); seek(timeAt(e.clientX)); }}>
            <div className="tl-head" />
            {ticks.map((s) => (
              <div key={s} className={`tl-tick ${Math.abs(s % labelEvery) < 1e-6 ? 'major' : ''}`} style={{ left: HEAD + s * zoom }}>
                {Math.abs(s % labelEvery) < 1e-6 && <span>{fmtTime(s).replace(/\.0$/, '')}</span>}
              </div>
            ))}
          </div>

          <div className="tl-track tl-text" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelection(null); seek(timeAt(e.clientX)); } }}>
            <div className="tl-label">Text</div>
            {p.texts.map((x) => (
              <div
                key={x.id}
                className={`tl-item text ${sel('text', x.id) ? 'sel' : ''}`}
                style={{ left: HEAD + x.start * zoom, width: Math.max(8, (x.end - x.start) * zoom) }}
                onPointerDown={(e) => { setSelection({ kind: 'text', id: x.id }); start(e, { kind: 'text-move', id: x.id, x0: e.clientX, s0: x.start, e0: x.end, moved: false }); }}
                title={x.text}
              >
                <span className="tl-grip l" onPointerDown={(e) => { setSelection({ kind: 'text', id: x.id }); start(e, { kind: 'text-trim', id: x.id, edge: 'start', x0: e.clientX, v0: x.start }); }} aria-hidden />
                <span className="tl-item-label">{x.text.replace(/\n/g, ' ')}</span>
                <span className="tl-grip r" onPointerDown={(e) => { setSelection({ kind: 'text', id: x.id }); start(e, { kind: 'text-trim', id: x.id, edge: 'end', x0: e.clientX, v0: x.end }); }} aria-hidden />
              </div>
            ))}
          </div>

          <div className="tl-track tl-video" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelection(null); seek(timeAt(e.clientX)); } }}>
            <div className="tl-label">Video</div>
            {p.clips.map((c, i) => {
              const m = media.get(c.mediaId);
              const len = clipLen(c);
              return (
                <div
                  key={c.id}
                  className={`tl-item clip ${sel('clip', c.id) ? 'sel' : ''} ${m ? '' : 'missing'}`}
                  style={{ left: HEAD + starts[i] * zoom, width: Math.max(6, len * zoom), backgroundImage: m?.thumb ? `url(${m.thumb})` : undefined }}
                  onPointerDown={(e) => { setSelection({ kind: 'clip', id: c.id }); start(e, { kind: 'clip-move', id: c.id, x0: e.clientX, moved: false }); }}
                  title={`${m?.name ?? 'Missing media'} · ${fmtTime(len)}`}
                >
                  {c.transition !== 'cut' && i > 0 && <span className={`tl-trans ${c.transition}`} title={`Transition: ${c.transition}`} aria-hidden />}
                  <span className="tl-grip l" onPointerDown={(e) => { setSelection({ kind: 'clip', id: c.id }); start(e, { kind: 'clip-trim', id: c.id, edge: 'in', x0: e.clientX, v0: c.in }); }} aria-hidden />
                  <span className="tl-item-label">{m?.name ?? 'Missing'}</span>
                  {m?.peaks && m.duration > 0 && c.volume > 0 && <Wave peaks={m.peaks} from={c.in / m.duration} to={c.out / m.duration} />}
                  <span className="tl-grip r" onPointerDown={(e) => { setSelection({ kind: 'clip', id: c.id }); start(e, { kind: 'clip-trim', id: c.id, edge: 'out', x0: e.clientX, v0: c.out }); }} aria-hidden />
                </div>
              );
            })}
          </div>

          <div className="tl-track tl-audio" onPointerDown={(e) => { if (e.target === e.currentTarget) { setSelection(null); seek(timeAt(e.clientX)); } }}>
            <div className="tl-label">Music</div>
            {p.audio.map((a) => {
              const m = media.get(a.mediaId);
              const len = a.out - a.in;
              const past = vEnd > 0 && a.start + len > vEnd;
              return (
                <div
                  key={a.id}
                  className={`tl-item audio ${sel('audio', a.id) ? 'sel' : ''}`}
                  style={{ left: HEAD + a.start * zoom, width: Math.max(8, len * zoom) }}
                  onPointerDown={(e) => { setSelection({ kind: 'audio', id: a.id }); start(e, { kind: 'audio-move', id: a.id, x0: e.clientX, s0: a.start, moved: false }); }}
                  title={`${m?.name ?? 'Missing'} · ${fmtTime(len)}${past ? ' · cut at the end of the video' : ''}`}
                >
                  <span className="tl-grip l" onPointerDown={(e) => { setSelection({ kind: 'audio', id: a.id }); start(e, { kind: 'audio-trim', id: a.id, edge: 'in', x0: e.clientX, in0: a.in, out0: a.out, s0: a.start }); }} aria-hidden />
                  {m?.peaks && m.duration > 0 && <Wave peaks={m.peaks} from={a.in / m.duration} to={a.out / m.duration} />}
                  <span className="tl-item-label">♪ {m?.name ?? 'Missing'}</span>
                  {past && <span className="tl-past" style={{ left: (vEnd - a.start) * zoom }} aria-hidden />}
                  <span className="tl-grip r" onPointerDown={(e) => { setSelection({ kind: 'audio', id: a.id }); start(e, { kind: 'audio-trim', id: a.id, edge: 'out', x0: e.clientX, in0: a.in, out0: a.out, s0: a.start }); }} aria-hidden />
                </div>
              );
            })}
          </div>

          <div className="tl-playhead" style={{ left: HEAD + t * zoom }} aria-hidden />
        </div>
      </div>
    </div>
  );
}

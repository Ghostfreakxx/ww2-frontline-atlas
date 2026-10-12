'use client';
import { useRef } from 'react';
import type { MediaItem, Project, TextAnim, TextStyle, Transition } from '@/lib/editor/types';
import { clipLen, clipStarts, fmtTime, makeText, parseSrt, TEXT_PRESETS, uid, updateAudio, updateClip, updateText } from '@/lib/editor/timeline';
import type { Selection, Update } from './EditorApp';

interface Props {
  project: Project;
  media: Map<string, MediaItem>;
  selection: Selection;
  setSelection: (s: Selection) => void;
  update: Update;
  t: number;
  seek: (t: number) => void;
  onSplit: () => void;
  onDelete: () => void;
  onAddText: (style?: TextStyle) => void;
  flash: (m: string) => void;
}

const TEXT_COLORS = ['#ffffff', '#111111', '#e6f53a', '#ff3b30', '#3fd0ff', '#d8a64a'];

function Slider({ label, value, min, max, step, onChange, onCommit, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; onCommit: () => void; fmt?: (v: number) => string }) {
  return (
    <label className="ins-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
      <output>{fmt ? fmt(value) : value}</output>
    </label>
  );
}

function Num({ label, value, onChange, step = 0.1, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  return (
    <label className="ins-num">
      <span>{label}</span>
      <input type="number" step={step} min={min} value={+value.toFixed(2)} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)} />
    </label>
  );
}

export function Inspector({ project: p, media, selection, setSelection, update, t, seek, onSplit, onDelete, onAddText, flash }: Props) {
  const srt = useRef<HTMLInputElement>(null);
  const live = (fn: (p: Project) => Project) => update(fn, { transient: true });
  const commit = () => update((x) => x);

  if (selection?.kind === 'clip') {
    const i = p.clips.findIndex((c) => c.id === selection.id);
    const c = p.clips[i];
    if (!c) return null;
    const m = media.get(c.mediaId);
    const start = clipStarts(p)[i];
    return (
      <div className="ins">
        <h2>Clip {i + 1}</h2>
        <p className="muted small">{m?.name ?? 'Missing media'} · {fmtTime(clipLen(c))} · starts {fmtTime(start)}</p>
        <div className="ins-row">
          <button className="btn" onClick={() => seek(start)}>Go to clip</button>
          <button className="btn" onClick={onSplit}>Split at playhead</button>
          <button className="btn" onClick={() => {
            const copy = { ...c, id: uid('c') };
            update((x) => ({ ...x, clips: [...x.clips.slice(0, i + 1), copy, ...x.clips.slice(i + 1)] }));
            setSelection({ kind: 'clip', id: copy.id });
          }}>Duplicate</button>
        </div>
        <h3>Framing</h3>
        <div className="seg" role="group" aria-label="Framing">
          <button aria-pressed={c.fit === 'fill'} onClick={() => update((x) => updateClip(x, c.id, { fit: 'fill' }))}>Fill frame</button>
          <button aria-pressed={c.fit === 'fit'} onClick={() => update((x) => updateClip(x, c.id, { fit: 'fit' }))}>Fit (blurred bars)</button>
        </div>
        <Slider label="Zoom" value={c.zoom} min={0.5} max={4} step={0.01} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => live((x) => updateClip(x, c.id, { zoom: v }))} onCommit={commit} />
        <Slider label="Left / right" value={c.x} min={-0.6} max={0.6} step={0.005} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => live((x) => updateClip(x, c.id, { x: v }))} onCommit={commit} />
        <Slider label="Up / down" value={c.y} min={-0.6} max={0.6} step={0.005} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => live((x) => updateClip(x, c.id, { y: v }))} onCommit={commit} />
        <div className="ins-row">
          <button className="btn tiny" onClick={() => update((x) => updateClip(x, c.id, { zoom: 1, x: 0, y: 0 }))}>Reset framing</button>
          <span className="muted small">Tip: drag the picture in the preview, pinch to zoom.</span>
        </div>
        <h3>Timing</h3>
        <div className="ins-grid">
          {m?.kind === 'image' ? (
            <Num label="Show for (s)" value={c.out} min={0.2} onChange={(v) => update((x) => updateClip(x, c.id, { out: Math.max(0.2, v) }))} />
          ) : (
            <>
              <Num label="Source in (s)" value={c.in} onChange={(v) => update((x) => updateClip(x, c.id, { in: Math.max(0, Math.min(v, c.out - 0.2)) }))} />
              <Num label="Source out (s)" value={c.out} onChange={(v) => update((x) => updateClip(x, c.id, { out: Math.min(m?.duration ?? v, Math.max(v, c.in + 0.2)) }))} />
            </>
          )}
        </div>
        {m?.kind === 'video' && (
          <>
            <h3>Sound</h3>
            <Slider label="Clip volume" value={c.volume} min={0} max={1.5} step={0.01} fmt={(v) => (v === 0 ? 'Muted' : `${Math.round(v * 100)}%`)} onChange={(v) => live((x) => updateClip(x, c.id, { volume: v }))} onCommit={commit} />
            {!m.hasAudio && <p className="muted small">This clip has no sound.</p>}
          </>
        )}
        {i > 0 && (
          <>
            <h3>Transition into this clip</h3>
            <div className="seg" role="group" aria-label="Transition">
              {(['cut', 'dip', 'flash'] as Transition[]).map((tr) => (
                <button key={tr} aria-pressed={c.transition === tr} onClick={() => update((x) => updateClip(x, c.id, { transition: tr }))}>{tr === 'cut' ? 'Cut' : tr === 'dip' ? 'Dip to black' : 'Flash white'}</button>
              ))}
            </div>
          </>
        )}
        <button className="btn danger" onClick={onDelete}>Delete clip</button>
      </div>
    );
  }

  if (selection?.kind === 'text') {
    const x = p.texts.find((it) => it.id === selection.id);
    if (!x) return null;
    return (
      <div className="ins">
        <h2>Text</h2>
        <textarea aria-label="Text" rows={3} value={x.text} onChange={(e) => live((q) => updateText(q, x.id, { text: e.target.value }))} onBlur={commit} />
        <h3>Style</h3>
        <div className="ins-styles">
          {(Object.keys(TEXT_PRESETS) as TextStyle[]).map((s) => (
            <button key={s} className={`style-chip s-${s} ${x.style === s ? 'on' : ''}`} onClick={() => update((q) => updateText(q, x.id, { style: s, color: TEXT_PRESETS[s].color, size: TEXT_PRESETS[s].size }))}>{TEXT_PRESETS[s].label}</button>
          ))}
        </div>
        <Slider label="Size" value={x.size} min={24} max={180} step={1} onChange={(v) => live((q) => updateText(q, x.id, { size: v }))} onCommit={commit} />
        <div className="ins-colors" role="radiogroup" aria-label="Text colour">
          {TEXT_COLORS.map((col) => (
            <button key={col} role="radio" aria-checked={x.color === col} className={`swatch ${x.color === col ? 'on' : ''}`} style={{ background: col }} onClick={() => update((q) => updateText(q, x.id, { color: col }))} aria-label={`Colour ${col}`} />
          ))}
          <input type="color" aria-label="Custom colour" value={x.color} onChange={(e) => live((q) => updateText(q, x.id, { color: e.target.value }))} onBlur={commit} />
        </div>
        <h3>Animation</h3>
        <div className="seg" role="group" aria-label="Animation">
          {(['none', 'pop', 'fade', 'rise'] as TextAnim[]).map((a) => (
            <button key={a} aria-pressed={x.anim === a} onClick={() => update((q) => updateText(q, x.id, { anim: a }))}>{a === 'none' ? 'None' : a[0].toUpperCase() + a.slice(1)}</button>
          ))}
        </div>
        <h3>Timing</h3>
        <div className="ins-grid">
          <Num label="Start (s)" value={x.start} onChange={(v) => update((q) => updateText(q, x.id, { start: Math.min(v, x.end - 0.2) }))} />
          <Num label="End (s)" value={x.end} onChange={(v) => update((q) => updateText(q, x.id, { end: Math.max(v, x.start + 0.2) }))} />
        </div>
        <div className="ins-row">
          <button className="btn tiny" onClick={() => update((q) => updateText(q, x.id, { start: t, end: t + (x.end - x.start) }))}>Start at playhead</button>
          <button className="btn tiny" onClick={() => update((q) => updateText(q, x.id, { end: Math.max(t, x.start + 0.2) }))}>End at playhead</button>
          <button className="btn tiny" onClick={() => update((q) => updateText(q, x.id, { x: 0.5 }))}>Centre</button>
        </div>
        <div className="ins-row">
          <button className="btn" onClick={() => {
            const copy = { ...x, id: uid('t'), start: x.end, end: x.end + (x.end - x.start) };
            update((q) => ({ ...q, texts: [...q.texts, copy] }));
            setSelection({ kind: 'text', id: copy.id });
          }}>Next caption</button>
          <button className="btn danger" onClick={onDelete}>Delete text</button>
        </div>
      </div>
    );
  }

  if (selection?.kind === 'audio') {
    const a = p.audio.find((it) => it.id === selection.id);
    if (!a) return null;
    const m = media.get(a.mediaId);
    return (
      <div className="ins">
        <h2>Music</h2>
        <p className="muted small">{m?.name ?? 'Missing media'} · {fmtTime(a.out - a.in)}</p>
        <Slider label="Volume" value={a.volume} min={0} max={1.5} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => live((q) => updateAudio(q, a.id, { volume: v }))} onCommit={commit} />
        <Slider label="Fade in" value={a.fadeIn} min={0} max={5} step={0.1} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v) => live((q) => updateAudio(q, a.id, { fadeIn: v }))} onCommit={commit} />
        <Slider label="Fade out" value={a.fadeOut} min={0} max={8} step={0.1} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v) => live((q) => updateAudio(q, a.id, { fadeOut: v }))} onCommit={commit} />
        <div className="ins-grid">
          <Num label="Starts at (s)" value={a.start} onChange={(v) => update((q) => updateAudio(q, a.id, { start: Math.max(0, v) }))} />
          <Num label="From song time (s)" value={a.in} onChange={(v) => update((q) => updateAudio(q, a.id, { in: Math.max(0, Math.min(v, a.out - 0.2)) }))} />
        </div>
        <p className="muted small">Music stops with fades at the end of the video. Lower clip volumes (or mute clips) so your voice and the music don&apos;t compete.</p>
        <button className="btn" onClick={() => update((q) => ({ ...q, clips: q.clips.map((c) => ({ ...c, volume: 0 })) }))}>Mute all clips</button>
        <button className="btn danger" onClick={onDelete}>Remove music</button>
      </div>
    );
  }

  return (
    <div className="ins">
      <h2>Project</h2>
      <p className="muted small">Select a clip, a text or the music on the timeline (or in the preview) to edit it.</p>
      <h3>Add text</h3>
      <div className="ins-styles">
        {(Object.keys(TEXT_PRESETS) as TextStyle[]).map((s) => (
          <button key={s} className={`style-chip s-${s}`} onClick={() => onAddText(s)}>{TEXT_PRESETS[s].label}</button>
        ))}
      </div>
      <h3>Subtitles</h3>
      <p className="muted small">Import an .srt file (e.g. from a transcription app) to add timed captions.</p>
      <button className="btn" onClick={() => srt.current?.click()}>Import .srt</button>
      <input ref={srt} type="file" accept=".srt,text/plain" hidden aria-label="Import subtitles" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        const items = parseSrt(await f.text());
        if (!items.length) return flash('No subtitles found in that file');
        update((q) => ({ ...q, texts: [...q.texts, ...items] }));
        flash(`Added ${items.length} subtitles`);
      }} />
      <button className="btn ghost" onClick={() => {
        const item = makeText(t, 'title', p.name);
        update((q) => ({ ...q, texts: [...q.texts, { ...item, start: 0, end: 2.5 }] }));
        setSelection({ kind: 'text', id: item.id });
      }}>Add a title card at the start</button>
      <h3>Frame</h3>
      <label className="ins-num">
        <span>Background</span>
        <input type="color" value={p.background} onChange={(e) => update((q) => ({ ...q, background: e.target.value }))} aria-label="Background colour" />
      </label>
      <div className="seg" role="group" aria-label="Frame rate">
        {[30, 60].map((f) => <button key={f} aria-pressed={p.fps === f} onClick={() => update((q) => ({ ...q, fps: f }))}>{f} fps</button>)}
      </div>
      <h3>Shortcuts</h3>
      <ul className="ins-keys small muted">
        <li><kbd>Space</kbd> play / pause</li>
        <li><kbd>S</kbd> split · <kbd>T</kbd> add text · <kbd>⌫</kbd> delete</li>
        <li><kbd>←</kbd>/<kbd>→</kbd> one frame · with <kbd>⇧</kbd> one second</li>
        <li><kbd>⌘Z</kbd> undo · <kbd>⇧⌘Z</kbd> redo · <kbd>Ctrl</kbd>+scroll zooms</li>
      </ul>
    </div>
  );
}

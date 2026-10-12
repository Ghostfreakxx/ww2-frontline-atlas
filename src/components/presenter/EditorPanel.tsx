'use client';
import { useRef, useState } from 'react';
import type { Episode, Scene, ScenePatch } from '@/lib/episodes/types';
import type { PresentationState } from '@/lib/sync/state';
import { sources as allSources } from '@/data/conflicts/ww2-europe/sources';
import { formatDate } from '@/lib/history/query';
import { exportEpisode, importEpisodeFile } from './useEpisodes';
import { Icon } from './icons';

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

/** Snapshot of everything a scene/step needs to reproduce the current audience view. */
export function captureView(s: PresentationState): ScenePatch & { date: string; camera: { lon: number; lat: number; zoom: number; ms: number } } {
  return {
    date: s.date,
    camera: { lon: +s.camera.lon.toFixed(4), lat: +s.camera.lat.toFixed(4), zoom: +s.camera.zoom.toFixed(3), ms: 1800 },
    layout: s.layout,
    focus: { ...s.focus },
    layers: { ...s.layers },
    panels: { ...s.panels },
    hierarchy: { ...s.hierarchy },
    caption: s.caption ? { ...s.caption } : null,
    annotations: s.annotations,
  };
}

interface Props {
  library: { episodes: Episode[]; save: (e: Episode) => void; remove: (id: string) => void; isBuiltIn: (id: string) => boolean; isModified: (id: string) => boolean; savedAt: number | null };
  episode: Episode | null;
  state: PresentationState;
  onLoadEpisode: (id: string, ep?: Episode) => void;
  onGoto: (scene: number, step: number) => void;
  saveToServer: (e: Episode) => Promise<string>;
  locked: boolean;
}

export function EditorPanel({ library, episode, state, onLoadEpisode, onGoto, saveToServer, locked }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editScene, setEditScene] = useState<number>(state.sceneIndex);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3500);
  };
  const update = (fn: (e: Episode) => Episode) => episode && library.save(fn(structuredClone(episode)));
  const scene = episode?.scenes[editScene];
  const updateScene = (fn: (s: Scene) => Scene) => update((e) => ({ ...e, scenes: e.scenes.map((s, i) => (i === editScene ? fn(s) : s)) }));

  const newEpisode = () => {
    const ep: Episode = {
      schema: 1,
      id: uid('episode'),
      title: 'New episode',
      description: '',
      conflictId: 'ww2-europe',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenes: [{ id: uid('scene'), title: 'Opening', notes: '', sources: [], base: captureView(state), steps: [] }],
    };
    library.save(ep);
    onLoadEpisode(ep.id, ep);
  };

  return (
    <div className="side-scroll editor">
      <section className="list-section">
        <h3 className="label">Episode</h3>
        <select value={episode?.id ?? ''} onChange={(e) => e.target.value && onLoadEpisode(e.target.value)} disabled={locked}>
          <option value="" disabled>Choose an episode…</option>
          {library.episodes.map((e) => (
            <option key={e.id} value={e.id}>{e.title}{library.isModified(e.id) ? ' (edited)' : ''}</option>
          ))}
        </select>
        <div className="button-row">
          <button className="btn" onClick={newEpisode} disabled={locked}><Icon.plus /> New</button>
          {episode && <button className="btn" disabled={locked} onClick={() => { const copy = { ...structuredClone(episode), id: uid(episode.id.slice(0, 40)), title: `${episode.title} (copy)` }; library.save(copy); onLoadEpisode(copy.id, copy); }}>Duplicate</button>}
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={locked}><Icon.upload /> Import</button>
          {episode && <button className="btn" onClick={() => exportEpisode(episode)}><Icon.download /> Export</button>}
          {episode && (
            <button className="btn" disabled={locked} onClick={async () => flash(await saveToServer(episode))}>Save to computer</button>
          )}
          {episode && library.isModified(episode.id) && <button className="btn danger" disabled={locked} onClick={() => confirm('Discard your edits and restore the built-in episode?') && library.remove(episode.id)}>Reset to built-in</button>}
          {episode && !library.isBuiltIn(episode.id) && <button className="btn danger" disabled={locked} onClick={() => confirm(`Delete “${episode.title}” from this iPad?`) && library.remove(episode.id)}>Delete</button>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const ep = await importEpisodeFile(f);
              library.save(ep);
              onLoadEpisode(ep.id, ep);
              flash(`Imported “${ep.title}”`);
            } catch (err) {
              flash((err as Error).message);
            }
          }}
        />
        <p className="muted small">{library.savedAt ? `Autosaved on this device ${new Date(library.savedAt).toLocaleTimeString()}` : 'Edits autosave on this device.'} Export to keep a file; “Save to computer” writes to the presenting computer.</p>
        {msg && <p className="notice" role="status">{msg}</p>}
      </section>

      {episode && (
        <>
          <section className="list-section">
            <label className="label" htmlFor="ep-title">Title</label>
            <input id="ep-title" type="text" value={episode.title} disabled={locked} onChange={(e) => update((ep) => ({ ...ep, title: e.target.value }))} />
            <label className="label" htmlFor="ep-desc" style={{ marginTop: 10, display: 'block' }}>Description</label>
            <textarea id="ep-desc" rows={2} value={episode.description} disabled={locked} onChange={(e) => update((ep) => ({ ...ep, description: e.target.value }))} />
          </section>

          <section className="list-section">
            <div className="row-between">
              <h3 className="label">Scenes ({episode.scenes.length})</h3>
              <button className="btn" disabled={locked} onClick={() => {
                update((e) => ({ ...e, scenes: [...e.scenes.slice(0, editScene + 1), { id: uid('scene'), title: 'New scene', notes: '', sources: [], base: captureView(state), steps: [] }, ...e.scenes.slice(editScene + 1)] }));
                setEditScene(editScene + 1);
              }}><Icon.camera /> Add scene from current view</button>
            </div>
            <ol className="scene-list editable">
              {episode.scenes.map((s, i) => (
                <li key={s.id} className={i === editScene ? 'current' : ''}>
                  <button className="scene-item" onClick={() => setEditScene(i)}>
                    <span className="scene-num">{i + 1}</span>
                    <span className="scene-title">{s.title}</span>
                    <span className="muted small">{formatDate(s.base.date, 'short')}</span>
                  </button>
                  <div className="row-tools">
                    <button className="btn icon ghost" aria-label="Move up" disabled={locked || i === 0} onClick={() => { update((e) => { const sc = [...e.scenes]; [sc[i - 1], sc[i]] = [sc[i], sc[i - 1]]; return { ...e, scenes: sc }; }); setEditScene(i - 1); }}><Icon.up /></button>
                    <button className="btn icon ghost" aria-label="Move down" disabled={locked || i === episode.scenes.length - 1} onClick={() => { update((e) => { const sc = [...e.scenes]; [sc[i + 1], sc[i]] = [sc[i], sc[i + 1]]; return { ...e, scenes: sc }; }); setEditScene(i + 1); }}><Icon.down /></button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {scene && (
            <section className="list-section scene-editor">
              <div className="row-between">
                <h3 className="label">Edit scene {editScene + 1}</h3>
                <button className="btn" onClick={() => onGoto(editScene, 0)}>Preview</button>
              </div>
              <label className="label" htmlFor="sc-title">Scene title</label>
              <input id="sc-title" type="text" value={scene.title} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, title: e.target.value }))} />
              <div className="two-col">
                <div>
                  <label className="label" htmlFor="sc-date">Date</label>
                  <input id="sc-date" type="date" value={scene.base.date} disabled={locked} onChange={(e) => e.target.value && updateScene((s) => ({ ...s, base: { ...s.base, date: e.target.value } }))} />
                </div>
                <div>
                  <span className="label">View</span>
                  <button className="btn" disabled={locked} onClick={() => updateScene((s) => ({ ...s, base: captureView(state) }))}><Icon.camera /> Use current view</button>
                </div>
              </div>
              <p className="muted small">The scene opening stores date, camera, layout, highlighted formations, battle, cities, layers, panels, caption and drawings.</p>
              <label className="label" htmlFor="sc-cap">Caption</label>
              <input id="sc-cap" type="text" placeholder="Title" value={scene.base.caption?.title ?? ''} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, base: { ...s.base, caption: { title: e.target.value, subtitle: s.base.caption?.subtitle ?? '' } } }))} />
              <input type="text" placeholder="Subtitle" style={{ marginTop: 6 }} value={scene.base.caption?.subtitle ?? ''} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, base: { ...s.base, caption: { title: s.base.caption?.title ?? '', subtitle: e.target.value } } }))} />
              <label className="label" htmlFor="sc-notes" style={{ marginTop: 10, display: 'block' }}>Presenter notes</label>
              <textarea id="sc-notes" rows={6} value={scene.notes} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, notes: e.target.value }))} />
              <span className="label" style={{ marginTop: 10, display: 'block' }}>Historical sources</span>
              <div className="chip-list">
                {scene.sources.map((r) => (
                  <button key={r.id} className="chip" disabled={locked} onClick={() => updateScene((s) => ({ ...s, sources: s.sources.filter((x) => x.id !== r.id) }))} title="Remove">
                    {allSources.find((x) => x.id === r.id)?.author.split(/[,&]/)[0] ?? r.id} ✕
                  </button>
                ))}
              </div>
              <select value="" disabled={locked} onChange={(e) => e.target.value && updateScene((s) => ({ ...s, sources: [...s.sources, { id: e.target.value }] }))}>
                <option value="">Add a source…</option>
                {allSources.filter((x) => !scene.sources.some((r) => r.id === x.id)).map((x) => (
                  <option key={x.id} value={x.id}>{x.author} — {x.title.slice(0, 60)}</option>
                ))}
              </select>

              <div className="row-between" style={{ marginTop: 14 }}>
                <h3 className="label">Build steps ({scene.steps.length})</h3>
                <button className="btn" disabled={locked} onClick={() => updateScene((s) => ({ ...s, steps: [...s.steps, { id: uid('step'), label: `Step ${s.steps.length + 1}`, patch: captureView(state) }] }))}><Icon.camera /> Add step from current view</button>
              </div>
              <ol className="steps-edit">
                {scene.steps.map((st, j) => (
                  <li key={st.id}>
                    <input type="text" value={st.label} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, steps: s.steps.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) }))} />
                    <div className="row-tools">
                      <button className="btn ghost" onClick={() => onGoto(editScene, j + 1)}>Preview</button>
                      <button className="btn ghost" disabled={locked} onClick={() => updateScene((s) => ({ ...s, steps: s.steps.map((x, k) => (k === j ? { ...x, patch: captureView(state) } : x)) }))}>Use current view</button>
                      <label className="toggle small">
                        <input type="checkbox" checked={!!st.patch.playTo} disabled={locked} onChange={(e) => updateScene((s) => ({ ...s, steps: s.steps.map((x, k) => (k === j ? { ...x, patch: { ...x.patch, playTo: e.target.checked ? { date: x.patch.date ?? s.base.date, speed: 7 } : undefined } } : x)) }))} />
                        <span>Animate timeline</span>
                      </label>
                      {st.patch.playTo && (
                        <input type="date" value={st.patch.playTo.date} disabled={locked} onChange={(e) => e.target.value && updateScene((s) => ({ ...s, steps: s.steps.map((x, k) => (k === j ? { ...x, patch: { ...x.patch, playTo: { ...x.patch.playTo!, date: e.target.value } } } : x)) }))} />
                      )}
                      <button className="btn icon ghost" aria-label="Delete step" disabled={locked} onClick={() => updateScene((s) => ({ ...s, steps: s.steps.filter((_, k) => k !== j) }))}><Icon.trash /></button>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="button-row" style={{ marginTop: 14 }}>
                <button className="btn" disabled={locked} onClick={() => { update((e) => ({ ...e, scenes: [...e.scenes.slice(0, editScene + 1), { ...structuredClone(scene), id: uid('scene'), title: `${scene.title} (copy)` }, ...e.scenes.slice(editScene + 1)] })); setEditScene(editScene + 1); }}>Duplicate scene</button>
                <button className="btn danger" disabled={locked || episode.scenes.length <= 1} onClick={() => { if (!confirm(`Delete scene “${scene.title}”?`)) return; update((e) => ({ ...e, scenes: e.scenes.filter((_, i) => i !== editScene) })); setEditScene(Math.max(0, editScene - 1)); }}>Delete scene</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

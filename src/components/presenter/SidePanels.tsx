'use client';
import { useMemo, useState } from 'react';
import { idx } from '@/lib/conflict';
import { daysBetween, formatDate, formatRange } from '@/lib/history/query';
import type { ISODate } from '@/lib/history/types';
import type { Episode } from '@/lib/episodes/types';
import { LAYOUTS, type Layers, type Layout, type Panels, type PresentationState } from '@/lib/sync/state';
import { sources as allSources, sourceById } from '@/data/conflicts/ww2-europe/sources';
import { stageSourceText } from '@/components/display/DisplayStage';
import { Cite } from './ForcesPanel';

type Commit = (u: (s: PresentationState) => PresentationState) => void;

// ---------------------------------------------------------------------------
export function ScenePanel({ episode, state, onGoto, locked }: { episode: Episode | null; state: PresentationState; onGoto: (scene: number, step: number) => void; locked: boolean }) {
  if (!episode) return <div className="side-scroll"><p className="hint">No episode loaded. Choose one in the Episode tab.</p></div>;
  const scene = episode.scenes[state.sceneIndex];
  return (
    <div className="side-scroll">
      <section className="list-section">
        <h3 className="label">Scenes · {episode.title}</h3>
        <ol className="scene-list">
          {episode.scenes.map((s, i) => (
            <li key={s.id}>
              <button className={`scene-item ${i === state.sceneIndex && state.sceneId === s.id ? 'current' : ''}`} disabled={locked && i !== state.sceneIndex} onClick={() => onGoto(i, 0)}>
                <span className="scene-num">{i + 1}</span>
                <span className="scene-title">{s.title}</span>
                <span className="muted small">{formatDate(s.base.date, 'short')}</span>
              </button>
              {i === state.sceneIndex && state.sceneId === s.id && s.steps.length > 0 && (
                <ol className="step-list">
                  <li><button className={`step-item ${state.stepIndex === 0 ? 'current' : ''}`} onClick={() => onGoto(i, 0)}>Scene opening</button></li>
                  {s.steps.map((st, j) => (
                    <li key={st.id}>
                      <button className={`step-item ${state.stepIndex === j + 1 ? 'current' : state.stepIndex > j + 1 ? 'done' : ''}`} onClick={() => onGoto(i, j + 1)}>
                        {st.label}
                        {st.cue && <span className="muted small"> — {st.cue}</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      </section>
      {scene && (
        <section className="list-section">
          <h3 className="label">Presenter notes <span className="muted small">(never shown to the audience)</span></h3>
          <div className="notes">{scene.notes.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
          <h3 className="label">Scene sources</h3>
          <Cite ids={scene.sources.map((s) => s.id)} long />
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BattlesPanel({ date, state, commit, locked, flyTo }: { date: ISODate; state: PresentationState; commit: Commit; locked: boolean; flyTo: (lon: number, lat: number, zoom: number) => void }) {
  const [scope, setScope] = useState<'near' | 'all'>('near');
  const battles = idx.pkg.battles
    .filter((b) => scope === 'all' || Math.abs(daysBetween(b.start, date)) < 120 || (b.start <= date && b.end >= date))
    .sort((a, b) => a.start.localeCompare(b.start));
  const ops = idx.pkg.operations.filter((o) => o.major).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="side-scroll">
      <section className="list-section">
        <div className="row-between">
          <h3 className="label">Battles</h3>
          <div className="seg">
            <button aria-pressed={scope === 'near'} onClick={() => setScope('near')}>Near date</button>
            <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All</button>
          </div>
        </div>
        {battles.map((b) => {
          const on = state.focus.battleId === b.id;
          return (
            <button
              key={b.id}
              className={`battle-row ${on ? 'on' : ''}`}
              disabled={locked}
              onClick={() => {
                commit((s) => ({
                  ...s,
                  focus: { ...s.focus, battleId: on ? null : b.id },
                  date: on ? s.date : b.start <= s.date && s.date <= b.end ? s.date : b.end,
                  layers: { ...s.layers, battles: true },
                  playback: { ...s.playback, playing: false },
                }));
                if (!on && b.camera) flyTo(b.camera.lon, b.camera.lat, b.camera.zoom);
              }}
            >
              <span className="battle-name">{b.name}</span>
              <span className="muted small">{formatRange(b.start, b.end)} · {b.result}</span>
            </button>
          );
        })}
      </section>
      <section className="list-section">
        <h3 className="label">Major campaigns 1939–1945</h3>
        {ops.map((o) => (
          <button
            key={o.id}
            className={`battle-row ${state.focus.operationId === o.id ? 'on' : ''}`}
            disabled={locked}
            onClick={() => {
              commit((s) => ({ ...s, date: o.start, focus: { ...s.focus, operationId: o.id, battleId: null }, playback: { ...s.playback, playing: false }, caption: { title: o.name, subtitle: formatRange(o.start, o.end) } }));
              flyTo(o.camera.lon, o.camera.lat, o.camera.zoom);
            }}
          >
            <span className="battle-name">{o.name}</span>
            <span className="muted small">{formatRange(o.start, o.end)}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
const LAYER_LABELS: [keyof Layers, string][] = [
  ['front', 'Front line'], ['uncertainty', 'Uncertainty band'], ['prevFront', 'Previous front'], ['held', 'Axis-held area'],
  ['arrows', 'Campaign arrows'], ['battles', 'Battles'], ['sectors', 'Army group sectors'], ['opposing', 'Opposing forces'],
  ['objectives', 'Planned objectives'], ['territory', 'Political borders'], ['borders', 'Border lines'], ['cities', 'Cities'],
  ['physical', 'Physical labels'], ['rivers', 'Rivers'], ['relief', 'Terrain relief'],
];
const PANEL_LABELS: [keyof Panels, string][] = [
  ['title', 'Title'], ['date', 'Date'], ['event', 'Event caption'], ['commander', 'Commander card'], ['portrait', 'Portrait'],
  ['hierarchy', 'Unit hierarchy'], ['compare', 'Comparison'], ['legend', 'Legend'], ['sources', 'Sources & uncertainty'],
];

export function LayersPanel({ state, commit, locked }: { state: PresentationState; commit: Commit; locked: boolean }) {
  const set = (u: (s: PresentationState) => PresentationState) => !locked && commit(u);
  return (
    <div className="side-scroll">
      <section className="list-section">
        <h3 className="label">Output layout (1920 × 1080)</h3>
        <div className="layout-grid">
          {(Object.keys(LAYOUTS) as Layout[]).map((l) => (
            <button key={l} className={`layout-card ${state.layout === l ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, layout: l }))}>
              <LayoutThumb layout={l} />
              <span>{LAYOUTS[l].label}</span>
              <span className="muted small">{LAYOUTS[l].description}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="list-section">
        <h3 className="label">Map layers</h3>
        <div className="toggle-grid">
          {LAYER_LABELS.map(([k, label]) => (
            <label key={k} className="toggle">
              <input type="checkbox" checked={state.layers[k]} disabled={locked} onChange={(e) => set((s) => ({ ...s, layers: { ...s.layers, [k]: e.target.checked } }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="list-section">
        <h3 className="label">Audience panels</h3>
        <div className="toggle-grid">
          {PANEL_LABELS.map(([k, label]) => (
            <label key={k} className="toggle">
              <input type="checkbox" checked={state.panels[k]} disabled={locked} onChange={(e) => set((s) => ({ ...s, panels: { ...s.panels, [k]: e.target.checked } }))} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="list-section">
        <h3 className="label">Caption</h3>
        <input type="text" placeholder="Title" value={state.caption?.title ?? ''} disabled={locked} onChange={(e) => set((s) => ({ ...s, caption: { title: e.target.value, subtitle: s.caption?.subtitle ?? '' } }))} />
        <input type="text" placeholder="Subtitle" style={{ marginTop: 8 }} value={state.caption?.subtitle ?? ''} disabled={locked} onChange={(e) => set((s) => ({ ...s, caption: { title: s.caption?.title ?? '', subtitle: e.target.value } }))} />
        <button className="btn ghost" style={{ marginTop: 8 }} disabled={locked} onClick={() => set((s) => ({ ...s, caption: null }))}>Remove caption</button>
      </section>
    </div>
  );
}

function LayoutThumb({ layout }: { layout: Layout }) {
  const L = LAYOUTS[layout];
  return (
    <svg viewBox="0 0 192 108" width={96} height={54} aria-hidden>
      <rect width={192} height={108} fill="#111" rx={4} />
      {L.camera && <rect x={L.camera.x / 10} y={0} width={L.camera.w / 10} height={108} fill="#333" />}
      <rect x={L.map.x / 10} y={0} width={L.map.w / 10} height={108} fill="#cbbf9f" />
      {layout === 'map-safe' && <rect x={9.6} y={5.4} width={172.8} height={97.2} fill="none" stroke="#2a9d8f" strokeDasharray="3 3" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
export function SourcesPanel({ state, date }: { state: PresentationState; date: ISODate }) {
  const [q, setQ] = useState('');
  const front = idx.frontsAt(date)[0];
  const arrows = state.layers.arrows ? idx.arrowsAt(date, { windowDays: 60 }) : [];
  const battles = idx.battlesAt(date);
  const list = useMemo(() => allSources.filter((s) => !q || `${s.author} ${s.title} ${s.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <div className="side-scroll">
      <section className="list-section">
        <h3 className="label">On screen now</h3>
        <p className="small">{stageSourceText(idx, state, date)}</p>
        {front && (
          <div className="claim">
            <div className="row-between"><strong>{front.label}</strong><span className={`chip ${front.confidence}`}>{front.confidence}</span></div>
            <p className="small muted">{front.description}</p>
            <p className="small">Uncertainty ±{front.uncertaintyKm} km · {front.verification === 'page-verified' ? 'page-verified' : 'reference-level citations'}</p>
            <Cite ids={front.sources.map((s) => s.id)} />
            {front.segments.length > 0 && (
              <details>
                <summary className="small">Anchor places ({front.segments.reduce((n, s) => n + s.points.filter((p) => p.q === 'a').length, 0)} documented)</summary>
                <ul className="anchors">
                  {front.segments.flatMap((s) => s.points).filter((p) => p.place).map((p, i) => (
                    <li key={i} className="small"><span className={`chip ${p.q === 'a' ? 'documented' : p.q === 'b' ? 'approximate' : 'uncertain'}`}>{p.q === 'a' ? 'anchor' : p.q === 'b' ? 'interpolated' : 'gap'}</span> {p.place}{p.note ? ` — ${p.note}` : ''}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {battles.map(({ battle }) => (
          <div className="claim" key={battle.id}>
            <div className="row-between"><strong>{battle.name}</strong><span className={`chip ${battle.confidence}`}>{battle.confidence}</span></div>
            <p className="small muted">{formatRange(battle.start, battle.end)} — {battle.summary}</p>
            <Cite ids={battle.sources.map((s) => s.id)} />
          </div>
        ))}
        {arrows.slice(0, 12).map(({ arrow }) => (
          <div className="claim" key={arrow.id}>
            <div className="row-between"><strong className="small">{arrow.label}</strong><span className="chip schematic">schematic</span></div>
            <p className="small muted">{formatRange(arrow.start, arrow.end)}</p>
            <Cite ids={arrow.sources.map((s) => s.id)} />
          </div>
        ))}
      </section>
      <section className="list-section">
        <h3 className="label">Source registry ({allSources.length})</h3>
        <input type="search" placeholder="Search sources" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="registry">
          {list.map((s) => (
            <li key={s.id}>
              <div><strong>{s.author}</strong>{s.year ? ` (${s.year})` : ''}. <em>{s.title}</em>{s.publisher ? `. ${s.publisher}` : ''}.</div>
              <div className="small muted">{s.kind}{s.license ? ` · ${s.license}` : ''}{s.notes ? ` · ${s.notes}` : ''}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export { sourceById };

'use client';
import { useState } from 'react';
import { idx } from '@/lib/conflict';
import { formatDate, formatRange } from '@/lib/history/query';
import type { Formation, ISODate } from '@/lib/history/types';
import { sourceById } from '@/data/conflicts/ww2-europe/sources';
import { formationColor } from '@/components/map/AtlasMap';
import type { PresentationState } from '@/lib/sync/state';
import { hierarchyRows } from '@/components/panels/StagePanels';
import { Icon } from './icons';

interface Props {
  state: PresentationState;
  date: ISODate;
  selected: string | null;
  onSelect: (id: string | null) => void;
  locked: boolean;
  commit: (u: (s: PresentationState) => PresentationState) => void;
  flyTo: (lon: number, lat: number, zoom: number) => void;
}

const sideLabel: Record<string, string> = { axis: 'German army groups', soviet: 'Soviet fronts', allied: 'Western Allied army groups' };

export function ForcesPanel({ state, date, selected, onSelect, locked, commit, flyTo }: Props) {
  const groups = idx.armyGroupsAt(date);
  const bySide = (side: string) => groups.filter((g) => g.side === side);
  const sel = selected ? idx.formation(selected) : null;
  const focus = state.focus.formations;

  const highlight = (id: string) =>
    commit((s) => ({
      ...s,
      focus: { ...s.focus, formations: s.focus.formations.length === 1 && s.focus.formations[0] === id ? [] : [id], dimOthers: true, arrowIds: null },
      panels: { ...s.panels, compare: false },
    }));

  return (
    <div className="side-scroll">
      {!sel && (
        <>
          <p className="hint">Tap an army group to highlight it on the audience map. Formations change over time — the list follows the timeline ({formatDate(date, 'short')}).</p>
          {(['axis', 'soviet', 'allied'] as const).map((side) => {
            const list = bySide(side);
            if (!list.length) return null;
            return (
              <section key={side} className="list-section">
                <h3 className="label">{sideLabel[side]}</h3>
                {list.map((f) => {
                  const c = idx.commanderAt(f, date);
                  const on = focus.includes(f.id);
                  return (
                    <div key={f.id} className={`force-row ${on ? 'on' : ''}`}>
                      <button className="force-main" disabled={locked} onClick={() => highlight(f.id)} aria-pressed={on}>
                        <span className="swatch" style={{ background: formationColor(idx, f, date) ?? f.color ?? '#888' }} />
                        <span className="force-name">{idx.nameAt(f, date)}</span>
                        <span className="force-sub">{c?.person ? `${c.rank ?? ''} ${c.person.name}`.trim() : 'Commander not recorded'}</span>
                      </button>
                      <button className="btn icon ghost" onClick={() => onSelect(f.id)} aria-label={`Details for ${idx.nameAt(f, date)}`}>
                        <Icon.chevronRight />
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </>
      )}
      {sel && <FormationDetail f={sel} date={date} state={state} locked={locked} commit={commit} onBack={() => onSelect(null)} onSelect={onSelect} flyTo={flyTo} />}
    </div>
  );
}

function FormationDetail({ f, date, state, locked, commit, onBack, onSelect, flyTo }: { f: Formation; date: ISODate; state: PresentationState; locked: boolean; commit: Props['commit']; onBack: () => void; onSelect: (id: string) => void; flyTo: Props['flyTo'] }) {
  const [tab, setTab] = useState<'overview' | 'oob' | 'history'>('overview');
  const c = idx.commanderAt(f, date);
  const active = idx.isActive(f, date);
  const subs = idx.subordinatesAt(f, date);
  const sector = idx.sectorAt(f, date);
  const objectives = idx.objectivesAt(f, date);
  const lineage = idx.lineage(f);
  const color = formationColor(idx, f, date) ?? f.color ?? '#888';
  const focused = state.focus.formations.includes(f.id);
  const arrowsOf = idx.pkg.arrows.filter((a) => a.formationId && (a.formationId === f.id || subs.some((s) => s.f.id === a.formationId)));
  const battles = idx.pkg.battles.filter((b) => b.axis.includes(f.id) || b.opponents.includes(f.id));

  const set = (u: (s: PresentationState) => PresentationState) => !locked && commit(u);

  return (
    <div className="detail">
      <button className="btn ghost" onClick={onBack}><Icon.stepPrev /> All formations</button>
      <header className="detail-head" style={{ borderColor: color }}>
        <div className="label">{f.side === 'axis' ? 'German' : f.side === 'soviet' ? 'Soviet' : 'Allied'} {f.echelon.replace('-', ' ')}</div>
        <h2>{idx.nameAt(f, date)}</h2>
        <div className="detail-dates">
          {formatRange(f.existence.from, f.existence.to)} {!active && <span className="chip uncertain">not active on {formatDate(date, 'short')}</span>}
        </div>
      </header>

      <div className="action-grid">
        <button className={`btn ${focused ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, focus: { ...s.focus, formations: focused ? s.focus.formations.filter((x) => x !== f.id) : [f.id], dimOthers: true }, panels: { ...s.panels, compare: false } }))}>
          {focused ? 'Highlighted' : 'Highlight'}
        </button>
        <button
          className={`btn ${state.panels.compare && focused ? 'on' : ''}`}
          disabled={locked || (state.focus.formations.length === 0 && !focused)}
          onClick={() => set((s) => {
            const others = s.focus.formations.filter((x) => x !== f.id);
            const ids = [others[0] ?? f.id, f.id].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
            return { ...s, focus: { ...s.focus, formations: ids, dimOthers: true }, panels: { ...s.panels, compare: ids.length === 2, commander: false, hierarchy: false } };
          })}
        >
          Compare with highlighted
        </button>
        <button className={`btn ${state.panels.commander && focused ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, focus: { ...s.focus, formations: [f.id] }, panels: { ...s.panels, commander: !(s.panels.commander && s.focus.formations[0] === f.id), hierarchy: false, compare: false } }))}>
          Commander card
        </button>
        <button className={`btn ${state.panels.hierarchy && state.hierarchy.rootId === f.id ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, panels: { ...s.panels, hierarchy: !(s.panels.hierarchy && s.hierarchy.rootId === f.id), compare: false }, hierarchy: { rootId: f.id, expanded: s.hierarchy.rootId === f.id ? s.hierarchy.expanded : [f.id] } }))}>
          Unit hierarchy
        </button>
        <button className={`btn ${state.focus.arrowIds ? 'on' : ''}`} disabled={locked || !arrowsOf.length} onClick={() => set((s) => ({ ...s, layers: { ...s.layers, arrows: true }, focus: { ...s.focus, arrowIds: s.focus.arrowIds ? null : arrowsOf.map((a) => a.id) } }))}>
          {state.focus.arrowIds ? 'All arrows' : 'Only its arrows'}
        </button>
        <button className="btn" disabled={locked || !sector} onClick={() => {
          if (!sector) return;
          const lon = sector.ring.reduce((a, p) => a + p[0], 0) / sector.ring.length;
          const lat = sector.ring.reduce((a, p) => a + p[1], 0) / sector.ring.length;
          flyTo(lon, lat, 2.2);
        }}>
          Zoom to sector
        </button>
        <button className={`btn ${state.focus.dimOthers ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, focus: { ...s.focus, dimOthers: !s.focus.dimOthers } }))}>
          Dim others
        </button>
        <button className={`btn ${state.panels.portrait ? 'on' : ''}`} disabled={locked} onClick={() => set((s) => ({ ...s, panels: { ...s.panels, portrait: !s.panels.portrait } }))}>
          Portrait
        </button>
      </div>

      <div className="seg tabs" role="tablist">
        {(['overview', 'oob', 'history'] as const).map((t) => (
          <button key={t} role="tab" aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'oob' ? 'Order of battle' : t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="detail-body">
          <Field label="Commander">
            {c ? (
              <>
                <strong>{c.person?.name ?? c.tenure.personId}</strong> {c.rank && <span className="muted">· {c.rank}</span>}
                <div className="muted small">
                  {c.status === 'snapshot' ? `Recorded for ${formatDate(c.tenure.snapshot!, 'short')} only` : c.status === 'last-recorded' ? `No appointment recorded for this date — last known from ${formatDate(c.tenure.from, 'short')}` : `${formatRange(c.tenure.from, c.tenure.to)}${c.tenure.acting ? ' (acting)' : ''}`}
                </div>
                {c.tenure.note && <div className="muted small">{c.tenure.note}</div>}
              </>
            ) : (
              <span className="muted">Not recorded</span>
            )}
          </Field>
          {f.summary && <Field label="Summary">{f.summary}</Field>}
          {objectives.length > 0 && (
            <Field label="Objectives on this date">
              {objectives.map((o, i) => (
                <div key={i} className="obj">
                  <span className={`chip ${o.kind === 'planned' ? 'planned' : 'documented'}`}>{o.kind}</span> {o.text} <Cite ids={o.sources.map((s) => s.id)} />
                </div>
              ))}
            </Field>
          )}
          <Field label="Subordinate formations">
            {subs.filter((s) => !s.snapshot).length ? subs.filter((s) => !s.snapshot).map((s) => (
              <button key={s.f.id} className="link-row" onClick={() => onSelect(s.f.id)}>{idx.nameAt(s.f, date)} <span className="muted small">{idx.commanderAt(s.f, date)?.person?.name ?? ''}</span></button>
            )) : <span className="muted">None recorded for this date</span>}
          </Field>
          {(f.hq ?? []).length > 0 && <Field label="Headquarters">{f.hq!.map((h, i) => <div key={i}>{h.text} <span className="muted small">({formatRange(h.from, h.to)})</span></div>)}</Field>}
          {sector && <Field label="Sector"><span className="chip approximate">approximate</span> {sector.label}</Field>}
          {(f.strength ?? []).length > 0 && <Field label="Strength (sourced)">{f.strength!.map((s, i) => <div key={i}>{formatDate(s.date, 'short')}: {s.text} <Cite ids={s.sources.map((x) => x.id)} /></div>)}</Field>}
          {battles.length > 0 && <Field label="Major engagements">{battles.map((b) => <div key={b.id}>{b.name} <span className="muted small">{formatRange(b.start, b.end)}</span></div>)}</Field>}
          {f.fate && <Field label="Fate">{f.fate}</Field>}
          <Field label="Sources"><Cite ids={(f.sources ?? []).map((s) => s.id)} long /></Field>
        </div>
      )}

      {tab === 'oob' && <OobTree f={f} date={date} state={state} locked={locked} commit={commit} />}

      {tab === 'history' && (
        <div className="detail-body">
          <Field label="Organisational lineage">
            <div className="lineage">
              {lineage.map((x, i) => (
                <span key={x.id} className="lineage-item">
                  {i > 0 && <span className="muted"> → </span>}
                  <button className={`link ${x.id === f.id ? 'current' : ''}`} onClick={() => onSelect(x.id)}>{x.names[0].name}</button>
                  <span className="muted small"> {x.existence.from.slice(0, 4)}–{x.existence.to?.slice(0, 4) ?? ''}</span>
                </span>
              ))}
            </div>
            <div className="muted small">The same name can denote different headquarters — each record is one organisation under one designation.</div>
          </Field>
          <Field label="Commanders">
            {(f.commanders ?? []).map((t, i) => {
              const p = idx.people.get(t.personId);
              const cur = date >= t.from && (!t.to || date <= t.to);
              return (
                <div key={i} className={`tenure ${cur ? 'current' : ''}`}>
                  <strong>{p?.name ?? t.personId}</strong> <span className="muted small">{t.snapshot ? `as of ${formatDate(t.snapshot, 'short')}` : formatRange(t.from, t.to)}</span>
                  {t.note && <div className="muted small">{t.note}</div>}
                </div>
              );
            })}
          </Field>
          {(f.lineage ?? []).length > 0 && (
            <Field label="Reorganisations">
              {f.lineage!.map((l, i) => (
                <div key={i} className="tenure">
                  <span className="muted small">{formatDate(l.date, 'short')} · {l.type}</span>
                  <div>{l.text}</div>
                </div>
              ))}
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

function OobTree({ f, date, state, locked, commit }: { f: Formation; date: ISODate; state: PresentationState; locked: boolean; commit: Props['commit'] }) {
  const [expanded, setExpanded] = useState<string[]>(state.hierarchy.rootId === f.id ? state.hierarchy.expanded : [f.id]);
  const rows = hierarchyRows(idx, f.id, expanded, date, 400);
  const onAudience = state.panels.hierarchy && state.hierarchy.rootId === f.id;
  const toggle = (id: string) => {
    const next = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id];
    setExpanded(next);
    if (onAudience && !locked) commit((s) => ({ ...s, hierarchy: { rootId: f.id, expanded: next } }));
  };
  const snap = rows.find((r) => r.snapshot)?.snapshot;
  return (
    <div className="detail-body">
      <div className="row-between">
        <span className="muted small">Tap ▸ to expand. {onAudience ? 'Mirrored on the audience display.' : ''}</span>
        <button className={`btn ${onAudience ? 'on' : ''}`} disabled={locked} onClick={() => commit((s) => ({ ...s, panels: { ...s.panels, hierarchy: !onAudience, compare: false }, hierarchy: { rootId: f.id, expanded } }))}>
          {onAudience ? 'Showing to audience' : 'Show to audience'}
        </button>
      </div>
      <ul className="oob">
        {rows.map((r, i) => {
          const c = r.f.echelon !== 'division' ? idx.commanderAt(r.f, date) : null;
          return (
            <li key={`${r.f.id}-${i}`} style={{ paddingLeft: r.depth * 18 }}>
              <button className="oob-node" onClick={() => r.hasChildren && toggle(r.f.id)} aria-expanded={r.hasChildren ? r.expanded : undefined}>
                <span className="oob-caret">{r.hasChildren ? (r.expanded ? '▾' : '▸') : '·'}</span>
                <span className="oob-name">{idx.nameAt(r.f, date)}</span>
                {c?.person && c.status !== 'last-recorded' && <span className="muted small">{c.person.name}</span>}
                {r.incomplete && <span className="chip uncertain">{r.incomplete}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {snap && <p className="muted small">Corps and divisions are an order-of-battle snapshot for {formatDate(snap)} (Glantz, Barbarossa, 2001; MGFA vol. IV). Later reassignments are not entered; entries marked approximate need checking against the source.</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export function Cite({ ids, long }: { ids: string[]; long?: boolean }) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return null;
  return (
    <span className="cite">
      {uniq.map((id) => {
        const s = sourceById.get(id);
        if (!s) return <span key={id} className="chip uncertain">{id}?</span>;
        return long ? (
          <span key={id} className="cite-long">{s.author}, <em>{s.title}</em>{s.year ? ` (${s.year})` : ''}</span>
        ) : (
          <span key={id} className="cite-short" title={`${s.author}, ${s.title}${s.year ? ` (${s.year})` : ''}`}>[{s.author.split(/[,&(]/)[0].trim()}{s.year ? ` ${s.year}` : ''}]</span>
        );
      })}
    </span>
  );
}

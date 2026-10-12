'use client';
import { useMemo, type ReactNode } from 'react';
import type { Camera, CampaignArrow, Formation, ISODate, LonLat, Place } from '@/lib/history/types';
import type { ConflictIndex } from '@/lib/history/query';
import { daysBetween, formatRange, formatDate } from '@/lib/history/query';
import type { GeoData } from '@/lib/map/geodata';
import type { PresentationState, Annotation } from '@/lib/sync/state';
import { transformFor, toScreen, type Transform } from '@/lib/map/camera';
import { project, unitsPerKm } from '@/lib/map/projection';
import { arrowPath, linePath, overlaps, smoothPolyline, textWidth, trimPolyline, type Box, type Pt } from '@/lib/map/shapes';
import { BaseLayer, FrontLines, HeldLayer } from './BaseLayers';
import { AXIS_ARROW, FONT_SANS, FONT_SERIF, FRONT, INK, INK_SOFT, PAPER, SEA, SIDE_COLOR, SOVIET_RED } from '@/lib/map/theme';

export interface AtlasMapProps {
  idx: ConflictIndex;
  geo: GeoData;
  state: PresentationState;
  date: ISODate;
  camera: Camera;
  width: number;
  height: number;
  /** Height of the audience frame in this viewport (sets the common scale). */
  frameH: number;
  idPrefix: string;
  /** Animation clock (ms) for arrow drawing and pulsing markers. */
  now: number;
  /** When each arrow first became visible (client clock), to animate drawing. */
  arrowBorn?: Map<string, number>;
  /** Extra screen-space content (e.g. the presenter's live stroke). */
  children?: ReactNode;
  /** Include an opaque sea background (false for transparent overlays). */
  background?: boolean;
}

const ARROW_DRAW_MS = 1600;

export function placeName(p: Place, date: ISODate) {
  const n = p.names?.find((x) => date >= x.from && (!x.to || date <= x.to));
  return n ? n.name : p.name;
}

/** Formations related to the focus: the focused formations plus their subordinates on the date. */
export function relatedFormations(idx: ConflictIndex, ids: string[], date: ISODate): Set<string> {
  const out = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (out.has(id) || depth > 2) return;
    out.add(id);
    const f = idx.formation(id);
    if (!f) return;
    for (const s of idx.subordinatesAt(f, date)) if (!s.snapshot) walk(s.f.id, depth + 1);
  };
  ids.forEach((id) => walk(id, 0));
  return out;
}

/** Colour of a formation: its own, or that of its army group on the date. */
export function formationColor(idx: ConflictIndex, f: Formation | undefined, date: ISODate): string | undefined {
  let cur = f;
  for (let i = 0; cur && i < 4; i++) {
    if (cur.echelon === 'army-group' && cur.color) return cur.color;
    const parent = idx.parentAt(cur.id, date);
    if (!parent) break;
    cur = parent;
  }
  return f?.color;
}

export function AtlasMap(props: AtlasMapProps) {
  const { idx, geo, state, date, camera, width, height, frameH, idPrefix: P, now, arrowBorn, children, background = true } = props;
  const u = Math.max(0.55, frameH / 1080);
  const t: Transform = transformFor(camera, { w: width, h: height, frameH });
  const layers = state.layers;
  const focus = state.focus;
  const zoom = camera.zoom;

  const territory = idx.territoryAt(date);
  const units = geo.territories.get(territory?.id ?? '');
  const fronts = layers.front ? idx.frontsAt(date) : [];
  const front = fronts[0];
  const frontShape = front ? geo.fronts.get(front.id) : undefined;
  const prevSnap = front ? idx.previousFront(front.theatre, date) : undefined;
  const prevShape = prevSnap ? geo.fronts.get(prevSnap.id) : undefined;
  const uncertaintyWorld = front ? front.uncertaintyKm * unitsPerKm([32, 54]) : 0;

  const related = useMemo(() => relatedFormations(idx, focus.formations, date), [idx, focus.formations, date]);
  const focusing = focus.formations.length > 0 && focus.dimOthers;
  const focusSides = new Set(focus.formations.map((id) => idx.formation(id)?.side));

  // ---- Sectors (army groups and, on the opposing layer, Soviet fronts) ----
  const sectorItems = useMemo(() => {
    if (!layers.sectors) return [];
    const list: { f: Formation; ring: LonLat[]; color: string; opposing: boolean; label: string }[] = [];
    for (const f of idx.armyGroupsAt(date)) {
      const s = idx.sectorAt(f, date);
      if (!s) continue;
      const opposing = f.side !== 'axis';
      if (opposing && !layers.opposing) continue;
      if (!opposing && focus.formations.length && !focus.formations.includes(f.id) && focus.dimOthers) {
        // keep, drawn dimmed
      }
      list.push({ f, ring: s.ring, color: f.color ?? AXIS_ARROW, opposing, label: f.short ?? idx.nameAt(f, date) });
    }
    return list;
  }, [idx, date, layers.sectors, layers.opposing, focus.formations, focus.dimOthers]);

  // ---- Arrows ----
  const arrows = useMemo(() => {
    if (!layers.arrows) return [];
    let list = idx.arrowsAt(date, { operationId: null, windowDays: 60 });
    if (focus.arrowIds) list = list.filter((a) => focus.arrowIds!.includes(a.arrow.id));
    if (!layers.opposing) list = list.filter((a) => a.arrow.side === 'axis' || (focus.formations.length > 0 && focusSides.has(a.arrow.side)) || a.arrow.side === 'allied');
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, date, layers.arrows, layers.opposing, focus.arrowIds, focus.formations]);

  const battles = layers.battles ? idx.battlesAt(date) : [];
  const focusBattle = focus.battleId ? idx.pkg.battles.find((b) => b.id === focus.battleId) : undefined;

  const objectives = layers.objectives ? idx.pkg.objectives.filter((o) => o.set <= date) : [];

  // ---- Cities with simple collision handling ----
  const placed: Box[] = [];
  const cityEls: ReactNode[] = [];
  const eventPlaces = new Set(idx.pkg.events.filter((e) => e.placeId && Math.abs(daysBetween(e.date, date)) <= 3 && e.date <= date).map((e) => e.placeId!));
  const highlight = new Set([...focus.cities, ...eventPlaces]);
  const inView = (x: number, y: number, m = 40) => x > -m && y > -m && x < width + m && y < height + m;

  for (const { battle } of battles) {
    const s = toScreen(t, project(battle.at));
    const r = (focusBattle?.id === battle.id ? 17 : 12.5) * u;
    placed.push({ x: s[0] - r - 2, y: s[1] - r - 2, w: r * 2 + 4, h: r * 2 + 4 });
  }
  if (layers.cities) {
    const minRank = zoom >= 3.4 ? 3 : zoom >= 1.9 ? 2 : 1;
    const candidates = idx.pkg.places
      .filter((p) => p.kind !== 'physical' && (p.rank <= minRank || highlight.has(p.id)))
      .map((p) => ({ p, s: toScreen(t, project(p.at)) }))
      .filter(({ s }) => inView(s[0], s[1]))
      .sort((a, b) => Number(highlight.has(b.p.id)) - Number(highlight.has(a.p.id)) || a.p.rank - b.p.rank || (a.p.kind === 'capital' ? -1 : 1));
    for (const { p, s } of candidates) {
      const hi = highlight.has(p.id);
      const cap = p.kind === 'capital';
      const size = (hi ? 21 : cap ? 19 : p.rank === 1 ? 17.5 : p.rank === 2 ? 15.5 : 14) * u;
      const name = placeName(p, date);
      const w = textWidth(name, size, FONT_SANS, hi || cap ? 600 : 500);
      const dot = (cap ? 5.2 : hi ? 4.6 : 3.6) * u;
      const options: [number, number, 'start' | 'end' | 'middle'][] = [
        [dot + 4 * u, size * 0.35, 'start'],
        [-dot - 4 * u, size * 0.35, 'end'],
        [dot + 3 * u, -size * 0.45, 'start'],
        [dot + 3 * u, size * 1.1, 'start'],
        [0, -dot - 6 * u, 'middle'],
        [0, dot + size * 0.95, 'middle'],
      ];
      let chosen: (typeof options)[number] | null = null;
      let box: Box | null = null;
      for (const o of options) {
        const x0 = o[2] === 'start' ? s[0] + o[0] : o[2] === 'end' ? s[0] + o[0] - w : s[0] - w / 2;
        const b = { x: x0, y: s[1] + o[1] - size * 0.8, w, h: size };
        if (!placed.some((q) => overlaps(q, b, 3 * u))) {
          chosen = o;
          box = b;
          break;
        }
      }
      const dotBox = { x: s[0] - dot, y: s[1] - dot, w: dot * 2, h: dot * 2 };
      if (!chosen && !hi) {
        if (!placed.some((q) => overlaps(q, dotBox, 1))) {
          placed.push(dotBox);
          cityEls.push(<circle key={p.id} cx={s[0]} cy={s[1]} r={dot * 0.75} fill={INK} />);
        }
        continue;
      }
      chosen ??= options[0];
      if (box) placed.push(box);
      placed.push(dotBox);
      cityEls.push(
        <g key={p.id}>
          {cap ? (
            <g>
              <circle cx={s[0]} cy={s[1]} r={dot} fill={PAPER} stroke={INK} strokeWidth={1.4 * u} />
              <circle cx={s[0]} cy={s[1]} r={dot * 0.45} fill={INK} />
            </g>
          ) : (
            <circle cx={s[0]} cy={s[1]} r={dot} fill={hi ? INK : '#3e3b35'} stroke={PAPER} strokeWidth={1.1 * u} />
          )}
          <text
            x={s[0] + chosen[0]}
            y={s[1] + chosen[1]}
            textAnchor={chosen[2]}
            fontFamily={FONT_SANS}
            fontWeight={hi || cap ? 600 : 500}
            fontSize={size}
            fill={hi ? '#111' : INK}
            stroke={PAPER}
            strokeWidth={3.6 * u}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {name}
          </text>
        </g>,
      );
    }
  }

  // ---- Physical and political labels ----
  const physEls: ReactNode[] = [];
  if (layers.physical) {
    const minRank = zoom >= 3.5 ? 3 : zoom >= 1.8 ? 2 : 1;
    for (const ph of idx.pkg.physical) {
      if (ph.rank > minRank) continue;
      if (ph.kind === 'river' && !layers.rivers) continue;
      const s = toScreen(t, project(ph.at));
      if (!inView(s[0], s[1], 0)) continue;
      const sea = ph.kind === 'sea';
      const size = (sea ? (ph.rank === 1 ? 19 : 15.5) : ph.kind === 'river' ? 14 : ph.kind === 'mountains' ? 14 : 13.5) * u * (ph.size ?? 1);
      const label = ph.name;
      const ls = ph.kind === 'mountains' || ph.kind === 'marsh' ? 0.28 : sea ? 0.12 : 0.04;
      const w = textWidth(label, size, FONT_SERIF, 400, ls);
      const b = { x: s[0] - w / 2, y: s[1] - size, w, h: size * 1.2 };
      if (!ph.rotate && placed.some((q) => overlaps(q, b))) continue;
      if (!ph.rotate) placed.push(b);
      physEls.push(
        <text
          key={ph.id}
          x={s[0]}
          y={s[1]}
          textAnchor="middle"
          transform={ph.rotate ? `rotate(${ph.rotate} ${s[0]} ${s[1]})` : undefined}
          fontFamily={FONT_SERIF}
          fontStyle={sea || ph.kind === 'river' ? 'italic' : 'normal'}
          fontSize={size}
          letterSpacing={`${ls}em`}
          fill={sea ? '#4e6f84' : ph.kind === 'river' ? '#4f7690' : ph.kind === 'marsh' ? '#5f6b4a' : '#6e5a43'}
          opacity={0.9}
          stroke={sea ? undefined : PAPER}
          strokeWidth={sea ? undefined : 2.4 * u}
          paintOrder="stroke"
        >
          {label}
        </text>,
      );
    }
  }
  const countryEls: ReactNode[] = [];
  if (layers.territory && units && zoom < 4.2) {
    for (const tu of units) {
      if (!tu.labelAt) continue;
      const at = project(tu.labelAt);
      const s = toScreen(t, at);
      if (!inView(s[0], s[1], -20)) continue;
      const size = 13 * u;
      const label = tu.name.toUpperCase();
      const w = textWidth(label, size, FONT_SERIF, 600, 0.22);
      const b = { x: s[0] - w / 2, y: s[1] - size, w, h: size * 1.2 };
      if (placed.some((q) => overlaps(q, b, 6 * u))) continue;
      placed.push(b);
      countryEls.push(
        <text key={tu.id} x={s[0]} y={s[1]} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={600} fontSize={size} letterSpacing="0.22em" fill="#6b6457" opacity={0.75}>
          {label}
        </text>,
      );
    }
  }

  // ---- Arrow geometry ----
  const zoomScale = Math.max(0.75, Math.min(1.45, Math.sqrt(zoom / 1.6)));
  const arrowEls = arrows.map(({ arrow, state: st }) => {
    const pts: Pt[] = arrow.path.map((ll) => toScreen(t, project(ll)));
    let center = smoothPolyline(pts, 5);
    const born = arrowBorn?.get(arrow.id);
    const progress = born === undefined ? 1 : Math.min(1, (now - born) / ARROW_DRAW_MS);
    if (progress < 1) center = trimPolyline(center, 0.08 + 0.92 * (1 - Math.pow(1 - progress, 2)));
    const major = arrow.weight === 'major';
    const s = u * zoomScale;
    const d = arrowPath(center, (major ? 8 : 5) * s, (major ? 15 : 9) * s, (major ? 26 : 18) * s, (major ? 17 : 11.5) * s);
    const f = arrow.formationId ? idx.formation(arrow.formationId) : undefined;
    const color = arrow.side === 'axis' ? formationColor(idx, f, date) ?? AXIS_ARROW : SIDE_COLOR[arrow.side] ?? AXIS_ARROW;
    const isRelated = !focusing || (arrow.formationId && related.has(arrow.formationId)) || (focusSides.size && !focusSides.has(arrow.side));
    const opacity = (st === 'done' ? 0.5 : 0.92) * (isRelated ? 1 : 0.22);
    return { arrow, d, color, opacity, center, active: st === 'active', isRelated };
  });

  const labelArrows = arrowEls.filter((a) => a.isRelated && (a.active || (focusing && a.arrow.formationId && related.has(a.arrow.formationId))) && a.center.length > 3);
  const arrowLabelEls: ReactNode[] = [];
  for (const a of labelArrows) {
    const mid = a.center[Math.floor(a.center.length * 0.45)];
    const size = 12.5 * u;
    const line1 = a.arrow.label;
    const line2 = formatRange(a.arrow.start, a.arrow.end);
    const w = Math.max(textWidth(line1, size, FONT_SANS, 500), textWidth(line2, size * 0.92, FONT_SANS, 400));
    const candidates: Pt[] = [[mid[0] + 14 * u, mid[1] - 10 * u], [mid[0] - w - 14 * u, mid[1] - 10 * u], [mid[0] - w / 2, mid[1] + 22 * u], [mid[0] - w / 2, mid[1] - 34 * u]];
    for (const c of candidates) {
      const b = { x: c[0], y: c[1] - size, w, h: size * 2.3 };
      if (placed.some((q) => overlaps(q, b, 2 * u)) || !inView(c[0], c[1], -10)) continue;
      placed.push(b);
      arrowLabelEls.push(
        <g key={`al-${a.arrow.id}`} fontFamily={FONT_SANS} stroke={PAPER} strokeWidth={3 * u} paintOrder="stroke" strokeLinejoin="round">
          <text x={c[0]} y={c[1]} fontSize={size} fontWeight={600} fill={a.color}>{line1}</text>
          <text x={c[0]} y={c[1] + size * 1.15} fontSize={size * 0.92} fill={INK_SOFT}>{line2}</text>
        </g>,
      );
      break;
    }
  }

  const pulse = 0.5 + 0.5 * Math.sin(now / 420);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }} role="img" aria-label={`Historical map, ${formatDate(date)}`}>
      <defs>
        <clipPath id={`${P}-land`}>
          <path d={geo.landD} />
        </clipPath>
        <pattern id={`${P}-hatch`} patternUnits="userSpaceOnUse" width={7 / t.k * u} height={7 / t.k * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={7 / t.k * u} stroke="#4a5360" strokeWidth={1.1 / t.k * u} strokeOpacity={0.35} />
        </pattern>
        <pattern id={`${P}-shatch`} patternUnits="userSpaceOnUse" width={9 / t.k * u} height={9 / t.k * u} patternTransform="rotate(-45)">
          <line x1={0} y1={0} x2={0} y2={9 / t.k * u} stroke="#000" strokeWidth={1 / t.k * u} strokeOpacity={0.25} />
        </pattern>
      </defs>
      {background && <rect x={0} y={0} width={width} height={height} fill={SEA} />}
      <g transform={`translate(${t.tx} ${t.ty}) scale(${t.k})`}>
        <BaseLayer geo={geo} units={units} showTerritory={layers.territory} showRelief={layers.relief} showBorders={layers.borders} showRivers={layers.rivers} u={u} prefix={P} />
        <HeldLayer front={frontShape} prefix={P} show={layers.held} />
        {sectorItems.map(({ f, ring, color, opposing }) => {
          const dim = focusing && !related.has(f.id) && !(opposing && !focusSides.has(f.side));
          const sel = focus.formations.includes(f.id);
          const d = linePath(ring.map((ll) => project(ll)) as Pt[]) + 'Z';
          return (
            <g key={`sec-${f.id}`} opacity={dim ? 0.25 : 1} clipPath={`url(#${P}-land)`}>
              <path d={d} fill={color} fillOpacity={opposing ? 0.08 : sel ? 0.2 : 0.11} />
              <path d={d} fill="none" stroke={color} strokeWidth={(sel ? 2.4 : 1.5) * u} strokeDasharray={`${9 * u} ${5 * u}`} vectorEffect="non-scaling-stroke" strokeOpacity={0.85} />
            </g>
          );
        })}
        <FrontLines front={frontShape} prev={prevShape} showPrev={layers.prevFront} showUncertainty={layers.uncertainty} uncertaintyWorld={uncertaintyWorld} u={u} />
      </g>

      {/* Screen-space overlay */}
      {countryEls}
      {physEls}
      {sectorItems.map(({ f, ring, color, opposing, label }) => {
        const dim = focusing && !related.has(f.id) && !(opposing && !focusSides.has(f.side));
        const c = ring.reduce((acc, p) => [acc[0] + p[0] / ring.length, acc[1] + p[1] / ring.length], [0, 0]) as LonLat;
        const s = toScreen(t, project(c));
        if (!inView(s[0], s[1], -40)) return null;
        const size = (opposing ? 14 : 17) * u;
        return (
          <text key={`secl-${f.id}`} x={s[0]} y={s[1]} textAnchor="middle" fontFamily={FONT_SANS} fontWeight={700} fontSize={size} letterSpacing="0.14em" fill={color} opacity={dim ? 0.25 : 0.95} stroke={PAPER} strokeWidth={3.5 * u} paintOrder="stroke">
            {label.toUpperCase()}
          </text>
        );
      })}
      {objectives.map((o) => {
        const done = o.achieved && o.achieved <= date;
        const s = toScreen(t, project(o.at));
        const r = 12 * u;
        const lineD = o.line ? linePath(smoothPolyline(o.line.map((ll) => toScreen(t, project(ll))), 8)) : null;
        return (
          <g key={o.id} opacity={done ? 0.5 : 1}>
            {lineD && <path d={lineD} fill="none" stroke="#6a4c93" strokeWidth={2.2 * u} strokeDasharray={`${10 * u} ${6 * u}`} />}
            {!o.line && (
              <g>
                <circle cx={s[0]} cy={s[1]} r={r} fill="none" stroke="#6a4c93" strokeWidth={2 * u} strokeDasharray={`${4 * u} ${3 * u}`} />
                <line x1={s[0] - r * 1.5} y1={s[1]} x2={s[0] - r * 0.5} y2={s[1]} stroke="#6a4c93" strokeWidth={1.6 * u} />
                <line x1={s[0] + r * 0.5} y1={s[1]} x2={s[0] + r * 1.5} y2={s[1]} stroke="#6a4c93" strokeWidth={1.6 * u} />
              </g>
            )}
            <text x={o.line ? s[0] + 10 * u : s[0]} y={o.line ? s[1] : s[1] - r - 6 * u} textAnchor={o.line ? 'start' : 'middle'} fontFamily={FONT_SANS} fontStyle="italic" fontSize={12.5 * u} fill="#4b3570" stroke={PAPER} strokeWidth={3 * u} paintOrder="stroke">
              {o.line ? o.label : `Objective: ${o.label}`} {done ? `— taken ${formatDate(o.achieved!, 'short')}` : '(planned)'}
            </text>
          </g>
        );
      })}
      <g>
        {arrowEls.map((a) => (
          <path key={a.arrow.id} d={a.d} fill={a.color} fillOpacity={a.opacity} stroke={a.arrow.side === 'soviet' ? '#5c1712' : '#1e2329'} strokeOpacity={a.opacity * 0.7} strokeWidth={0.9 * u} strokeLinejoin="round" />
        ))}
      </g>
      {frontShape &&
        frontShape.pockets.map((pk) => {
          if (!pk.centroid) return null;
          const s = toScreen(t, pk.centroid);
          if (!inView(s[0], s[1], -10) || zoom < 2.2) return null;
          return (
            <text key={pk.id} x={s[0]} y={s[1]} textAnchor="middle" fontFamily={FONT_SANS} fontSize={11.5 * u} fontStyle="italic" fill={pk.side === 'soviet' ? SOVIET_RED : INK} stroke={PAPER} strokeWidth={3 * u} paintOrder="stroke">
              {pk.label}
            </text>
          );
        })}
      {battles.map(({ battle, state: st }) => {
        const s = toScreen(t, project(battle.at));
        if (!inView(s[0], s[1])) return null;
        const sel = focusBattle?.id === battle.id;
        const r = (sel ? 17 : 12.5) * u;
        const active = st === 'active';
        return (
          <g key={battle.id} opacity={st === 'recent' && !sel ? 0.6 : 1}>
            {active && <circle cx={s[0]} cy={s[1]} r={r * (1.35 + 0.25 * pulse)} fill="none" stroke={FRONT} strokeOpacity={0.35 * (1 - pulse * 0.5)} strokeWidth={2 * u} />}
            <circle cx={s[0]} cy={s[1]} r={r} fill={PAPER} stroke={INK} strokeWidth={1.6 * u} />
            <g stroke={INK} strokeWidth={1.9 * u} strokeLinecap="round">
              <line x1={s[0] - r * 0.55} y1={s[1] + r * 0.55} x2={s[0] + r * 0.55} y2={s[1] - r * 0.55} />
              <line x1={s[0] - r * 0.55} y1={s[1] - r * 0.55} x2={s[0] + r * 0.55} y2={s[1] + r * 0.55} />
              <line x1={s[0] + r * 0.18} y1={s[1] - r * 0.58} x2={s[0] + r * 0.58} y2={s[1] - r * 0.18} />
              <line x1={s[0] - r * 0.18} y1={s[1] - r * 0.58} x2={s[0] - r * 0.58} y2={s[1] - r * 0.18} />
            </g>
            {(sel || zoom >= 3) && (
              <g fontFamily={FONT_SANS} stroke={PAPER} strokeWidth={3.4 * u} paintOrder="stroke" strokeLinejoin="round">
                <text x={s[0] + r + 6 * u} y={s[1] - 2 * u} fontSize={(sel ? 17 : 13.5) * u} fontWeight={700} fill={INK}>{battle.name}</text>
                <text x={s[0] + r + 6 * u} y={s[1] + (sel ? 17 : 13) * u} fontSize={(sel ? 13.5 : 11.5) * u} fill={INK_SOFT}>{formatRange(battle.start, battle.end)}</text>
              </g>
            )}
          </g>
        );
      })}
      {arrowLabelEls}
      {cityEls}
      <AnnotationsLayer annotations={state.annotations} draft={state.draft} t={t} u={u} />
      {children}
    </svg>
  );
}

export function annotationShape(a: Annotation, t: Transform, u: number): ReactNode {
  const pts = a.points.map((ll) => toScreen(t, project(ll)));
  const w = a.width * u;
  if (!pts.length) return null;
  if (a.kind === 'freehand') {
    return <path d={linePath(pts.length > 2 ? smoothPolyline(pts, 3) : pts)} fill="none" stroke={a.color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (a.kind === 'arrow' && pts.length >= 2) {
    const center = smoothPolyline(pts.length > 2 ? pts : [pts[0], pts[pts.length - 1]], 4);
    return <path d={arrowPath(center, w * 1.4, w * 2.4, w * 5, w * 3.2)} fill={a.color} fillOpacity={0.9} stroke="#000" strokeOpacity={0.25} strokeWidth={u} />;
  }
  if (a.kind === 'circle' && pts.length >= 2) {
    const r = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    return <circle cx={pts[0][0]} cy={pts[0][1]} r={r} fill="none" stroke={a.color} strokeWidth={w} />;
  }
  if (a.kind === 'text' && a.text) {
    return (
      <text x={pts[0][0]} y={pts[0][1]} fontFamily={FONT_SANS} fontWeight={700} fontSize={a.width * 4.5 * u} fill={a.color} stroke={a.color === '#ffffff' ? INK : PAPER} strokeWidth={4 * u} paintOrder="stroke">
        {a.text}
      </text>
    );
  }
  return null;
}

function AnnotationsLayer({ annotations, draft, t, u }: { annotations: Annotation[]; draft: Annotation | null; t: Transform; u: number }) {
  return (
    <g pointerEvents="none">
      {annotations.map((a) => (
        <g key={a.id}>{annotationShape(a, t, u)}</g>
      ))}
      {draft && <g opacity={0.9}>{annotationShape(draft, t, u)}</g>}
    </g>
  );
}

export type { CampaignArrow };

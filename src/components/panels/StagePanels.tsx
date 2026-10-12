'use client';
import type { ReactNode } from 'react';
import type { ConflictIndex } from '@/lib/history/query';
import { formatDate, formatRange, daysBetween } from '@/lib/history/query';
import type { Formation, ISODate } from '@/lib/history/types';
import type { PresentationState } from '@/lib/sync/state';
import { sourceById } from '@/data/conflicts/ww2-europe/sources';
import { textWidth, wrapText } from '@/lib/map/shapes';
import { FONT_SANS, FONT_SERIF, FRONT, FRONT_PREV, HELD, INK, INK_SOFT, STATUS_FILL, STATUS_LABEL, SOVIET_RED, AXIS_ARROW } from '@/lib/map/theme';
import { formationColor } from '../map/AtlasMap';

// Audience-facing panels, drawn in SVG stage coordinates (1920 × 1080) so the whole frame can be
// exported as a single image.

const CARD = '#f8f5ee';
const CARD_EDGE = 'rgba(43,42,38,0.22)';

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

function Card({ x, y, w, h, children, accent }: { x: number; y: number; w: number; h: number; children: ReactNode; accent?: string }) {
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={6} fill="rgba(0,0,0,0.10)" />
      <rect x={x} y={y} width={w} height={h} rx={6} fill={CARD} fillOpacity={0.96} stroke={CARD_EDGE} />
      {accent && <rect x={x} y={y} width={6} height={h} rx={3} fill={accent} />}
      {children}
    </g>
  );
}

const shortSource = (id: string) => {
  const s = sourceById.get(id);
  if (!s) return id;
  const author = s.author.split(/[,&]/)[0].replace(/\(.*?\)/g, '').trim();
  return s.year ? `${author} ${s.year}` : author;
};

export function sourcesText(ids: string[], max = 4) {
  const uniq = [...new Set(ids)].filter((id) => id !== 'atlas-reconstruction' && id !== 'natural-earth');
  const list = uniq.slice(0, max).map(shortSource);
  return list.join('; ') + (uniq.length > max ? ' et al.' : '');
}

export function TitleBlock({ region, state, scale }: { region: Region; state: PresentationState; scale: number }) {
  if (!state.caption) return null;
  const x = region.x + 40 * scale, y = region.y + 40 * scale;
  const tSize = 46 * scale, sSize = 24 * scale;
  const w = Math.max(textWidth(state.caption.title, tSize, FONT_SERIF, 600), textWidth(state.caption.subtitle, sSize, FONT_SANS, 400)) + 56 * scale;
  return (
    <Card x={x} y={y} w={Math.min(w, region.w * 0.62)} h={(state.caption.subtitle ? 104 : 74) * scale}>
      <text x={x + 26 * scale} y={y + 56 * scale} fontFamily={FONT_SERIF} fontWeight={600} fontSize={tSize} fill={INK}>{state.caption.title}</text>
      {state.caption.subtitle && <text x={x + 27 * scale} y={y + 88 * scale} fontFamily={FONT_SANS} fontSize={sSize} fill={INK_SOFT}>{state.caption.subtitle}</text>}
    </Card>
  );
}

export function DateBlock({ region, date, frontLabel, scale }: { region: Region; date: ISODate; frontLabel: string | null; scale: number }) {
  const size = 40 * scale;
  const label = formatDate(date);
  const w = Math.max(textWidth(label, size, FONT_SERIF, 600), frontLabel ? textWidth(frontLabel, 17 * scale, FONT_SANS) : 0) + 48 * scale;
  const x = region.x + region.w - w - 40 * scale, y = region.y + 40 * scale;
  return (
    <Card x={x} y={y} w={w} h={(frontLabel ? 92 : 68) * scale}>
      <text x={x + w - 24 * scale} y={y + 50 * scale} textAnchor="end" fontFamily={FONT_SERIF} fontWeight={600} fontSize={size} fill={INK} style={{ fontVariantNumeric: 'lining-nums' }}>{label}</text>
      {frontLabel && <text x={x + w - 24 * scale} y={y + 78 * scale} textAnchor="end" fontFamily={FONT_SANS} fontSize={17 * scale} fill={INK_SOFT}>{frontLabel}</text>}
    </Card>
  );
}

export function EventCaption({ region, idx, date, scale, bottomOffset }: { region: Region; idx: ConflictIndex; date: ISODate; scale: number; bottomOffset: number }) {
  const ev = idx.latestEvent(date);
  if (!ev || daysBetween(ev.date, date) > 4) return null;
  const size = 22 * scale;
  const text = `${formatDate(ev.date, 'short')} — ${ev.title}`;
  const w = Math.min(region.w - 80 * scale, textWidth(text, size, FONT_SANS, 600) + 48 * scale);
  const x = region.x + 40 * scale, y = region.y + region.h - bottomOffset - 64 * scale;
  return (
    <Card x={x} y={y} w={w} h={52 * scale} accent={FRONT}>
      <text x={x + 24 * scale} y={y + 34 * scale} fontFamily={FONT_SANS} fontWeight={600} fontSize={size} fill={INK}>{text}</text>
    </Card>
  );
}

function initials(name: string) {
  const parts = name.replace(/\b(von|ritter|der|graf)\b/gi, '').split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
}

export function CommanderCard({ x, y, w, idx, f, date, scale, showPortrait }: { x: number; y: number; w: number; idx: ConflictIndex; f: Formation; date: ISODate; scale: number; showPortrait: boolean }) {
  const s = scale;
  const c = idx.commanderAt(f, date);
  const name = idx.nameAt(f, date);
  const color = formationColor(idx, f, date) ?? f.color ?? AXIS_ARROW;
  const subs = idx.subordinatesAt(f, date).filter((x) => !x.snapshot && ['army', 'panzer-group', 'panzer-army'].includes(x.f.echelon));
  const obj = idx.objectivesAt(f, date)[0];
  const hq = (f.hq ?? []).find((h) => date >= h.from && (!h.to || date <= h.to));
  const pad = 24 * s;
  const portraitW = showPortrait ? 112 * s : 0;
  const textX = x + pad + (showPortrait ? portraitW + 20 * s : 0);
  const textW = w - (textX - x) - pad;
  const lines: ReactNode[] = [];
  let cy = y + 74 * s;
  const commanderName = c?.person?.name ?? 'Commander not recorded';
  lines.push(<text key="cn" x={textX} y={cy + 30 * s} fontFamily={FONT_SERIF} fontWeight={600} fontSize={28 * s} fill={INK}>{commanderName}</text>);
  cy += 30 * s;
  if (c?.rank) {
    cy += 26 * s;
    lines.push(<text key="rk" x={textX} y={cy} fontFamily={FONT_SANS} fontSize={18 * s} fill={INK_SOFT}>{c.rank}</text>);
  }
  if (c) {
    cy += 24 * s;
    const since = c.status === 'snapshot' ? `As of ${formatDate(c.tenure.snapshot!, 'short')}` : c.status === 'last-recorded' ? `Last recorded from ${formatDate(c.tenure.from, 'short')}` : `In command ${formatRange(c.tenure.from, c.tenure.to ?? undefined)}`.replace(/–\s*$/, '');
    lines.push(<text key="since" x={textX} y={cy} fontFamily={FONT_SANS} fontSize={16 * s} fill={INK_SOFT}>{c.tenure.to ? since : `In command from ${formatDate(c.tenure.from, 'short')}`}</text>);
  }
  cy = Math.max(cy, y + 74 * s + (showPortrait ? 140 * s : 0));
  const rows: ReactNode[] = [];
  const row = (label: string, value: string, key: string) => {
    const wrapped = wrapText(value, 17 * s, FONT_SANS, w - pad * 2 - 110 * s);
    rows.push(
      <g key={key}>
        <text x={x + pad} y={cy + 22 * s} fontFamily={FONT_SANS} fontWeight={600} fontSize={13.5 * s} letterSpacing="0.08em" fill={INK_SOFT}>{label.toUpperCase()}</text>
        {wrapped.slice(0, 4).map((l, i) => (
          <text key={i} x={x + pad + 110 * s} y={cy + 22 * s + i * 22 * s} fontFamily={FONT_SANS} fontSize={17 * s} fill={INK}>{l}</text>
        ))}
      </g>,
    );
    cy += Math.max(1, Math.min(4, wrapped.length)) * 22 * s + 10 * s;
  };
  cy += 8 * s;
  if (hq) row('HQ', hq.text, 'hq');
  if (subs.length) row('Armies', subs.map((x) => idx.nameAt(x.f, date)).join(' · '), 'subs');
  if (obj) row(obj.kind === 'planned' ? 'Objective' : obj.kind === 'defensive' ? 'Task' : 'Revised aim', obj.text, 'obj');
  const srcIds = [...(c?.tenure.sources ?? []).map((r) => r.id), ...(f.sources ?? []).map((r) => r.id)];
  const h = cy - y + 40 * s;
  return (
    <Card x={x} y={y} w={w} h={h} accent={color}>
      <text x={x + pad} y={y + 40 * s} fontFamily={FONT_SANS} fontWeight={700} fontSize={25 * s} fill={color}>{name}</text>
      <text x={x + pad} y={y + 62 * s} fontFamily={FONT_SANS} fontSize={14.5 * s} letterSpacing="0.06em" fill={INK_SOFT}>{(f.side === 'axis' ? 'GERMAN ' : f.side === 'soviet' ? 'SOVIET ' : 'ALLIED ') + f.echelon.replace('-', ' ').toUpperCase()}</text>
      {showPortrait && (
        <g>
          <rect x={x + pad} y={y + 80 * s} width={portraitW} height={136 * s} rx={4} fill="#e6e0d2" stroke={CARD_EDGE} />
          {c?.person?.portrait ? (
            <image href={c.person.portrait.src} x={x + pad} y={y + 80 * s} width={portraitW} height={136 * s} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <g>
              <text x={x + pad + portraitW / 2} y={y + 160 * s} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={600} fontSize={44 * s} fill="#9a917f">{initials(commanderName)}</text>
              <text x={x + pad + portraitW / 2} y={y + 202 * s} textAnchor="middle" fontFamily={FONT_SANS} fontSize={10.5 * s} fill="#9a917f">no licensed portrait</text>
            </g>
          )}
        </g>
      )}
      {lines}
      {rows}
      <text x={x + pad} y={y + h - 16 * s} fontFamily={FONT_SANS} fontSize={12.5 * s} fill={INK_SOFT}>Sources: {sourcesText(srcIds, 3)}</text>
    </Card>
  );
}

interface TreeRow {
  depth: number;
  f: Formation;
  expanded: boolean;
  hasChildren: boolean;
  snapshot?: string;
  more?: number;
  incomplete?: string;
}

export function hierarchyRows(idx: ConflictIndex, rootId: string, expanded: string[], date: ISODate, limit = 40): TreeRow[] {
  const rows: TreeRow[] = [];
  const root = idx.formation(rootId);
  if (!root) return rows;
  const walk = (f: Formation, depth: number, snapshot?: string) => {
    if (rows.length >= limit) return;
    const children = idx.subordinatesAt(f, date);
    const isExp = expanded.includes(f.id);
    rows.push({ depth, f, expanded: isExp, hasChildren: children.length > 0, snapshot, incomplete: f.incomplete });
    if (isExp) for (const ch of children) walk(ch.f, depth + 1, ch.snapshot);
  };
  walk(root, 0);
  return rows;
}

export function HierarchyPanel({ x, y, w, maxH, idx, rootId, expanded, date, scale }: { x: number; y: number; w: number; maxH: number; idx: ConflictIndex; rootId: string; expanded: string[]; date: ISODate; scale: number }) {
  const s = scale;
  const rowH = 30 * s;
  const all = hierarchyRows(idx, rootId, expanded, date, 200);
  const fit = Math.max(3, Math.floor((maxH - 110 * s) / rowH));
  const rows = all.slice(0, fit);
  const snap = all.find((r) => r.snapshot)?.snapshot;
  const h = 84 * s + rows.length * rowH + (snap ? 30 * s : 10 * s) + (all.length > rows.length ? 26 * s : 0);
  const root = idx.formation(rootId)!;
  return (
    <Card x={x} y={y} w={w} h={h} accent={formationColor(idx, root, date)}>
      <text x={x + 24 * s} y={y + 38 * s} fontFamily={FONT_SANS} fontWeight={700} fontSize={22 * s} fill={INK}>Order of battle</text>
      <text x={x + 24 * s} y={y + 62 * s} fontFamily={FONT_SANS} fontSize={15 * s} fill={INK_SOFT}>{idx.nameAt(root, date)} · {formatDate(date, 'short')}</text>
      {rows.map((r, i) => {
        const ry = y + 92 * s + i * rowH;
        const rx = x + 26 * s + r.depth * 26 * s;
        const c = r.f.echelon !== 'division' ? idx.commanderAt(r.f, date) : null;
        const label = idx.nameAt(r.f, date);
        const sz = (r.depth === 0 ? 19 : r.f.echelon === 'division' ? 15.5 : 17) * s;
        const cmd = c && c.status !== 'last-recorded' ? c.person?.name : null;
        return (
          <g key={`${r.f.id}-${i}`}>
            {r.depth > 0 && <path d={`M${rx - 16 * s},${ry - 22 * s} V${ry - 6 * s} H${rx - 6 * s}`} fill="none" stroke={CARD_EDGE} strokeWidth={1.2 * s} />}
            <text x={rx} y={ry} fontFamily={FONT_SANS} fontWeight={r.depth <= 1 ? 600 : 500} fontSize={sz} fill={INK}>
              {r.hasChildren ? (r.expanded ? '▾ ' : '▸ ') : ''}{label}
            </text>
            {cmd && <text x={x + w - 20 * s} y={ry} textAnchor="end" fontFamily={FONT_SANS} fontSize={14.5 * s} fill={INK_SOFT}>{cmd}</text>}
            {!cmd && r.incomplete && <text x={x + w - 20 * s} y={ry} textAnchor="end" fontFamily={FONT_SANS} fontStyle="italic" fontSize={13 * s} fill="#8a6d3b">details not entered</text>}
          </g>
        );
      })}
      {all.length > rows.length && <text x={x + 26 * s} y={y + 92 * s + rows.length * rowH} fontFamily={FONT_SANS} fontStyle="italic" fontSize={14 * s} fill={INK_SOFT}>+ {all.length - rows.length} more</text>}
      {snap && <text x={x + 24 * s} y={y + h - 14 * s} fontFamily={FONT_SANS} fontSize={13 * s} fill="#8a6d3b">Corps and divisions as of {formatDate(snap, 'short')} (Glantz 2001; MGFA vol. IV)</text>}
    </Card>
  );
}

export function ComparePanel({ x, y, w, idx, ids, date, scale }: { x: number; y: number; w: number; idx: ConflictIndex; ids: string[]; date: ISODate; scale: number }) {
  const s = scale;
  const fs = ids.map((id) => idx.formation(id)).filter(Boolean) as Formation[];
  if (fs.length < 2) return null;
  const colW = (w - 170 * s) / 2;
  const front = idx.frontAt('east', date);
  const rows: [string, (f: Formation) => string][] = [
    ['Date', () => formatDate(date)],
    ['Sector', (f) => idx.sectorAt(f, date)?.label.replace('Approximate operational sector', 'Approx. sector') ?? (f.theatre ? `${f.theatre} theatre` : '—')],
    ['Commander', (f) => {
      const c = idx.commanderAt(f, date);
      return c?.person ? `${c.rank ? c.rank + ' ' : ''}${c.person.name}` : '—';
    }],
    ['Armies', (f) => idx.subordinatesAt(f, date).filter((x) => !x.snapshot).map((x) => idx.nameAt(x.f, date)).join(', ') || '—'],
    ['Objective', (f) => idx.objectivesAt(f, date)[0]?.text ?? '—'],
    ['Engagements', (f) => idx.pkg.battles.filter((b) => b.start <= date && (b.axis.includes(f.id) || b.opponents.includes(f.id))).slice(-4).map((b) => b.name).join(', ') || '—'],
    ['Outcome', (f) => f.fate ?? '—'],
  ];
  let cy = y + 76 * s;
  const els: ReactNode[] = [];
  rows.forEach(([label, get], ri) => {
    const cells = fs.map((f) => wrapText(get(f), 15.5 * s, FONT_SANS, colW - 24 * s).slice(0, 4));
    const lines = Math.max(...cells.map((c) => c.length), 1);
    const h = lines * 20 * s + 14 * s;
    if (ri % 2 === 1) els.push(<rect key={`bg${ri}`} x={x + 8 * s} y={cy - 4 * s} width={w - 16 * s} height={h} fill="rgba(0,0,0,0.035)" />);
    els.push(<text key={`l${ri}`} x={x + 24 * s} y={cy + 16 * s} fontFamily={FONT_SANS} fontWeight={600} fontSize={13 * s} letterSpacing="0.08em" fill={INK_SOFT}>{label.toUpperCase()}</text>);
    cells.forEach((c, ci) =>
      c.forEach((line, li) => (
        els.push(<text key={`c${ri}-${ci}-${li}`} x={x + 160 * s + ci * colW} y={cy + 16 * s + li * 20 * s} fontFamily={FONT_SANS} fontSize={15.5 * s} fill={INK}>{line}</text>)
      )),
    );
    cy += h;
  });
  const h = cy - y + 34 * s;
  return (
    <Card x={x} y={y} w={w} h={h}>
      {fs.map((f, i) => (
        <text key={f.id} x={x + 160 * s + i * colW} y={y + 46 * s} fontFamily={FONT_SANS} fontWeight={700} fontSize={21 * s} fill={formationColor(idx, f, date) ?? INK}>{idx.nameAt(f, date)}</text>
      ))}
      <text x={x + 24 * s} y={y + 46 * s} fontFamily={FONT_SANS} fontWeight={700} fontSize={17 * s} fill={INK}>Compare</text>
      {els}
      <text x={x + 24 * s} y={y + h - 12 * s} fontFamily={FONT_SANS} fontSize={12.5 * s} fill={INK_SOFT}>Sectors approximate{front ? ` · front as of ${formatDate(front.date, 'short')}` : ''} · Sources: {sourcesText(fs.flatMap((f) => (f.sources ?? []).map((r) => r.id)), 3)}</text>
    </Card>
  );
}

export function Legend({ x, y, state, statuses, scale, hasFront, frontUnc }: { x: number; y: number; state: PresentationState; statuses: string[]; scale: number; hasFront: boolean; frontUnc: number | null }) {
  const s = scale;
  const items: { key: string; label: string; swatch: ReactNode }[] = [];
  const sw = (key: string, el: ReactNode, label: string) => items.push({ key, label, swatch: el });
  if (hasFront && state.layers.front) sw('front', <g><rect x={0} y={-3 * s} width={34 * s} height={7 * s} fill={FRONT} opacity={0.15} /><line x1={0} y1={0} x2={34 * s} y2={0} stroke={FRONT} strokeWidth={3.2 * s} /></g>, frontUnc ? `Front line (reconstruction, ±${frontUnc} km)` : 'Front line');
  if (hasFront && state.layers.prevFront) sw('prev', <line x1={0} y1={0} x2={34 * s} y2={0} stroke={FRONT_PREV} strokeWidth={1.8 * s} strokeDasharray={`${6 * s} ${4 * s}`} />, 'Previous front line');
  if (hasFront && state.layers.held) sw('held', <rect x={0} y={-8 * s} width={34 * s} height={16 * s} fill={HELD} fillOpacity={0.3} stroke={HELD} strokeOpacity={0.4} />, 'Axis military control');
  if (state.layers.arrows) sw('arrow', <path d={`M0,${-3 * s}L${22 * s},${-4 * s}L${22 * s},${-9 * s}L${34 * s},0L${22 * s},${9 * s}L${22 * s},${4 * s}L0,${3 * s}Z`} fill={AXIS_ARROW} fillOpacity={0.85} />, 'Campaign arrow (schematic)');
  if (state.layers.arrows && state.layers.opposing) sw('sarrow', <path d={`M0,${-3 * s}L${22 * s},${-4 * s}L${22 * s},${-9 * s}L${34 * s},0L${22 * s},${9 * s}L${22 * s},${4 * s}L0,${3 * s}Z`} fill={SOVIET_RED} fillOpacity={0.85} />, 'Soviet counter-move (schematic)');
  if (state.layers.objectives) sw('obj', <circle cx={17 * s} cy={0} r={8 * s} fill="none" stroke="#6a4c93" strokeWidth={2 * s} strokeDasharray={`${3 * s} ${2 * s}`} />, 'Planned objective');
  if (state.layers.sectors) sw('sector', <rect x={0} y={-8 * s} width={34 * s} height={16 * s} fill={AXIS_ARROW} fillOpacity={0.12} stroke={AXIS_ARROW} strokeDasharray={`${5 * s} ${3 * s}`} />, 'Approximate sector');
  for (const st of statuses.slice(0, 5)) sw(`st-${st}`, <rect x={0} y={-8 * s} width={34 * s} height={16 * s} fill={STATUS_FILL[st]} stroke={CARD_EDGE} />, STATUS_LABEL[st] ?? st);
  const rowH = 26 * s;
  const w = 330 * s;
  const h = 46 * s + items.length * rowH;
  const yy = y - h;
  return (
    <Card x={x - w} y={yy} w={w} h={h}>
      <text x={x - w + 20 * s} y={yy + 30 * s} fontFamily={FONT_SANS} fontWeight={700} fontSize={14 * s} letterSpacing="0.1em" fill={INK_SOFT}>LEGEND</text>
      {items.map((it, i) => (
        <g key={it.key} transform={`translate(${x - w + 20 * s} ${yy + 52 * s + i * rowH})`}>
          {it.swatch}
          <text x={46 * s} y={5.5 * s} fontFamily={FONT_SANS} fontSize={15.5 * s} fill={INK}>{it.label}</text>
        </g>
      ))}
    </Card>
  );
}

export function SourceLine({ region, text, scale }: { region: Region; text: string; scale: number }) {
  const size = 15 * scale;
  const lines = wrapText(text, size, FONT_SANS, region.w - 80 * scale).slice(0, 2);
  const h = (lines.length * 20 + 14) * scale;
  const y = region.y + region.h - h;
  return (
    <g>
      <rect x={region.x} y={y} width={region.w} height={h} fill="#f8f5ee" fillOpacity={0.88} />
      {lines.map((l, i) => (
        <text key={i} x={region.x + 40 * scale} y={y + (20 + i * 20) * scale} fontFamily={FONT_SANS} fontSize={size} fill={INK_SOFT}>{l}</text>
      ))}
    </g>
  );
}

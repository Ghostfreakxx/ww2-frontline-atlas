'use client';
import { memo } from 'react';
import type { GeoData, FrontShape, TerritoryUnitShape } from '@/lib/map/geodata';
import { BORDER, COAST, FRONT, FRONT_PREV, HELD, LAKE, PAPER, RIVER, STATUS_FILL } from '@/lib/map/theme';

// World-space layers. These are memoised and drawn inside a single transformed <g>, so panning and
// zooming only changes one transform attribute instead of re-rendering thousands of paths.

export const BaseLayer = memo(function BaseLayer(props: {
  geo: GeoData;
  units: TerritoryUnitShape[] | undefined;
  showTerritory: boolean;
  showRelief: boolean;
  showBorders: boolean;
  showRivers: boolean;
  u: number;
  prefix: string;
}) {
  const { geo, units, showTerritory, showRelief, showBorders, showRivers, u, prefix } = props;
  const r = geo.relief;
  return (
    <g>
      <path d={geo.landD} fill={PAPER} />
      {showTerritory && units && (
        <g>
          {units.map((t) => (
            <path key={t.id} d={t.d} fill={STATUS_FILL[t.status] ?? PAPER} />
          ))}
        </g>
      )}
      {showRelief && (
        <image
          href="/geo/relief.jpg"
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          preserveAspectRatio="none"
          clipPath={`url(#${prefix}-land)`}
          style={{ mixBlendMode: 'multiply' }}
          opacity={0.92}
        />
      )}
      <path d={geo.lakesD} fill={LAKE} stroke={RIVER} strokeWidth={0.5 * u} vectorEffect="non-scaling-stroke" strokeOpacity={0.6} />
      {showRivers && (
        <g fill="none" stroke={RIVER} strokeLinejoin="round" strokeLinecap="round">
          {geo.rivers.map((rv, i) => (
            <path key={i} d={rv.d} strokeWidth={(rv.rank <= 4 ? 1.5 : rv.rank <= 7 ? 1.05 : 0.75) * u} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
      {showBorders && units ? (
        <g fill="none" stroke={BORDER} strokeLinejoin="round">
          {units.map((t) => (
            <path key={t.id} d={t.d} strokeWidth={0.9 * u} vectorEffect="non-scaling-stroke" strokeOpacity={0.85} />
          ))}
        </g>
      ) : null}
      <path d={geo.landD} fill="none" stroke={COAST} strokeWidth={0.7 * u} vectorEffect="non-scaling-stroke" />
    </g>
  );
});

export const HeldLayer = memo(function HeldLayer(props: { front: FrontShape | undefined; prefix: string; show: boolean }) {
  const { front, prefix, show } = props;
  if (!front || !show || !front.heldD) return null;
  return (
    <g>
      <path d={front.heldD} fill={HELD} fillOpacity={0.16} />
      <path d={front.heldD} fill={`url(#${prefix}-hatch)`} />
    </g>
  );
});

export const FrontLines = memo(function FrontLines(props: {
  front: FrontShape | undefined;
  prev: FrontShape | undefined;
  showPrev: boolean;
  showUncertainty: boolean;
  uncertaintyWorld: number;
  u: number;
  /** The snapshot is older than the date shown: draw it slightly faded. */
  stale?: boolean;
}) {
  const { front, prev, showPrev, showUncertainty, uncertaintyWorld, u, stale } = props;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      {showPrev && prev && prev.lines.map((l, i) => <path key={`p${i}`} d={l.d} stroke={FRONT_PREV} strokeWidth={1.6 * u} strokeDasharray={`${6 * u} ${5 * u}`} vectorEffect="non-scaling-stroke" opacity={0.75} />)}
      {front && showUncertainty && uncertaintyWorld > 0 &&
        front.lines.filter((l) => l.q !== 'c').map((l, i) => <path key={`u${i}`} d={l.d} stroke={FRONT} strokeOpacity={0.13} strokeWidth={uncertaintyWorld * 2} />)}
      {front &&
        front.lines.map((l, i) => (
          <g key={`f${i}`} opacity={stale ? 0.7 : 1}>
            <path d={l.d} stroke="#fff" strokeOpacity={0.55} strokeWidth={(l.q === 'c' ? 3 : 5.2) * u} vectorEffect="non-scaling-stroke" />
            <path
              d={l.d}
              stroke={l.q === 'c' ? '#7d5c5c' : FRONT}
              strokeWidth={(l.q === 'a' ? 3.2 : l.q === 'b' ? 2.6 : 1.8) * u}
              strokeDasharray={l.q === 'c' ? `${2 * u} ${5 * u}` : l.kind === 'secondary' ? `${8 * u} ${3 * u}` : undefined}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
    </g>
  );
});

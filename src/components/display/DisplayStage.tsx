'use client';
import { forwardRef, type ReactNode } from 'react';
import type { Camera, ISODate } from '@/lib/history/types';
import type { ConflictIndex } from '@/lib/history/query';
import { formatDate } from '@/lib/history/query';
import type { GeoData } from '@/lib/map/geodata';
import { LAYOUTS, STAGE, type PresentationState } from '@/lib/sync/state';
import { AtlasMap } from '../map/AtlasMap';
import { ComparePanel, CommanderCard, DateBlock, EventCaption, HierarchyPanel, Legend, SourceLine, TitleBlock, sourcesText, type Region } from '../panels/StagePanels';
import { FONT_SANS, PAPER } from '@/lib/map/theme';

export interface DisplayStageProps {
  idx: ConflictIndex;
  geo: GeoData;
  state: PresentationState;
  date: ISODate;
  camera: Camera;
  now: number;
  arrowBorn?: Map<string, number>;
  /** Leave the camera area transparent (OBS browser source) instead of filling it. */
  transparent?: boolean;
  /** Draw layout guides (camera area, title-safe frame). */
  guides?: boolean;
  /** Rendered width in CSS px (the stage is always 1920×1080 in its own coordinates). */
  width?: number;
  idPrefix?: string;
  children?: ReactNode;
}

/** Text for the source/uncertainty strip, assembled from what is on screen. */
export function stageSourceText(idx: ConflictIndex, state: PresentationState, date: ISODate): string {
  const parts: string[] = [];
  const front = state.layers.front ? idx.frontsAt(date)[0] : undefined;
  if (front) {
    const kind = front.confidence === 'documented' ? 'derived from documented borders' : 'reconstruction';
    parts.push(`Front line ${formatDate(front.date, 'short')}: ${kind}, ±${front.uncertaintyKm} km — ${sourcesText(front.sources.map((s) => s.id), 3)}`);
  }
  const terr = idx.territoryAt(date);
  if (state.layers.territory && terr) parts.push(`Borders: reconstruction (${terr.label.replace(/^Political (borders|control), /, '')}), ±10–20 km`);
  if (state.layers.arrows) parts.push('Arrows schematic — direction of dated advances, not unit positions');
  if (state.layers.sectors) parts.push('Sectors approximate');
  if (state.layers.relief) parts.push('Relief: Terrain Tiles (Mapzen/AWS)');
  return parts.join('  ·  ');
}

export const DisplayStage = forwardRef<SVGSVGElement, DisplayStageProps>(function DisplayStage(props, ref) {
  const { idx, geo, state, date, camera, now, arrowBorn, transparent, guides, width, idPrefix = 'stage', children } = props;
  const L = LAYOUTS[state.layout];
  const map = L.map;
  const safe = state.layout === 'map-safe';
  // Panel region: the map area, inset to the 90% title-safe frame in map-safe mode.
  const panelRegion: Region = safe ? { x: map.x + 96, y: map.y + 54, w: map.w - 192, h: map.h - 108 } : { ...map };
  // Camera bubble: bottom-row panels (caption, legend, sources) stop short of the circle.
  const bub = L.bubble;
  const bottomRegion: Region = bub ? { ...panelRegion, w: bub.cx - bub.r - 24 - panelRegion.x } : panelRegion;
  const showUi = !state.hideUi;
  const scale = 1;
  const front = idx.frontsAt(date)[0];
  const frontLabel = !state.layers.front
    ? null
    : front
      ? front.date === date
        ? 'Front line on this date'
        : `Front line as of ${formatDate(front.date, 'short')}`
      : idx.pkg.frontlines.some((f) => f.date <= date)
        ? 'No documented front line for this date'
        : null;
  const terr = geo.territories.get(idx.territoryAt(date)?.id ?? '');
  const statusOrder = ['reich', 'german-occupied', 'axis', 'soviet', 'allied', 'neutral'];
  const statuses = state.layers.territory && terr ? statusOrder.filter((s) => terr.some((u) => u.status === s)) : [];
  const sourceText = state.panels.sources ? stageSourceText(idx, state, date) : '';
  const sourceH = sourceText ? 50 : 0;

  const focus = state.focus.formations.map((id) => idx.formation(id)).filter(Boolean);
  const hierarchyOn = state.panels.hierarchy && !!state.hierarchy.rootId;
  const compareOn = state.panels.compare && focus.length >= 2;
  const commanderOn = state.panels.commander && focus.length >= 1 && !(hierarchyOn && map.w < 1500) && !compareOn;
  const cardW = map.w < 1500 ? 420 : 460;
  const topY = panelRegion.y + 40 + (state.caption ? 120 : 0);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
      width={width ?? STAGE.w}
      height={width ? (width * STAGE.h) / STAGE.w : STAGE.h}
      style={{ display: 'block' }}
      data-layout={state.layout}
    >
      {!transparent && L.camera && <rect x={L.camera.x} y={L.camera.y} width={L.camera.w} height={L.camera.h} fill="#1b1d1f" />}
      {bub && transparent && (
        <defs>
          <mask id={`${idPrefix}-bubble-hole`}>
            <rect width={STAGE.w} height={STAGE.h} fill="#fff" />
            <circle cx={bub.cx} cy={bub.cy} r={bub.r} fill="#000" />
          </mask>
        </defs>
      )}
      <g mask={bub && transparent ? `url(#${idPrefix}-bubble-hole)` : undefined}>
      <svg x={map.x} y={map.y} width={map.w} height={map.h} viewBox={`0 0 ${map.w} ${map.h}`} overflow="hidden">
        <AtlasMap idx={idx} geo={geo} state={state} date={date} camera={camera} width={map.w} height={map.h} frameH={map.h} idPrefix={idPrefix} now={now} arrowBorn={arrowBorn} />
      </svg>
      </g>
      {showUi && (
        <g>
          {state.panels.title && <TitleBlock region={panelRegion} state={state} scale={scale} />}
          {state.panels.date && <DateBlock region={panelRegion} date={date} frontLabel={frontLabel} scale={scale} />}
          {commanderOn && focus[0] && <CommanderCard x={panelRegion.x + 40} y={topY} w={cardW} idx={idx} f={focus[0]!} date={date} scale={scale} showPortrait={state.panels.portrait} />}
          {hierarchyOn && (
            <HierarchyPanel
              x={panelRegion.x + panelRegion.w - 40 - 540}
              y={panelRegion.y + 40 + (state.panels.date ? 110 : 0)}
              w={540}
              maxH={panelRegion.h - 200 - sourceH}
              idx={idx}
              rootId={state.hierarchy.rootId!}
              expanded={state.hierarchy.expanded}
              date={date}
              scale={scale}
            />
          )}
          {compareOn && <ComparePanel x={panelRegion.x + 40} y={topY} w={Math.min(panelRegion.w - 80, 1100)} idx={idx} ids={state.focus.formations} date={date} scale={scale} />}
          {state.panels.legend && !hierarchyOn && (
            <Legend x={bottomRegion.x + bottomRegion.w - (bub ? 0 : 40)} y={panelRegion.y + panelRegion.h - sourceH - 24} state={state} statuses={statuses} scale={scale} hasFront={!!front} frontUnc={front?.uncertaintyKm ?? null} alliedHeld={idx.frontsAt(date).some((f) => geo.fronts.get(f.id)?.heldSide === 'allied')} axisHeld={idx.frontsAt(date).some((f) => geo.fronts.get(f.id)?.heldSide === 'axis')} />
          )}
          {state.panels.event && !compareOn && <EventCaption region={bottomRegion} idx={idx} date={date} scale={scale} bottomOffset={sourceH} />}
          {sourceText && <SourceLine region={{ ...map, y: map.y, w: bub ? bottomRegion.w : map.w, h: map.h - (safe ? 54 : 0) }} text={sourceText} scale={scale} />}
        </g>
      )}
      <rect key={`fade-${state.transition.seq}`} className="stage-fade" x={map.x} y={map.y} width={map.w} height={map.h} fill={PAPER} pointerEvents="none" />
      <rect x={map.x} y={map.y} width={map.w} height={map.h} fill="#15171a" opacity={state.curtain ? 1 : 0} style={{ transition: 'opacity 900ms ease' }} pointerEvents="none" />
      {guides && (
        <g pointerEvents="none" fontFamily={FONT_SANS}>
          {L.camera && (
            <g>
              <rect x={L.camera.x + 1} y={L.camera.y + 1} width={L.camera.w - 2} height={L.camera.h - 2} fill="none" stroke="#e9c46a" strokeWidth={2} strokeDasharray="10 8" />
              <text x={L.camera.x + L.camera.w / 2} y={L.camera.h / 2} textAnchor="middle" fill="#e9c46a" fontSize={28}>CAMERA AREA</text>
            </g>
          )}
          {bub && (
            <g>
              <circle cx={bub.cx} cy={bub.cy} r={bub.r} fill="none" stroke="#e9c46a" strokeWidth={2} strokeDasharray="10 8" />
              <text x={bub.cx} y={bub.cy + 9} textAnchor="middle" fill="#e9c46a" fontSize={24}>CAMERA</text>
            </g>
          )}
          <rect x={96} y={54} width={1728} height={972} fill="none" stroke="#2a9d8f" strokeWidth={2} strokeDasharray="6 6" />
        </g>
      )}
      {children}
    </svg>
  );
});

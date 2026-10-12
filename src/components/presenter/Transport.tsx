'use client';
import { useMemo, useRef, useState } from 'react';
import { idx } from '@/lib/conflict';
import { addDays, daysBetween, formatDate, toTime } from '@/lib/history/query';
import type { ISODate } from '@/lib/history/types';
import { Icon } from './icons';

const SPEEDS = [1, 3, 7, 14, 30];

export type RangeMode = 'war' | 'year' | 'op';

interface Props {
  date: ISODate;
  playing: boolean;
  speed: number;
  locked: boolean;
  stepLabel: string | null;
  canPrev: boolean;
  canNext: boolean;
  operationRange: { start: ISODate; end: ISODate } | null;
  onPlay: () => void;
  onSpeed: (s: number) => void;
  onDate: (d: ISODate, final: boolean) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onPrevEvent: () => void;
  onNextEvent: () => void;
}

export function Transport(p: Props) {
  const [mode, setMode] = useState<RangeMode>('war');
  const range = useMemo(() => {
    if (mode === 'year') {
      const y = p.date.slice(0, 4);
      return { start: `${y}-01-01` as ISODate, end: `${y}-12-31` as ISODate };
    }
    if (mode === 'op' && p.operationRange) return { start: addDays(p.operationRange.start, -14), end: addDays(p.operationRange.end, 14) };
    return { start: idx.pkg.range.start, end: idx.pkg.range.end };
  }, [mode, p.date, p.operationRange]);

  return (
    <div className="transport" role="toolbar" aria-label="Timeline and playback">
      <div className="transport-buttons">
        <button className="btn big icon" onClick={p.onPrevEvent} title="Previous event" aria-label="Previous dated event"><Icon.eventPrev /></button>
        <button className="btn big icon" onClick={p.onPrevStep} disabled={!p.canPrev} title="Previous step (←)" aria-label="Previous scene step"><Icon.stepPrev /></button>
        <button className={`btn big icon ${p.playing ? 'on' : ''}`} onClick={p.onPlay} title="Play / pause (Space)" aria-label={p.playing ? 'Pause timeline' : 'Play timeline'}>
          {p.playing ? <Icon.pause /> : <Icon.play />}
        </button>
        <button className="btn big primary next-btn" onClick={p.onNextStep} disabled={!p.canNext} title="Next step (→)" aria-label="Next scene step">
          <span className="next-label">{p.stepLabel ?? 'Next'}</span>
          <Icon.stepNext />
        </button>
        <button className="btn big icon" onClick={p.onNextEvent} title="Next event" aria-label="Next dated event"><Icon.eventNext /></button>
      </div>
      <div className="transport-time">
        <div className="transport-row">
          <div className="seg" role="group" aria-label="Playback speed in days per second">
            <span className="speed-label">days/s</span>
            {SPEEDS.map((s) => (
              <button key={s} aria-pressed={p.speed === s} onClick={() => p.onSpeed(s)} aria-label={`${s} days per second`}>{s}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Timeline range">
            <button aria-pressed={mode === 'war'} onClick={() => setMode('war')}>1939–45</button>
            <button aria-pressed={mode === 'year'} onClick={() => setMode('year')}>{p.date.slice(0, 4)}</button>
            <button aria-pressed={mode === 'op'} disabled={!p.operationRange} onClick={() => setMode('op')}>Op.</button>
          </div>
          <label className="date-field">
            <span className="sr-only">Date</span>
            <input type="date" value={p.date} min={idx.pkg.range.start} max={idx.pkg.range.end} disabled={p.locked} onChange={(e) => e.target.value && p.onDate(e.target.value, true)} />
          </label>
        </div>
        <Timeline date={p.date} start={range.start} end={range.end} locked={p.locked} onDate={p.onDate} />
      </div>
    </div>
  );
}

function Timeline({ date, start, end, locked, onDate }: { date: ISODate; start: ISODate; end: ISODate; locked: boolean; onDate: (d: ISODate, final: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = daysBetween(start, end);
  const pos = (d: ISODate) => Math.max(0, Math.min(1, daysBetween(start, d) / total));
  const dragging = useRef(false);
  const fromX = (clientX: number): ISODate => {
    const r = ref.current!.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return addDays(start, Math.round(f * total));
  };
  const years: ISODate[] = [];
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)) + 1; y++) {
    const d = `${y}-01-01`;
    if (d > start && d < end) years.push(d);
  }
  const monthly = total < 500;
  const months: ISODate[] = [];
  if (monthly) {
    const t0 = new Date(toTime(start));
    for (let m = 0; m < 30; m++) {
      const d = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + m + 1, 1)).toISOString().slice(0, 10);
      if (d > end) break;
      months.push(d);
    }
  }
  const events = idx.pkg.events.filter((e) => e.date >= start && e.date <= end && (e.major || monthly));
  const fronts = idx.pkg.frontlines.filter((f) => f.date >= start && f.date <= end);
  return (
    <div
      ref={ref}
      className="timeline"
      data-locked={locked || undefined}
      onPointerDown={(e) => {
        if (locked) return;
        dragging.current = true;
        try {
          (e.target as Element).setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
        onDate(fromX(e.clientX), false);
      }}
      onPointerMove={(e) => dragging.current && onDate(fromX(e.clientX), false)}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        onDate(fromX(e.clientX), true);
      }}
      onPointerCancel={() => (dragging.current = false)}
      role="slider"
      aria-label="Timeline"
      aria-valuemin={toTime(start)}
      aria-valuemax={toTime(end)}
      aria-valuenow={toTime(date)}
      aria-valuetext={formatDate(date)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (locked) return;
        if (e.key === 'ArrowRight') onDate(addDays(date, e.shiftKey ? 30 : 1), true);
        if (e.key === 'ArrowLeft') onDate(addDays(date, e.shiftKey ? -30 : -1), true);
      }}
    >
      <div className="timeline-track" />
      {months.map((m) => (
        <div key={m} className="timeline-tick month" style={{ left: `${pos(m) * 100}%` }}>
          <span>{formatDate(m, 'month').slice(0, 3)}</span>
        </div>
      ))}
      {years.map((y) => (
        <div key={y} className="timeline-tick year" style={{ left: `${pos(y) * 100}%` }}>
          <span>{y.slice(0, 4)}</span>
        </div>
      ))}
      {fronts.map((f) => (
        <div key={f.id} className="timeline-front" style={{ left: `${pos(f.date) * 100}%` }} title={`Front snapshot: ${formatDate(f.date)}`} />
      ))}
      {events.map((e) => (
        <div key={e.id} className={`timeline-event ${e.major ? 'major' : ''}`} style={{ left: `${pos(e.date) * 100}%` }} title={`${formatDate(e.date)} — ${e.title}`} />
      ))}
      <div className="timeline-head" style={{ left: `${pos(date) * 100}%` }}>
        <div className="timeline-head-label">{formatDate(date, 'short')}</div>
      </div>
    </div>
  );
}

'use client';
import { useMemo } from 'react';
import { addDays } from '@/lib/history/query';
import { effectiveDate, type PresentationState } from '@/lib/sync/state';
import { useAnimatedCamera, useBirthTimes, useFrameClock } from '@/lib/map/useStage';
import { idx } from '@/lib/conflict';

/** Everything a live rendering of the stage needs per frame: effective date, animated camera, clocks. */
export function useStageView(state: PresentationState, serverNow: () => number, opts: { immediateCamera?: boolean } = {}) {
  const camera = useAnimatedCamera(state.camera, { immediate: opts.immediateCamera });
  const playing = state.playback.playing;
  const battlesActive = state.layers.battles && idx.battlesAt(state.date).some((b) => b.state === 'active');
  const now = useFrameClock(true, playing ? 60 : battlesActive ? 30 : 20);
  const date = playing ? effectiveDate(state, serverNow(), addDays) : state.date;
  const arrowIds = useMemo(() => (state.layers.arrows ? idx.arrowsAt(date, { windowDays: 60 }).map((a) => a.arrow.id) : []), [date, state.layers.arrows]);
  const arrowBorn = useBirthTimes(arrowIds, now);
  return { camera, date, now, arrowBorn };
}

import type { Episode, Scene } from '../../../../lib/episodes/types.ts';
import { operations, battles } from '../campaigns.ts';
import { formatDate } from '../../../../lib/history/query.ts';

const R = (...ids: string[]) => ids.map((id) => ({ id }));
const op = (id: string) => {
  const o = operations.find((x) => x.id === id);
  if (!o) throw new Error(`unknown operation ${id}`);
  return o;
};

function battleStep(opId: string, battleId: string) {
  const b = battles.find((x) => x.id === battleId);
  if (!b) throw new Error(`unknown battle ${battleId}`);
  return {
    id: `ov-${opId}-battle`,
    label: `Key battle: ${b.name}`,
    patch: { date: b.end, focus: { battleId }, camera: b.camera ? { ...b.camera, zoom: Math.min(b.camera.zoom, 5), ms: 1800 } : undefined },
  };
}

/** One scene per major campaign: opens at the start date, a build step plays the timeline to the end. */
function campaignScene(id: string, opts: { notes: string; layout?: 'split-right' | 'full'; stepTo?: string; speed?: number; battleId?: string; extraSources?: string[]; focus?: string[] }): Scene {
  const o = op(id);
  const end = opts.stepTo ?? o.end;
  return {
    id: `ov-${id}`,
    title: o.name,
    notes: opts.notes,
    sources: [...o.sources, ...(opts.extraSources ?? []).map((s) => ({ id: s }))],
    base: {
      date: o.start,
      camera: { ...o.camera, ms: 2400 },
      layout: opts.layout ?? 'split-right',
      caption: { title: o.name, subtitle: o.codename ? `${o.codename}` : '' },
      focus: { operationId: id, formations: opts.focus ?? [], dimOthers: !!opts.focus?.length },
      panels: { commander: !!opts.focus?.length },
      layers: { prevFront: true },
    },
    steps: [
      { id: `ov-${id}-play`, label: `Play to ${formatDate(end, 'short')}`, patch: { playTo: { date: end, speed: opts.speed ?? 3 } } },
      ...(opts.battleId ? [battleStep(id, opts.battleId)] : []),
    ],
  };
}

export const overviewEpisode: Episode = {
  schema: 1,
  id: 'europe-1939-1945',
  title: 'The war in Europe, 1939–1945',
  description: 'Twelve major campaigns in one sequence — a ready-made overview built from the same sourced data as the Barbarossa episode.',
  conflictId: 'ww2-europe',
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
  scenes: [
    campaignScene('poland-1939', { focus: ['de-hg-south-1939'], speed: 3, battleId: 'b-bzura', notes: 'Army Groups North (Bock) and South (Rundstedt) — not the same organisations as the Army Groups North and South of 1941. The Soviet invasion from 17 September is shown with red arrows. Borders switch to the partition of October 1939 after the fall of Warsaw.' }),
    campaignScene('france-1940', { layout: 'full', focus: ['de-hg-a-1939'], speed: 2, battleId: 'b-sedan', notes: 'Army Group A (Rundstedt) made the main effort through the Ardennes; Army Group B (Bock) drew the Allies into Belgium. The front line exists only for 10 and 21 May 1940; after Dunkirk the map shows the armistice borders.' }),
    campaignScene('britain-1940', { layout: 'full', speed: 4, battleId: 'b-britain', notes: 'An air campaign: there is no front line. Arrows show the shift of German raids from airfields (August) to London (from 7 September). Sea Lion postponed on 17 September.' }),
    campaignScene('balkans-1941', { speed: 2, battleId: 'b-crete', notes: 'Yugoslavia and Greece invaded on 6 April 1941; Crete by airborne assault from 20 May. The 12th Army later became Army Group E.' }),
    campaignScene('barbarossa', { layout: 'full', stepTo: '1941-12-05', speed: 12, focus: [], notes: 'For a full treatment use the Operation Barbarossa episode. Here: the advance from the frontier to the high-water mark of 5 December 1941.' }),
    campaignScene('moscow-counteroffensive', { focus: ['de-hg-centre'], speed: 3, battleId: 'b-moscow', notes: 'The Soviet counteroffensive from 5–6 December 1941; Hitler’s halt order (16 December) and the dismissal of Bock (19 December).' }),
    campaignScene('stalingrad', { focus: ['de-hg-b-1942'], speed: 6, battleId: 'b-uranus', notes: 'Army Group B (the former Army Group South) reached the Volga on 23 August 1942. Uranus encircled the 6th Army on 19–23 November; surrender on 2 February 1943. Front snapshots: 18 Nov 1942 only — the line disappears where no documented snapshot exists.' }),
    campaignScene('kursk', { focus: ['de-hg-centre', 'de-hg-south-1943'], speed: 2, battleId: 'b-kursk', notes: 'Operation Citadel against both shoulders of the salient from 5 July 1943; Prokhorovka 12 July; Soviet counteroffensives took Orel and Belgorod (5 August) and Kharkov (23 August).' }),
    campaignScene('normandy', { layout: 'full', focus: ['de-hg-b-1943'], speed: 2, battleId: 'b-falaise', notes: 'The lodgement of 12 June, the line before Cobra (24 July) and the pursuit to the Seine (25 August). Army Group B (Rommel, then Kluge, then Model) — a 1943 headquarters unrelated to the earlier Army Groups B.' }),
    campaignScene('bagration', { focus: ['de-hg-centre'], speed: 3, battleId: 'b-bobruisk', notes: 'Four Soviet fronts destroyed Army Group Centre between 22 June and late July 1944. Compare the lines of 22 June and 31 August 1944.' }),
    campaignScene('bulge', { layout: 'full', focus: ['de-hg-b-1943'], stepTo: '1944-12-25', speed: 1, battleId: 'b-bastogne', notes: 'Wacht am Rhein from 16 December 1944: the furthest point at Celles on 24 December; Bastogne relieved on 26 December.' }),
    campaignScene('berlin', { focus: ['de-hg-vistula'], speed: 1, battleId: 'b-berlin', notes: 'From the Oder and Neisse on 16 April 1945 to the capitulation of the Berlin garrison on 2 May. Army Group Vistula (Heinrici) held the Seelow Heights.' }),
  ],
};

import type { Formation, SourceRef, Confidence, Person } from '../../../lib/history/types.ts';

// Field armies, panzer groups, corps and divisions.
//
// Army-level records carry dated commanders and assignments. Corps and divisions are entered as an
// order-of-battle SNAPSHOT for 22 June 1941 (Glantz, Barbarossa, 2001, appendix; MGFA vol. IV). Where the
// division list of a corps is not certain it is marked 'approximate'; where it has not been entered the
// corps carries an `incomplete` note instead of guessed assignments. Later reassignments are not entered.

const OOB: SourceRef[] = [{ id: 'glantz-barbarossa' }, { id: 'gsww-4' }, { id: 'kirchubel-1941' }];
const CMD: SourceRef[] = [{ id: 'tessin' }, { id: 'mitcham-fm' }];
const D41 = '1941-06-22';

const tenure = (personId: string, from: string, to?: string, note?: string) => ({ personId, from, to, note, sources: CMD, confidence: 'documented' as Confidence, verification: 'reference-level' as const });

function army(
  id: string,
  names: { from: string; to?: string; name: string }[],
  echelon: Formation['echelon'],
  existence: Formation['existence'],
  commanders: ReturnType<typeof tenure>[],
  extra: Partial<Formation> = {},
): Formation {
  return { id, side: 'axis', nation: 'DE', echelon, names, existence, commanders, sources: [...CMD, ...OOB], ...extra };
}

// Lightweight persons for corps commanders (22 June 1941).
export const corpsCommanders: Person[] = [
  ['both', 'Kuno-Hans von Both'], ['wodrig', 'Albert Wodrig'], ['chappuis', 'Friedrich-Wilhelm von Chappuis'],
  ['brockdorff', 'Walter Graf von Brockdorff-Ahlefeldt'], ['chr-hansen', 'Christian Hansen'], ['wiktorin', 'Mauritz von Wiktorin'],
  ['heitz', 'Walter Heitz'], ['materna', 'Friedrich Materna'], ['kuntze', 'Walter Kuntze'], ['ruoff', 'Richard Ruoff'],
  ['foerster', 'Otto-Wilhelm Förster'], ['fahrmbacher', 'Wilhelm Fahrmbacher'], ['geyer', 'Hermann Geyer'], ['felber', 'Hans Felber'],
  ['schroth', 'Walter Schroth'], ['kienitz', 'Werner Kienitz'], ['koch-f', 'Friedrich Koch'], ['vierow', 'Erwin Vierow'],
  ['obstfelder', 'Hans von Obstfelder'], ['schwedler', 'Viktor von Schwedler'], ['kuebler', 'Ludwig Kübler'], ['briesen', 'Kurt von Briesen'],
  ['kortzfleisch', 'Joachim von Kortzfleisch'], ['salmuth', 'Hans von Salmuth'], ['erik-hansen', 'Erik Hansen'],
  ['paulus', 'Friedrich Paulus'],
].map(([id, name]) => ({ id, name, ranks: [], portrait: null }));

interface CorpsSpec {
  id: string;
  name: string;
  motorised?: boolean;
  commander?: string;
  divisions?: string[];
  divisionsConfidence?: Confidence;
  incomplete?: string;
  note?: string;
}

const ordinal = (n: number) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
};
const SPECIAL: Record<string, string> = {
  'ss-t': 'SS Division Totenkopf',
  'ss-r': 'SS Division Das Reich',
  'ss-lah': 'SS Leibstandarte Adolf Hitler (brigade)',
  'ss-wiking': 'SS Division Wiking',
  gd: 'Infantry Regiment Großdeutschland',
};
const KIND: Record<string, string> = { pz: 'Panzer Division', id: 'Infantry Division', idmot: 'Motorised Infantry Division', kav: 'Cavalry Division', geb: 'Mountain Division', lei: 'Light Division', sich: 'Security Division' };
const divisionName = (code: string): string => {
  if (SPECIAL[code]) return SPECIAL[code];
  const m = code.match(/^(\d+)-([a-z]+)$/);
  return m && KIND[m[2]] ? `${ordinal(Number(m[1]))} ${KIND[m[2]]}` : code;
};

const divisions = new Map<string, Formation>();
function division(code: string): string {
  const id = `de-div-${code}`;
  if (!divisions.has(id)) {
    divisions.set(id, {
      id, side: 'axis', nation: 'DE', echelon: 'division',
      names: [{ from: '1939-09-01', name: divisionName(code) }],
      existence: { from: '1939-09-01' },
      sources: OOB,
    });
  }
  return id;
}

const corpsRecords: Formation[] = [];
function corps(_armyId: string, specs: CorpsSpec[]) {
  return specs.map((c) => {
    const id = `de-corps-${c.id}`;
    const conf = c.divisionsConfidence ?? 'documented';
    corpsRecords.push({
      id, side: 'axis', nation: 'DE', echelon: 'corps',
      names: [{ from: '1939-09-01', name: c.name }],
      existence: { from: '1939-09-01' },
      commanders: c.commander ? [{ ...tenure(c.commander, D41, D41, 'Recorded for 22 June 1941 only.'), snapshot: D41 }] : [],
      subordinates: (c.divisions ?? []).map((d) => ({ id: division(d), from: D41, to: D41, snapshot: D41, confidence: conf })),
      incomplete: c.incomplete,
      summary: c.note,
      sources: OOB,
    });
    return { id, from: D41, to: D41, snapshot: D41, confidence: 'documented' as Confidence };
  });
}

// ---------------------------------------------------------------------------
// Armies and panzer groups
// ---------------------------------------------------------------------------
export const armies: Formation[] = [
  // Army Group North
  army('de-18-army', [{ from: '1939-11-05', name: '18th Army' }], 'army', { from: '1939-11-05', to: '1945-05-09' },
    [tenure('kuechler', '1939-11-05', '1942-01-16'), tenure('lindemann', '1942-01-16', '1944-03-29')],
    { color: '#3d6a8e', subordinates: corps('de-18-army', [
      { id: 'i', name: 'I Army Corps', commander: 'both', divisions: ['1-id', '11-id', '21-id'] },
      { id: 'xxvi', name: 'XXVI Army Corps', commander: 'wodrig', divisions: ['61-id', '217-id', '291-id'] },
      { id: 'xxxviii', name: 'XXXVIII Army Corps', commander: 'chappuis', divisions: ['58-id'] },
    ]), summary: 'Left wing of Army Group North: cleared Latvia and Estonia (Riga 1 July, Tallinn 28 August) and invested Leningrad from the south-west.' }),
  army('de-pzgr-4', [{ from: '1941-02-15', to: '1941-12-31', name: 'Panzer Group 4' }, { from: '1942-01-01', name: '4th Panzer Army' }], 'panzer-group', { from: '1941-02-15', to: '1945-05-08' },
    [tenure('hoepner', '1941-02-15', '1942-01-08', 'Dismissed for withdrawing without authority.')],
    { color: '#3d6a8e', subordinates: corps('de-pzgr-4', [
      { id: 'xxxxi', name: 'XXXXI Motorised Corps', motorised: true, commander: 'reinhardt-c', divisions: ['1-pz', '6-pz', '36-idmot', '269-id'], note: 'Fought the tank battle of Raseiniai (23–26 June 1941).' },
      { id: 'lvi', name: 'LVI Motorised Corps', motorised: true, commander: 'manstein', divisions: ['8-pz', '3-idmot', '290-id'], note: 'Seized the Dvina bridges at Daugavpils on 26 June 1941.' },
      { id: 'pzgr4-res', name: 'Panzer Group 4 reserve', divisions: ['ss-t'] },
    ]), summary: 'Armoured spearhead of Army Group North toward Leningrad; transferred to Army Group Centre in September 1941 for Operation Typhoon.' }),
  army('de-16-army', [{ from: '1939-10-22', name: '16th Army' }], 'army', { from: '1939-10-22', to: '1945-05-09' },
    [tenure('busch', '1939-10-22', '1943-10-12')],
    { color: '#3d6a8e', predecessor: 'de-3-army-1939', subordinates: corps('de-16-army', [
      { id: 'x', name: 'X Army Corps', commander: 'chr-hansen', divisions: ['30-id', '126-id'] },
      { id: 'xxviii', name: 'XXVIII Army Corps', commander: 'wiktorin', divisions: ['122-id', '123-id'] },
      { id: 'ii', name: 'II Army Corps', commander: 'brockdorff', divisions: ['12-id', '32-id', '121-id'] },
      { id: '16-res', name: '16th Army reserve', divisions: ['253-id'] },
    ]), summary: 'Right wing of Army Group North via Kaunas toward Lake Ilmen; its II Corps was encircled at Demyansk (February–April 1942).' }),
  // Army Group Centre
  army('de-pzgr-3', [{ from: '1940-11-16', to: '1941-12-31', name: 'Panzer Group 3' }, { from: '1942-01-01', name: '3rd Panzer Army' }], 'panzer-group', { from: '1940-11-16', to: '1945-05-03' },
    [tenure('hoth', '1940-11-16', '1941-10-05'), tenure('reinhardt', '1941-10-05', '1944-08-16')],
    { color: '#9a6a34', subordinates: corps('de-pzgr-3', [
      { id: 'xxxix', name: 'XXXIX Motorised Corps', motorised: true, commander: 'rudolf-schmidt', divisions: ['7-pz', '20-pz', '14-idmot', '20-idmot'] },
      { id: 'lvii', name: 'LVII Motorised Corps', motorised: true, commander: 'kuntzen', divisions: ['12-pz', '19-pz', '18-idmot'] },
      { id: 'v', name: 'V Army Corps', commander: 'ruoff', divisions: ['5-id', '35-id'], note: 'Attached from 9th Army for the opening phase.' },
      { id: 'vi', name: 'VI Army Corps', commander: 'foerster', divisions: ['6-id', '26-id'], note: 'Attached from 9th Army for the opening phase.' },
    ]), summary: 'Northern pincer of Army Group Centre: Suwałki – Vilnius – Minsk (closed 28 June), then Vitebsk and the northern arm of the Smolensk encirclement.' }),
  army('de-9-army', [{ from: '1940-05-15', name: '9th Army' }], 'army', { from: '1940-05-15', to: '1945-05-08' },
    [tenure('strauss', '1940-05-30', '1942-01-15'), tenure('model', '1942-01-16', '1943-11-04')],
    { color: '#9a6a34', subordinates: corps('de-9-army', [
      { id: 'viii', name: 'VIII Army Corps', commander: 'heitz', divisions: ['8-id', '28-id', '161-id'] },
      { id: 'xx', name: 'XX Army Corps', commander: 'materna', divisions: ['162-id', '256-id'] },
      { id: 'xxxxii', name: 'XXXXII Army Corps', commander: 'kuntze', divisions: ['87-id', '102-id', '129-id'] },
    ]), summary: 'Infantry army forming the inner northern arm of the Białystok encirclement; later held the Rzhev salient (1942–43).' }),
  army('de-4-army', [{ from: '1939-08-26', name: '4th Army' }], 'army', { from: '1939-08-26', to: '1945-05-08' },
    [tenure('kluge', '1939-08-26', '1941-12-18'), tenure('heinrici', '1942-01-20', '1944-06-04')],
    { color: '#9a6a34', subordinates: corps('de-4-army', [
      { id: 'vii', name: 'VII Army Corps', commander: 'fahrmbacher', divisions: ['7-id', '23-id', '258-id', '268-id'] },
      { id: 'ix', name: 'IX Army Corps', commander: 'geyer', divisions: ['137-id', '263-id', '292-id'] },
      { id: 'xiii', name: 'XIII Army Corps', commander: 'felber', divisions: ['17-id', '78-id'] },
      { id: 'xxxxiii', name: 'XXXXIII Army Corps', commander: 'heinrici', divisions: ['131-id', '134-id', '252-id'], divisionsConfidence: 'approximate' },
    ]), summary: 'Inner southern arm of the Białystok encirclement; in 1939 it crossed the Polish Corridor and in 1940 it advanced through the Ardennes north of Sedan.' }),
  army('de-pzgr-2', [{ from: '1940-11-16', to: '1941-10-04', name: 'Panzer Group 2' }, { from: '1941-10-05', name: '2nd Panzer Army' }], 'panzer-group', { from: '1940-11-16', to: '1945-05-08' },
    [tenure('guderian', '1940-11-16', '1941-12-25'), tenure('rudolf-schmidt', '1941-12-26', '1943-04-10')],
    { color: '#9a6a34', subordinates: corps('de-pzgr-2', [
      { id: 'xxiv', name: 'XXIV Motorised Corps', motorised: true, commander: 'geyr', divisions: ['3-pz', '4-pz', '10-idmot', '1-kav', '267-id'] },
      { id: 'xxxxvi', name: 'XXXXVI Motorised Corps', motorised: true, commander: 'vietinghoff', divisions: ['10-pz', 'ss-r', 'gd'] },
      { id: 'xxxxvii', name: 'XXXXVII Motorised Corps', motorised: true, commander: 'lemelsen', divisions: ['17-pz', '18-pz', '29-idmot', '167-id'] },
      { id: 'xii', name: 'XII Army Corps', commander: 'schroth', divisions: ['31-id', '34-id', '45-id'], divisionsConfidence: 'approximate', note: 'The 45th Infantry Division assaulted the Brest fortress (22 June – c. 30 June 1941).' },
    ]), summary: 'Southern pincer of Army Group Centre: Brest – Slonim – Minsk, Bobruisk and the Dnieper, Smolensk and Yelnya; turned south to Kiev (25 Aug – 16 Sep), then attacked Orel, Bryansk and Tula in Typhoon.' }),
  army('de-2-army', [{ from: '1939-10-20', name: '2nd Army' }], 'army', { from: '1939-10-20', to: '1945-05-08' },
    [tenure('weichs', '1939-10-20', '1942-07-15')],
    { color: '#9a6a34', predecessor: 'de-8-army-1939', incomplete: 'Corps and divisions for late June 1941 not entered.', summary: 'Committed from OKH reserve in late June 1941 on the southern flank of Army Group Centre (Gomel, then south toward Kiev).' }),
  // Army Group South
  army('de-6-army', [{ from: '1939-10-10', name: '6th Army' }], 'army', { from: '1939-10-10', to: '1943-02-02' },
    [tenure('reichenau', '1939-10-10', '1941-12-01'), tenure('paulus', '1942-01-05', '1943-01-31')],
    { color: '#6b7f3c', predecessor: 'de-10-army-1939', subordinates: corps('de-6-army', [
      { id: 'xvii', name: 'XVII Army Corps', commander: 'kienitz', divisions: ['56-id', '62-id'], divisionsConfidence: 'approximate' },
      { id: 'xxxxiv', name: 'XXXXIV Army Corps', commander: 'koch-f', divisions: ['9-id', '297-id'], divisionsConfidence: 'approximate' },
      { id: 'lv', name: 'LV Army Corps', commander: 'vierow', divisions: ['168-id'], divisionsConfidence: 'approximate' },
      { id: 'xxix', name: 'XXIX Army Corps', commander: 'obstfelder', incomplete: 'Division assignments for 22 June 1941 not yet entered.' },
    ]), lineage: [{ date: '1943-02-02', type: 'destroyed', text: 'Destroyed at Stalingrad; a new 6th Army was formed in March 1943.', sources: [{ id: 'glantz-stalingrad' }], confidence: 'documented' }],
    summary: 'Infantry army of Army Group South: Lutsk – Rovno – Zhitomir, Kiev (19 Sep 1941), Kharkov (24 Oct 1941). Destroyed at Stalingrad in 1943.' }),
  army('de-pzgr-1', [{ from: '1940-11-16', to: '1941-10-24', name: 'Panzer Group 1' }, { from: '1941-10-25', name: '1st Panzer Army' }], 'panzer-group', { from: '1940-11-16', to: '1945-05-09' },
    [tenure('kleist', '1940-11-16', '1942-11-21')],
    { color: '#6b7f3c', subordinates: corps('de-pzgr-1', [
      { id: 'iii-mot', name: 'III Motorised Corps', motorised: true, commander: 'mackensen', divisions: ['13-pz', '14-pz'], divisionsConfidence: 'approximate', incomplete: 'Attached infantry divisions not entered.' },
      { id: 'xxxxviii', name: 'XXXXVIII Motorised Corps', motorised: true, commander: 'kempf', divisions: ['11-pz', '16-pz'], divisionsConfidence: 'approximate', incomplete: 'Attached infantry divisions not entered.', note: 'Fought the Soviet mechanised counterattacks at Dubno–Brody (23–30 June 1941).' },
      { id: 'xiv-mot', name: 'XIV Motorised Corps (second echelon)', motorised: true, commander: 'wietersheim', divisions: ['9-pz', '16-idmot', 'ss-lah', 'ss-wiking'], divisionsConfidence: 'approximate' },
    ]), summary: 'Armoured spearhead of Army Group South: Lutsk – Dubno – Zhitomir, the Uman encirclement, the Kremenchug bridgehead and link-up at Lokhvitsa (Kiev pocket), the Sea of Azov and Rostov.' }),
  army('de-17-army', [{ from: '1940-12-10', name: '17th Army' }], 'army', { from: '1940-12-10', to: '1945-05-08' },
    [tenure('stuelpnagel', '1940-12-10', '1941-10-05'), tenure('hoth', '1941-10-05', '1942-04-20')],
    { color: '#6b7f3c', subordinates: corps('de-17-army', [
      { id: 'iv', name: 'IV Army Corps', commander: 'schwedler', divisions: ['24-id', '71-id', '262-id', '295-id', '296-id'], divisionsConfidence: 'approximate' },
      { id: 'xxxxix', name: 'XXXXIX Mountain Corps', commander: 'kuebler', divisions: ['1-geb', '68-id', '257-id'], divisionsConfidence: 'approximate' },
      { id: 'lii', name: 'LII Army Corps', commander: 'briesen', incomplete: 'Division assignments for 22 June 1941 not yet entered.' },
    ]), summary: 'Attacked from the San toward Lwów (30 June), then Vinnitsa and the Uman encirclement.' }),
  army('de-11-army', [{ from: '1940-10-05', name: '11th Army' }], 'army', { from: '1940-10-05', to: '1942-11-26' },
    [tenure('schobert', '1940-10-05', '1941-09-12', 'Killed in action.'), tenure('manstein', '1941-09-17', '1942-11-26')],
    { color: '#6b7f3c', successor: 'de-hg-don', subordinates: corps('de-11-army', [
      { id: 'xi', name: 'XI Army Corps', commander: 'kortzfleisch', divisions: ['76-id', '239-id'], divisionsConfidence: 'approximate' },
      { id: 'xxx', name: 'XXX Army Corps', commander: 'salmuth', divisions: ['198-id'], divisionsConfidence: 'approximate' },
      { id: 'liv', name: 'LIV Army Corps', commander: 'erik-hansen', divisions: ['50-id', '170-id'], divisionsConfidence: 'approximate' },
    ]), summary: 'German army in Romania attacking with the Romanian 3rd and 4th Armies across the Prut (from 2 July 1941); conquered the Crimea except Sevastopol (Oct–Nov 1941) and took Sevastopol in July 1942. Its headquarters became Army Group Don.' }),
  // 1939–1940 armies referenced by army-group histories
  army('de-3-army-1939', [{ from: '1939-08-26', to: '1939-10-21', name: '3rd Army' }], 'army', { from: '1939-08-26', to: '1939-10-21' },
    [tenure('kuechler', '1939-08-26', '1939-10-21')], { color: '#58708a', successor: 'de-16-army', summary: 'Attacked south from East Prussia toward the Narew and Warsaw in September 1939. Its headquarters became the 16th Army (sources differ on the exact lineage).' }),
  army('de-8-army-1939', [{ from: '1939-08-26', to: '1939-10-19', name: '8th Army' }], 'army', { from: '1939-08-26', to: '1939-10-19' },
    [tenure('blaskowitz', '1939-08-26', '1939-10-19')], { color: '#6b7f3c', successor: 'de-2-army', summary: 'Left wing of Army Group South in Poland; bore the Polish counterattack on the Bzura (9–19 September 1939).' }),
  army('de-10-army-1939', [{ from: '1939-08-26', to: '1939-10-09', name: '10th Army' }], 'army', { from: '1939-08-26', to: '1939-10-09' },
    [tenure('reichenau', '1939-08-26', '1939-10-09')], { color: '#6b7f3c', successor: 'de-6-army', summary: 'Main armoured army of the Polish campaign, reaching the outskirts of Warsaw on 8 September 1939.' }),
  army('de-14-army-1939', [{ from: '1939-08-26', to: '1939-10-12', name: '14th Army' }], 'army', { from: '1939-08-26', to: '1939-10-12' },
    [tenure('list', '1939-08-26', '1939-10-12')], { color: '#6b7f3c', successor: 'de-12-army', summary: 'Attacked from Silesia and Slovakia via Kraków toward the San and Lwów (September 1939).' }),
  army('de-12-army', [{ from: '1939-10-13', name: '12th Army' }], 'army', { from: '1939-10-13', to: '1942-12-31' },
    [tenure('list', '1939-10-13', '1941-10-15')], { color: '#7a4f7a', predecessor: 'de-14-army-1939', successor: 'de-hg-e', summary: 'Followed Panzer Group Kleist through the Ardennes (1940); invaded Yugoslavia and Greece from Bulgaria (April 1941). Became Army Group E in January 1943.' }),
  army('de-pzgr-kleist-1940', [{ from: '1940-03-05', to: '1940-06-30', name: 'Panzer Group Kleist' }], 'panzer-group', { from: '1940-03-05', to: '1940-06-30' },
    [tenure('kleist', '1940-03-05', '1940-06-30')], { color: '#7a4f7a', summary: 'Five panzer divisions (Guderian’s XIX and Reinhardt’s XXXXI Corps) that broke through at Sedan on 13–14 May 1940 and reached the Channel at Abbeville on 20 May.' }),
  // Allied (Axis-partner) formations referenced in Army Group South
  { id: 'ro-3-army', side: 'axis', nation: 'RO', echelon: 'army', names: [{ from: '1941-06-22', name: 'Romanian 3rd Army' }], existence: { from: '1941-06-22', to: '1944-08-23' }, color: '#8a7a3c', summary: 'Recovered Northern Bukovina (July 1941); later fought in the Sea of Azov battle and on the Don flank at Stalingrad, where it was broken on 19 November 1942.', sources: [{ id: 'gsww-4' }, { id: 'glantz-house' }] },
  { id: 'ro-4-army', side: 'axis', nation: 'RO', echelon: 'army', names: [{ from: '1941-06-22', name: 'Romanian 4th Army' }], existence: { from: '1941-06-22', to: '1944-08-23' }, color: '#8a7a3c', summary: 'Recovered Bessarabia and besieged Odessa (8 August – 16 October 1941).', sources: [{ id: 'gsww-4' }, { id: 'glantz-house' }] },
  { id: 'hu-carpathian-group', side: 'axis', nation: 'HU', echelon: 'army', names: [{ from: '1941-06-27', name: 'Hungarian Carpathian Group' }], existence: { from: '1941-06-27', to: '1941-11-30' }, color: '#8a6a3c', summary: 'Hungary declared war on 27 June 1941; its Carpathian Group (incl. the Mobile Corps) advanced into Galicia and Ukraine alongside the 17th Army.', sources: [{ id: 'gsww-4' }] },
];

export const oob1941: Formation[] = [...armies, ...corpsRecords, ...divisions.values()];

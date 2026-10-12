import type { Formation, Person, SourceRef } from '../../../lib/history/types.ts';

// Opposing forces: Soviet fronts (army-group equivalents) and Western Allied army groups.
// Soviet front commanders follow Glantz & House, When Titans Clashed (appendix tables) and Erickson.

const SU: SourceRef[] = [{ id: 'glantz-house' }, { id: 'erickson-road-stalingrad' }];
const SU2: SourceRef[] = [{ id: 'glantz-house' }, { id: 'erickson-road-berlin' }];
const AL: SourceRef[] = [{ id: 'pogue-supreme' }, { id: 'macdonald-last' }];
const t = (personId: string, from: string, to?: string, note?: string, sources: SourceRef[] = SU) => ({ personId, from, to, note, sources, confidence: 'documented' as const, verification: 'reference-level' as const });

const P = (id: string, name: string, rank: string, from = '1940-06-04'): Person => ({ id, name, ranks: [{ from, rank }], portrait: null });
export const opposingPeople: Person[] = [
  P('m-popov', 'Markian Popov', 'Lieutenant General'),
  P('f-kuznetsov', 'Fyodor Kuznetsov', 'Colonel General'),
  P('sobennikov', 'Pyotr Sobennikov', 'Major General'),
  P('kurochkin', 'Pavel Kurochkin', 'Lieutenant General'),
  P('pavlov', 'Dmitry Pavlov', 'Army General'),
  P('yeremenko', 'Andrei Yeremenko', 'Lieutenant General'),
  P('timoshenko', 'Semyon Timoshenko', 'Marshal of the Soviet Union'),
  P('konev', 'Ivan Konev', 'Colonel General'),
  P('zhukov', 'Georgy Zhukov', 'Army General'),
  P('kirponos', 'Mikhail Kirponos', 'Colonel General'),
  P('tyulenev', 'Ivan Tyulenev', 'Army General'),
  P('ryabyshev', 'Dmitry Ryabyshev', 'Lieutenant General'),
  P('cherevichenko', 'Yakov Cherevichenko', 'Colonel General'),
  P('voroshilov', 'Kliment Voroshilov', 'Marshal of the Soviet Union'),
  P('fedyuninsky', 'Ivan Fedyuninsky', 'Major General'),
  P('khozin', 'Mikhail Khozin', 'Lieutenant General'),
  P('govorov', 'Leonid Govorov', 'Lieutenant General'),
  P('budyonny', 'Semyon Budyonny', 'Marshal of the Soviet Union'),
  P('meretskov', 'Kirill Meretskov', 'Army General'),
  P('rokossovsky', 'Konstantin Rokossovsky', 'Lieutenant General'),
  P('vatutin', 'Nikolai Vatutin', 'Lieutenant General'),
  P('chernyakhovsky', 'Ivan Chernyakhovsky', 'Colonel General'),
  P('bagramyan', 'Ivan Bagramyan', 'Army General'),
  P('malinovsky', 'Rodion Malinovsky', 'Army General'),
  P('tolbukhin', 'Fyodor Tolbukhin', 'Army General'),
  P('montgomery', 'Bernard Montgomery', 'General / Field Marshal (from 1 Sep 1944)'),
  P('bradley', 'Omar Bradley', 'Lieutenant General / General (from Mar 1945)'),
  P('devers', 'Jacob Devers', 'Lieutenant General / General (from Mar 1945)'),
  P('alexander', 'Harold Alexander', 'General / Field Marshal'),
  P('clark', 'Mark Clark', 'General'),
  P('eisenhower', 'Dwight D. Eisenhower', 'General of the Army'),
];

// Approximate front zones on the outbreak of war (from the military districts' areas), for the opposing-forces layer.
const SEC: SourceRef[] = [{ id: 'glantz-barbarossa' }, { id: 'glantz-house' }, { id: 'atlas-reconstruction' }];
const zone = (from: string, to: string, ring: [number, number][]) => ({ from, to, label: 'Approximate front zone at the outbreak of war', ring, sources: SEC, confidence: 'approximate' as const, verification: 'reference-level' as const });

export const sovietFronts: Formation[] = [
  {
    id: 'su-northern-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east',
    names: [{ from: '1941-06-24', to: '1941-08-23', name: 'Northern Front' }],
    existence: { from: '1941-06-24', to: '1941-08-23' },
    commanders: [t('m-popov', '1941-06-24', '1941-08-23')],
    sectors: [zone('1941-06-24', '1941-07-10', [[27.8, 60.55], [28.4, 59.7], [30.6, 59.55], [33.5, 60.2], [35.5, 61.5], [36.0, 64.5], [34.5, 66.5], [33.5, 69.3], [31.0, 69.6], [29.6, 67.5], [30.2, 64.5], [31.3, 62.6], [29.3, 61.3]])],
    lineage: [
      { date: '1941-06-24', type: 'formed', text: 'Formed from the Leningrad Military District (7th, 14th and 23rd Armies).', sources: SU, confidence: 'documented' },
      { date: '1941-08-23', type: 'split', text: 'Split into the Leningrad and Karelian Fronts.', related: ['su-leningrad-front'], sources: SU, confidence: 'documented' },
    ],
    summary: 'Defended Leningrad, Karelia and the Murmansk region against Finnish and German forces.',
    sources: SU,
  },
  {
    id: 'su-leningrad-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east',
    names: [{ from: '1941-08-27', name: 'Leningrad Front' }],
    existence: { from: '1941-08-27', to: '1945-05-09' },
    commanders: [t('m-popov', '1941-08-27', '1941-09-05'), t('voroshilov', '1941-09-05', '1941-09-13'), t('zhukov', '1941-09-13', '1941-10-07'), t('fedyuninsky', '1941-10-08', '1941-10-26'), t('khozin', '1941-10-27', '1942-06-09'), t('govorov', '1942-06-10', '1945-05-09')],
    summary: 'Defended besieged Leningrad (8 September 1941 – 27 January 1944).',
    sources: [...SU, { id: 'glantz-leningrad' }],
  },
  {
    id: 'su-northwestern-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east',
    names: [{ from: '1941-06-22', name: 'Northwestern Front' }],
    existence: { from: '1941-06-22', to: '1943-11-20' },
    commanders: [t('f-kuznetsov', '1941-06-22', '1941-07-03'), t('sobennikov', '1941-07-04', '1941-08-23'), t('kurochkin', '1941-08-23', '1942-10-05')],
    subordinates: [{ id: 'su-8-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-11-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-27-army', from: '1941-06-22', snapshot: '1941-06-22' }],
    sectors: [zone('1941-06-22', '1941-07-10', [[21.1, 55.9], [22.6, 54.45], [24.6, 54.85], [26.5, 55.6], [28.2, 56.1], [28.0, 57.6], [27.6, 58.9], [24.0, 59.45], [21.8, 58.8], [21.0, 57.4]])],
    lineage: [{ date: '1941-06-22', type: 'formed', text: 'Formed from the Baltic Special Military District on the outbreak of war.', sources: SU, confidence: 'documented' }],
    summary: 'Opposed Army Group North in the Baltic states, then held the Lake Ilmen – Demyansk sector.',
    sources: SU,
  },
  {
    id: 'su-western-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east',
    names: [{ from: '1941-06-22', name: 'Western Front' }],
    existence: { from: '1941-06-22', to: '1944-04-24' },
    commanders: [
      t('pavlov', '1941-06-22', '1941-06-30', 'Arrested and executed (July 1941).'),
      t('yeremenko', '1941-06-30', '1941-07-02'),
      t('timoshenko', '1941-07-02', '1941-07-19'),
      t('yeremenko', '1941-07-19', '1941-07-29'),
      t('timoshenko', '1941-07-30', '1941-09-12'),
      t('konev', '1941-09-12', '1941-10-10'),
      t('zhukov', '1941-10-10', '1942-08-26'),
    ],
    subordinates: [{ id: 'su-3-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-10-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-4-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-13-army', from: '1941-06-22', snapshot: '1941-06-22' }],
    sectors: [zone('1941-06-22', '1941-07-10', [[22.6, 54.45], [24.6, 54.85], [26.5, 55.6], [28.2, 56.1], [30.8, 55.9], [31.4, 53.6], [30.8, 52.1], [28.5, 52.0], [26.2, 52.05], [24.6, 51.75], [23.9, 51.6], [23.4, 52.3], [22.4, 53.0], [22.7, 53.9]])],
    lineage: [{ date: '1941-06-22', type: 'formed', text: 'Formed from the Western Special Military District.', sources: SU, confidence: 'documented' }],
    summary: 'Destroyed in the Białystok–Minsk pockets (June–July 1941), rebuilt for Smolensk, encircled again at Vyazma (October 1941); under Zhukov it defended Moscow and led the December counteroffensive.',
    sources: [...SU, { id: 'stahel-typhoon' }],
  },
  {
    id: 'su-reserve-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east',
    names: [{ from: '1941-07-30', to: '1941-10-10', name: 'Reserve Front' }],
    existence: { from: '1941-07-30', to: '1941-10-10' },
    commanders: [t('zhukov', '1941-07-30', '1941-09-12'), t('budyonny', '1941-09-13', '1941-10-08'), t('zhukov', '1941-10-08', '1941-10-10')],
    summary: 'Recaptured the Yelnya salient (30 August – 8 September 1941); largely destroyed at Vyazma and merged into the Western Front.',
    sources: SU,
  },
  {
    id: 'su-bryansk-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east',
    names: [{ from: '1941-08-16', to: '1941-11-10', name: 'Bryansk Front' }],
    existence: { from: '1941-08-16', to: '1941-11-10' },
    commanders: [t('yeremenko', '1941-08-16', '1941-10-13', 'Wounded.')],
    summary: 'Tried to stop Guderian’s turn south (August–September 1941); encircled at Bryansk in October.',
    sources: SU,
  },
  {
    id: 'su-kalinin-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east',
    names: [{ from: '1941-10-19', name: 'Kalinin Front' }],
    existence: { from: '1941-10-19', to: '1943-10-20' },
    commanders: [t('konev', '1941-10-19', '1942-08-26')],
    summary: 'Formed north of Moscow after Kalinin fell; retook Kalinin on 16 December 1941.',
    sources: SU,
  },
  {
    id: 'su-southwestern-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east',
    names: [{ from: '1941-06-22', name: 'Southwestern Front' }],
    existence: { from: '1941-06-22', to: '1943-10-20' },
    commanders: [t('kirponos', '1941-06-22', '1941-09-20', 'Killed during the break-out from the Kiev encirclement.'), t('timoshenko', '1941-09-30', '1941-12-18')],
    subordinates: [{ id: 'su-5-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-6-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-26-army', from: '1941-06-22', snapshot: '1941-06-22' }, { id: 'su-12-army', from: '1941-06-22', snapshot: '1941-06-22' }],
    sectors: [zone('1941-06-22', '1941-07-10', [[23.9, 51.6], [24.6, 51.75], [26.2, 52.05], [28.5, 52.0], [30.8, 52.1], [31.4, 49.6], [28.4, 48.4], [26.6, 48.25], [24.7, 48.0], [22.8, 49.0], [22.8, 49.8], [23.9, 50.5]])],
    lineage: [{ date: '1941-06-22', type: 'formed', text: 'Formed from the Kiev Special Military District — the strongest Soviet grouping in June 1941.', sources: SU, confidence: 'documented' }],
    summary: 'Fought the armoured battles of Dubno–Brody; most of the front was destroyed in the Kiev encirclement (September 1941), the largest of the war.',
    sources: [...SU, { id: 'stahel-kiev' }],
  },
  {
    id: 'su-southern-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east',
    names: [{ from: '1941-06-25', name: 'Southern Front' }],
    existence: { from: '1941-06-25', to: '1943-10-20' },
    commanders: [t('tyulenev', '1941-06-25', '1941-08-30', 'Wounded.'), t('ryabyshev', '1941-08-30', '1941-10-05'), t('cherevichenko', '1941-10-05', '1941-12-24')],
    subordinates: [{ id: 'su-9-army', from: '1941-06-25', snapshot: '1941-06-25' }, { id: 'su-18-army', from: '1941-06-25', snapshot: '1941-06-25' }],
    sectors: [zone('1941-06-25', '1941-07-10', [[26.6, 48.25], [28.4, 48.4], [31.4, 49.6], [32.2, 46.6], [30.0, 45.4], [28.2, 45.45], [28.1, 47.1], [26.8, 48.1]])],
    summary: 'Defended Bessarabia and southern Ukraine; retook Rostov on 29 November 1941.',
    sources: SU,
  },
  {
    id: 'su-volkhov-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east',
    names: [{ from: '1941-12-17', name: 'Volkhov Front' }],
    existence: { from: '1941-12-17', to: '1944-02-15' },
    commanders: [t('meretskov', '1941-12-17', '1944-02-15')],
    summary: 'Formed after the Tikhvin counteroffensive to break the Leningrad blockade from the east.',
    sources: SU,
  },
  // Later-war fronts used in major-campaign scenes
  { id: 'su-don-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1942-09-28', to: '1943-02-15', name: 'Don Front' }], existence: { from: '1942-09-28', to: '1943-02-15' }, commanders: [t('rokossovsky', '1942-09-30', '1943-02-15')], summary: 'Northern pincer of Operation Uranus and reduction of the Stalingrad pocket (Operation Ring).', sources: [{ id: 'glantz-stalingrad' }] },
  { id: 'su-central-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1943-02-15', to: '1943-10-20', name: 'Central Front' }], existence: { from: '1943-02-15', to: '1943-10-20' }, commanders: [t('rokossovsky', '1943-02-15', '1943-10-20', undefined, [{ id: 'glantz-kursk' }])], summary: 'Defended the northern face of the Kursk salient against Model’s 9th Army (July 1943).', sources: [{ id: 'glantz-kursk' }] },
  { id: 'su-voronezh-front', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east', names: [{ from: '1942-07-07', to: '1943-10-20', name: 'Voronezh Front' }], existence: { from: '1942-07-07', to: '1943-10-20' }, commanders: [t('vatutin', '1943-03-28', '1943-10-20', undefined, [{ id: 'glantz-kursk' }])], summary: 'Defended the southern face of the Kursk salient (Prokhorovka, 12 July 1943).', sources: [{ id: 'glantz-kursk' }] },
  { id: 'su-1-belorussian', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1944-02-24', name: '1st Belorussian Front' }], existence: { from: '1944-02-24', to: '1945-06-10' }, commanders: [t('rokossovsky', '1944-02-24', '1944-11-15', undefined, SU2), t('zhukov', '1944-11-16', '1945-06-10', undefined, SU2)], summary: 'Southern wing of Bagration (Bobruisk); led the Vistula–Oder operation and stormed Berlin from the Oder (Seelow Heights).', sources: [...SU2, { id: 'zaloga-bagration' }, { id: 'beevor-berlin' }] },
  { id: 'su-3-belorussian', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east', names: [{ from: '1944-04-24', name: '3rd Belorussian Front' }], existence: { from: '1944-04-24', to: '1945-08-15' }, commanders: [t('chernyakhovsky', '1944-04-24', '1945-02-18', 'Killed in action.', SU2)], summary: 'Northern wing of Bagration (Vitebsk–Minsk); invaded East Prussia.', sources: [...SU2, { id: 'zaloga-bagration' }] },
  { id: 'su-1-baltic', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1943-10-20', name: '1st Baltic Front' }], existence: { from: '1943-10-20', to: '1945-02-24' }, commanders: [t('bagramyan', '1943-11-19', '1945-02-24', undefined, SU2)], summary: 'Vitebsk encirclement (Bagration); reached the Baltic near Memel in October 1944, cutting off Army Group North.', sources: SU2 },
  { id: 'su-1-ukrainian', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1943-10-20', name: '1st Ukrainian Front' }], existence: { from: '1943-10-20', to: '1945-06-10' }, commanders: [t('vatutin', '1943-10-20', '1944-03-01', 'Mortally wounded by Ukrainian nationalist insurgents.', SU2), t('zhukov', '1944-03-02', '1944-05-24', undefined, SU2), t('konev', '1944-05-24', '1945-06-10', undefined, SU2)], summary: 'Kiev (Nov 1943), Lvov–Sandomierz (1944), Vistula–Oder and the southern assault on Berlin (1945).', sources: SU2 },
  { id: 'su-2-ukrainian', side: 'soviet', nation: 'SU', echelon: 'front', color: '#b0554a', theatre: 'east', names: [{ from: '1943-10-20', name: '2nd Ukrainian Front' }], existence: { from: '1943-10-20', to: '1945-06-10' }, commanders: [t('konev', '1943-10-20', '1944-05-21', undefined, SU2), t('malinovsky', '1944-05-22', '1945-06-10', undefined, SU2)], summary: 'Korsun pocket (1944), Jassy–Kishinev, Budapest.', sources: SU2 },
  { id: 'su-3-ukrainian', side: 'soviet', nation: 'SU', echelon: 'front', color: '#a3473f', theatre: 'east', names: [{ from: '1943-10-20', name: '3rd Ukrainian Front' }], existence: { from: '1943-10-20', to: '1945-06-15' }, commanders: [t('malinovsky', '1943-10-20', '1944-05-15', undefined, SU2), t('tolbukhin', '1944-05-15', '1945-06-15', undefined, SU2)], summary: 'Jassy–Kishinev, Belgrade, Lake Balaton and Vienna.', sources: SU2 },
  // Soviet armies of 22 June 1941 (names only)
  ...[
    ['su-8-army', '8th Army'], ['su-11-army', '11th Army'], ['su-27-army', '27th Army'],
    ['su-3-army', '3rd Army'], ['su-10-army', '10th Army'], ['su-4-army', '4th Army'], ['su-13-army', '13th Army'],
    ['su-5-army', '5th Army'], ['su-6-army', '6th Army'], ['su-26-army', '26th Army'], ['su-12-army', '12th Army'],
    ['su-9-army', '9th Army'], ['su-18-army', '18th Army'],
  ].map(([id, name]): Formation => ({ id, side: 'soviet', nation: 'SU', echelon: 'army', names: [{ from: '1941-06-22', name }], existence: { from: '1941-06-22' }, sources: [{ id: 'glantz-barbarossa' }] })),
];

export const alliedArmyGroups: Formation[] = [
  { id: 'al-21-ag', side: 'allied', nation: 'UK', echelon: 'army-group', color: '#3a5f8f', theatre: 'west', names: [{ from: '1943-07-15', name: '21st Army Group' }], existence: { from: '1943-07-15', to: '1945-08-25' }, commanders: [t('montgomery', '1944-01-02', '1945-08-25', 'Also commanded all Allied ground forces in Normandy until 1 September 1944.', AL)], operations: ['normandy', 'market-garden', 'rhine-1945'], summary: 'British–Canadian army group (with US armies attached at times): Normandy beaches, Caen, Antwerp, Market Garden, the Rhine crossing and northern Germany.', sources: [{ id: 'harrison-cca' }, ...AL] },
  { id: 'al-12-ag', side: 'allied', nation: 'US', echelon: 'army-group', color: '#41658f', theatre: 'west', names: [{ from: '1944-08-01', name: '12th Army Group' }], existence: { from: '1944-08-01', to: '1945-07-31' }, commanders: [t('bradley', '1944-08-01', '1945-07-31', undefined, AL)], operations: ['normandy', 'bulge', 'ruhr-pocket'], summary: 'Largest American field command (up to four armies): breakout from Normandy, the Bulge, the Ruhr encirclement and the drive to the Elbe.', sources: [{ id: 'blumenson-breakout' }, ...AL] },
  { id: 'al-6-ag', side: 'allied', nation: 'US', echelon: 'army-group', color: '#5a7aa0', theatre: 'west', names: [{ from: '1944-09-15', name: '6th Army Group' }], existence: { from: '1944-09-15', to: '1945-07-31' }, commanders: [t('devers', '1944-09-15', '1945-07-31', undefined, AL)], operations: ['dragoon', 'colmar-1945'], summary: 'US 7th Army and French 1st Army, from southern France to Alsace, Bavaria and Austria.', sources: AL },
  { id: 'al-15-ag', side: 'allied', nation: 'UK', echelon: 'army-group', color: '#4a6a8a', theatre: 'italy', names: [{ from: '1943-07-10', to: '1944-03-08', name: '15th Army Group' }, { from: '1944-03-09', to: '1944-12-11', name: 'Allied Armies in Italy' }, { from: '1944-12-12', name: '15th Army Group' }], existence: { from: '1943-07-10', to: '1945-07-15' }, commanders: [t('alexander', '1943-07-10', '1944-12-11', undefined, AL), t('clark', '1944-12-12', '1945-07-15', undefined, AL)], operations: ['italy-1943', 'anzio', 'gothic-line'], summary: 'US 5th and British 8th Armies in Sicily and Italy.', sources: AL },
];

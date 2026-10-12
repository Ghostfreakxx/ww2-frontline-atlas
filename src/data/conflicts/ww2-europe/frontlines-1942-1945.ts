import type { FrontlineSnapshot, FrontPoint, LonLat, SourceRef } from '../../../lib/history/types.ts';
import type { ClosingRoute } from './frontlines-east-1941.ts';

// Coarse front-line snapshots for the rest of the war (Eastern Front 1942–45, Western Front 1940 and
// 1944–45, Italy 1944–45). Same method as 1941 — anchors on documented, dated places (q:'a'),
// interpolation between them (q:'b'), gaps where no continuous front existed (q:'c') — but with fewer
// anchors and wider uncertainty bands. They are suitable for overview narration, not close-up claims.

const a = (lon: number, lat: number, place?: string, note?: string): FrontPoint => ({ at: [lon, lat], q: 'a', place, note });
const b = (lon: number, lat: number, note?: string): FrontPoint => ({ at: [lon, lat], q: 'b', note });
const c = (lon: number, lat: number, note?: string): FrontPoint => ({ at: [lon, lat], q: 'c', note });

const EAST: SourceRef[] = [{ id: 'glantz-house' }, { id: 'ziemke-berlin' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }];
const EAST42: SourceRef[] = [{ id: 'glantz-house' }, { id: 'ziemke-bauer' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }];
const WEST44: SourceRef[] = [{ id: 'harrison-cca' }, { id: 'blumenson-breakout' }, { id: 'macdonald-last' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }];

const LENINGRAD_SIEGE: FrontPoint[] = [
  a(30.15, 59.86, 'Uritsk'), a(30.40, 59.71, 'Pushkin'), b(30.75, 59.72), b(30.95, 59.80), a(31.04, 59.94, 'Shlisselburg'), b(31.25, 59.96), b(31.20, 59.80), b(31.20, 59.68),
];
const LENINGRAD_1943: FrontPoint[] = [
  a(30.15, 59.86, 'Uritsk'), a(30.40, 59.71, 'Pushkin'), b(30.75, 59.72), b(30.95, 59.78, 'Neva'), a(31.10, 59.83, 'Sinyavino heights (German)'), b(31.35, 59.80), b(31.20, 59.68, 'Mga'),
];
const VOLKHOV_ILMEN: FrontPoint[] = [a(32.05, 59.45, 'Kirishi bridgehead'), b(31.80, 59.10, 'Volkhov'), a(31.30, 58.52, 'Novgorod'), b(31.6, 58.2, 'Lake Ilmen')];

const oranienbaum = { id: 'oranienbaum', label: 'Oranienbaum bridgehead (Soviet)', side: 'soviet' as const, confidence: 'approximate' as const, ring: [[29.05, 59.9], [29.3, 59.75], [29.75, 59.75], [29.85, 59.88], [29.05, 59.98]] as LonLat[] };
const finnishHeld: LonLat[] = [[29.95, 60.13], [30.55, 60.45], [31.0, 60.65], [33.0, 60.7], [33.6, 60.75], [34.2, 60.92], [35.4, 61.05], [35.0, 61.9], [34.6, 62.5], [34.6, 62.95], [34.9, 63.2], [33.3, 63.6], [32.8, 63.9], [29.0, 63.9], [27.0, 60.5]];
const crimeaRing: LonLat[] = [[32.4, 45.2], [33.6, 46.2], [34.5, 46.2], [35.4, 45.4], [36.7, 45.5], [36.7, 44.3], [32.4, 44.3]];
const courlandRing: LonLat[] = [[20.8, 57.8], [23.3, 57.8], [23.15, 56.97], [23.0, 56.6], [22.9, 56.42], [22.2, 56.4], [21.2, 56.35], [20.8, 56.3]];

export const closingRoutes1942: Record<string, ClosingRoute> = {
  'east-1942-06-27': { northHead: [[26.0, 80], [26.0, 59.92], [29.5, 60.0], [30.05, 59.9]], southTail: [[38.6, 46.9], [37.3, 46.2], [36.6, 45.5], [36.6, 44.0], [36.6, 30]] },
  'east-1942-11-18': { northHead: [[26.0, 80], [26.0, 59.92], [29.5, 60.0], [30.05, 59.9]], southTail: [[37.6, 44.5], [37.6, 30]] },
  'east-1943-07-04': { northHead: [[26.0, 80], [26.0, 59.92], [29.5, 60.0], [30.05, 59.9]], southTail: [[38.6, 46.9], [37.0, 45.9], [36.65, 45.4], [36.65, 30]] },
  'east-1943-12-31': { northHead: [[26.0, 80], [26.0, 59.92], [29.5, 60.0], [30.05, 59.9]], southTail: [[31.6, 44.5], [31.6, 30]] },
  'east-1944-06-22': { northHead: [[26.0, 80], [26.0, 59.85], [27.9, 59.55]], southTail: [[30.3, 30]] },
  'east-1944-08-31': { northHead: [[26.0, 80], [26.0, 59.85], [27.9, 59.55]], southTail: [[23.0, 47.6], [23.0, 30]] },
  'east-1945-01-12': { northHead: [[20.5, 80], [20.5, 55.75]], southTail: [[18.5, 44.5], [18.5, 30]] },
  'east-1945-04-16': { northHead: [[13.8, 80], [13.8, 54.0], [14.2, 53.75]], southTail: [[15.5, 45.5], [15.5, 30]] },
};

export const fronts1942to1945: FrontlineSnapshot[] = [
  {
    id: 'east-1942-06-27', theatre: 'east', date: '1942-06-27', label: 'Eastern Front, eve of Case Blue (27 June 1942)',
    description: 'After the winter battles: the Demyansk and Rzhev salients held by Army Group North and Centre; the Barvenkovo bulge eliminated (Second Kharkov, May 1942) and the Kerch peninsula retaken. Sevastopol was in its final days.',
    uncertaintyKm: 35, sources: EAST42, confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    pockets: [oranienbaum, { id: 'sevastopol', label: 'Sevastopol (falls 4 July)', side: 'soviet', confidence: 'approximate', ring: [[33.35, 44.75], [33.65, 44.80], [33.88, 44.58], [33.62, 44.40], [33.35, 44.45]] }],
    extraHeld: [{ id: 'finnish-karelia', label: 'Finnish-held Soviet Karelia', side: 'axis', confidence: 'approximate', ring: finnishHeld }],
    segments: [{
      id: 'main', kind: 'main', points: [
        ...LENINGRAD_SIEGE, ...VOLKHOV_ILMEN,
        a(31.45, 57.98, 'Staraya Russa'), b(31.9, 57.85, 'Ramushevo corridor'), b(32.6, 57.95), a(33.25, 57.70, 'Demyansk salient'), b(33.1, 57.40), b(32.4, 57.45), b(31.8, 57.55, 'Lovat'),
        a(31.40, 57.15, 'Kholm', 'relieved 5 May'), a(30.6, 56.35, 'Velikiye Luki (German)'), b(31.4, 56.0, 'Velizh'), b(32.3, 55.95),
        a(32.90, 55.85, 'Bely'), a(33.55, 56.25, 'Olenino'), a(34.33, 56.30, 'Rzhev'), b(34.9, 56.05), a(35.0, 55.55, 'Gzhatsk'), a(35.25, 54.78, 'Yukhnov'),
        b(34.6, 54.45), b(34.4, 54.0), a(34.75, 53.75, 'Zhizdra'), a(36.0, 53.45, 'Bolkhov'), a(36.6, 53.28, 'Mtsensk'), b(37.1, 52.85),
        b(37.3, 52.2), a(37.0, 51.85, 'east of Kursk'), b(37.1, 51.2), a(37.0, 50.6, 'east of Belgorod'), a(36.95, 50.28, 'Volchansk'),
        b(37.0, 49.75, 'Donets'), a(37.3, 49.2, 'Izyum', 'taken in Fridericus II, late June'), a(37.6, 48.85, 'Slavyansk'), b(38.0, 48.55), b(38.6, 48.05, 'Mius'), a(38.95, 47.22, 'Taganrog'),
      ],
    }],
  },
  {
    id: 'east-1942-11-18', theatre: 'east', date: '1942-11-18', label: 'Eastern Front, 18 November 1942 — eve of Uranus',
    description: 'The furthest German advance. The 6th Army held most of Stalingrad; Army Group A stood on the Terek, in the western Caucasus and at Novorossiysk; the Don flank was held largely by Romanian, Italian and Hungarian armies. No continuous front existed in the Kalmyk steppe.',
    uncertaintyKm: 35, sources: [...EAST42, { id: 'glantz-stalingrad' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    pockets: [oranienbaum],
    extraHeld: [{ id: 'finnish-karelia', label: 'Finnish-held Soviet Karelia', side: 'axis', confidence: 'approximate', ring: finnishHeld }],
    segments: [{
      id: 'main', kind: 'main', points: [
        ...LENINGRAD_SIEGE, ...VOLKHOV_ILMEN,
        a(31.45, 57.98, 'Staraya Russa'), b(31.9, 57.85), b(32.6, 57.95), a(33.25, 57.70, 'Demyansk salient'), b(33.1, 57.40), b(32.4, 57.45), b(31.8, 57.55),
        a(31.40, 57.15, 'Kholm'), a(30.6, 56.35, 'Velikiye Luki', 'attacked from 24 Nov'), b(31.4, 56.0), b(32.3, 55.95),
        a(32.90, 55.85, 'Bely'), a(33.55, 56.25, 'Olenino'), a(34.33, 56.30, 'Rzhev'), b(34.9, 56.05), a(35.0, 55.55, 'Gzhatsk'), a(35.25, 54.78, 'Yukhnov'),
        b(34.6, 54.45), b(34.4, 54.0), a(34.75, 53.75, 'Zhizdra'), a(36.0, 53.45, 'Bolkhov'), a(36.6, 53.28, 'Mtsensk'), b(37.1, 52.85), b(37.6, 52.4, 'Livny (Soviet)'),
        b(38.2, 51.9), a(39.15, 51.68, 'Voronezh', 'German-held west bank'), b(39.5, 51.0, 'Don'), a(40.1, 50.45, 'Pavlovsk'), a(41.0, 49.95, 'Boguchar'), a(42.7, 49.55, 'Serafimovich bridgehead (Soviet)'),
        a(43.05, 49.30, 'Kletskaya'), b(43.8, 49.2, 'Don bend'), a(44.55, 48.85, 'Volga north of Stalingrad'), a(44.53, 48.72, 'Stalingrad (Soviet 62nd Army on the bank)'), b(44.45, 48.58, 'Beketovka'),
        c(44.5, 48.0, 'Kalmyk steppe — no continuous front'), c(44.3, 47.0), a(44.27, 46.31, 'Elista (German)'), c(44.6, 45.0), a(44.65, 43.73, 'Mozdok', 'Terek'), b(43.9, 43.45),
        a(43.6, 43.48, 'Nalchik'), b(42.5, 43.35, 'Elbrus'), b(41.0, 43.9, 'Caucasus passes'), b(39.6, 44.35), a(39.3, 44.35, 'before Tuapse (Soviet)'), b(38.4, 44.6), a(37.80, 44.72, 'Novorossiysk', 'German-held except the eastern suburbs'),
      ],
    }],
  },
  {
    id: 'east-1943-07-04', theatre: 'east', date: '1943-07-04', label: 'Eastern Front, 4 July 1943 — eve of Kursk',
    description: 'After Stalingrad and Manstein’s counterstroke. The Leningrad blockade had been broken (January 1943); the Demyansk and Rzhev salients were evacuated (February–March); the Kursk salient bulged west between the German-held Orel and Belgorod–Kharkov areas; the Kuban (Taman) bridgehead still held.',
    uncertaintyKm: 30, sources: [...EAST, { id: 'glantz-kursk' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    pockets: [oranienbaum],
    extraHeld: [
      { id: 'finnish-karelia', label: 'Finnish-held Soviet Karelia', side: 'axis', confidence: 'approximate', ring: finnishHeld },
      { id: 'kuban', label: 'Kuban bridgehead (German)', side: 'axis', confidence: 'approximate', ring: [[36.6, 45.45], [37.4, 45.4], [38.1, 45.1], [37.9, 44.8], [37.7, 44.65], [36.6, 44.9]] },
    ],
    segments: [
      {
        id: 'main', kind: 'main', points: [
          ...LENINGRAD_1943, ...VOLKHOV_ILMEN,
          a(31.40, 58.0, 'Staraya Russa'), b(31.5, 57.6, 'Lovat'), a(31.40, 57.15, 'Kholm'), b(30.6, 56.6), a(30.2, 56.15, 'Nevel area (German)'), a(31.2, 55.6, 'Velizh'),
          b(32.0, 55.3), a(32.45, 55.2, 'Dukhovshchina'), b(33.1, 54.9), a(34.4, 54.45, 'Spas-Demensk'), b(34.5, 54.0, 'Kirov (Soviet)'), a(34.75, 53.75, 'Zhizdra'),
          b(35.6, 53.6), a(36.6, 53.4, 'Orel salient, north face'), b(37.0, 53.0), a(36.5, 52.45, 'Maloarkhangelsk'), a(36.25, 52.35, 'Ponyri sector'),
          b(35.6, 52.35), a(35.15, 52.45, 'Dmitrovsk'), a(34.5, 52.15, 'Sevsk'), a(34.7, 51.6, 'Rylsk'), a(34.85, 50.95, 'Sumy (German)'), b(35.8, 50.7),
          a(36.4, 50.65, 'Belgorod'), b(36.8, 50.3, 'Donets'), b(36.95, 49.85), a(37.3, 49.15, 'Izyum (Soviet bridgehead)'), b(37.7, 48.8), b(38.3, 48.3, 'Mius'), a(38.95, 47.2, 'Taganrog'),
        ],
      },
      { id: 'kuban', kind: 'secondary', label: 'Blue Line (Kuban bridgehead)', points: [a(37.42, 45.32, 'Temryuk'), b(37.9, 45.0), a(38.0, 44.93, 'Krymskaya'), a(37.8, 44.72, 'Novorossiysk')] },
    ],
  },
  {
    id: 'east-1943-12-31', theatre: 'east', date: '1943-12-31', label: 'Eastern Front, 31 December 1943',
    description: 'After the Battle of the Dnieper: Kiev (6 Nov), Gomel (26 Nov) and Zhitomir (31 Dec) liberated; the Crimea cut off; Army Group South still held the Dnieper bend at Kanev and the Nikopol bridgehead. Leningrad remained besieged until 27 January 1944.',
    uncertaintyKm: 35, sources: [...EAST, { id: 'gsww-8' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    pockets: [oranienbaum, { id: 'kerch', label: 'Kerch bridgehead (Soviet)', side: 'soviet', confidence: 'approximate', ring: [[36.25, 45.25], [36.7, 45.2], [36.7, 45.55], [36.3, 45.5]] }],
    extraHeld: [
      { id: 'finnish-karelia', label: 'Finnish-held Soviet Karelia', side: 'axis', confidence: 'approximate', ring: finnishHeld },
      { id: 'crimea', label: 'Crimea (German–Romanian, cut off)', side: 'axis', confidence: 'approximate', ring: crimeaRing },
    ],
    segments: [{
      id: 'main', kind: 'main', points: [
        ...LENINGRAD_1943, ...VOLKHOV_ILMEN,
        a(31.40, 58.0, 'Staraya Russa'), b(31.5, 57.6), a(31.40, 57.15, 'Kholm'), a(30.15, 56.35, 'Novosokolniki'), b(29.6, 56.0), a(29.95, 55.5, 'Gorodok (Soviet, 24 Dec)'),
        a(30.45, 55.25, 'east of Vitebsk'), b(30.9, 54.75), a(31.0, 54.45, 'east of Orsha'), b(30.95, 54.0), a(30.85, 53.6, 'east of Mogilev (Chausy)'), b(30.4, 53.0), a(30.0, 52.75, 'Zhlobin (German)'),
        a(30.4, 52.35, 'Rechitsa (Soviet)'), c(29.5, 52.0, 'Pripet'), c(28.8, 51.5), a(28.65, 50.95, 'Korosten'), a(28.66, 50.25, 'Zhitomir (Soviet, 31 Dec)'), a(28.6, 49.9, 'Berdichev'),
        b(29.6, 49.75), a(30.9, 49.65, 'Kanev salient (German)'), a(32.06, 49.44, 'Cherkassy (Soviet, 14 Dec)'), a(32.3, 48.55, 'Kirovograd (German)'), a(33.4, 47.95, 'Krivoi Rog'),
        a(34.6, 47.65, 'Nikopol bridgehead'), b(33.5, 46.85), a(32.6, 46.65, 'Kherson'), b(31.6, 46.45, 'Dnieper estuary'),
      ],
    }],
  },
  {
    id: 'east-1944-06-22', theatre: 'east', date: '1944-06-22', label: 'Eastern Front, 22 June 1944 — eve of Bagration',
    description: 'Army Group Centre held the "Belorussian balcony" from Vitebsk to Bobruisk; Leningrad relieved and the front pushed back to Narva and the Panther Line; western Ukraine and the Crimea liberated; Soviet forces stood on the Romanian border north of Iași and on the Dniester.',
    uncertaintyKm: 30, sources: [...EAST, { id: 'zaloga-bagration' }, { id: 'gsww-8' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    extraHeld: [{ id: 'finnish-karelia', label: 'Finnish-held Soviet Karelia (Soviet offensive from 10 June)', side: 'axis', confidence: 'uncertain', ring: finnishHeld }],
    segments: [{
      id: 'main', kind: 'main', points: [
        a(28.15, 59.45, 'Narva'), b(27.8, 59.0), b(27.6, 58.6, 'Lake Peipus'), a(28.3, 57.85, 'Pskov (German)'), a(28.4, 57.35, 'Ostrov'), b(28.9, 56.9), b(29.4, 56.3),
        a(29.0, 55.6, 'Polotsk sector'), a(30.25, 55.35, 'Vitebsk salient'), b(30.7, 54.9), a(30.6, 54.5, 'Orsha'), b(30.7, 54.0), a(30.6, 53.85, 'Mogilev'), b(30.2, 53.3),
        a(29.6, 52.9, 'Bobruisk sector'), c(28.5, 52.2, 'Pripet'), c(26.5, 51.8), a(24.75, 51.25, 'Kovel (German)'), b(25.2, 50.4), a(25.4, 49.9, 'Brody sector'),
        a(25.6, 49.4, 'Ternopil (Soviet)'), b(25.0, 48.6), a(25.0, 48.3, 'Kolomyia sector'), b(25.6, 47.95, 'Carpathians'), a(26.3, 47.5, 'Romanian border'), a(27.0, 47.35, 'north of Iași (Târgu Frumos)'),
        b(28.0, 47.25), a(29.3, 47.1, 'Dniester'), b(29.65, 46.75, 'Tiraspol bridgehead'), b(30.3, 46.15, 'Dniester estuary'),
      ],
    }],
  },
  {
    id: 'east-1944-08-31', theatre: 'east', date: '1944-08-31', label: 'Eastern Front, 31 August 1944',
    description: 'After Bagration and the Lvov–Sandomierz and Jassy–Kishinev operations. Army Group Centre had lost most of its divisions; Soviet forces reached East Prussia’s border, the Vistula at Warsaw (Warsaw Uprising since 1 August) and the Magnuszew and Sandomierz bridgeheads. Romania changed sides on 23 August.',
    uncertaintyKm: 40, sources: [...EAST, { id: 'zaloga-bagration' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    segments: [{
      id: 'main', kind: 'main', points: [
        a(28.15, 59.45, 'Narva'), b(27.5, 58.7), a(26.7, 58.35, 'Tartu (Soviet, 25 Aug)'), b(26.0, 57.8), a(25.0, 57.15, 'Sigulda sector'), b(24.0, 56.7), a(23.7, 56.65, 'Jelgava area'),
        a(23.0, 56.3, 'Doppelkopf corridor'), a(22.8, 55.6, 'Raseiniai sector'), b(22.6, 55.0, 'East Prussian border'), b(22.5, 54.4), b(22.3, 53.8), a(21.9, 53.2, 'Narew'),
        b(21.5, 52.6), a(21.1, 52.3, 'Warsaw (Praga)', 'Warsaw Uprising 1 Aug – 2 Oct'), a(21.3, 51.75, 'Magnuszew bridgehead'), b(21.8, 51.45), a(21.4, 50.75, 'Sandomierz bridgehead'),
        b(21.8, 50.1), a(21.6, 49.6, 'Dukla area'), b(22.6, 49.2, 'Carpathians'), b(24.0, 48.4),
      ],
    }],
  },
  {
    id: 'east-1945-01-12', theatre: 'east', date: '1945-01-12', label: 'Eastern Front, 12 January 1945 — eve of Vistula–Oder',
    description: 'Army Group Courland isolated in western Latvia; East Prussia invaded at Gumbinnen (October 1944); Soviet bridgeheads on the Narew and Vistula; Budapest encircled since 26 December; the front ran on through Slovakia and Hungary to Lake Balaton and Yugoslavia.',
    uncertaintyKm: 40, sources: EAST, confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    extraHeld: [{ id: 'courland', label: 'Courland pocket (Army Group North)', side: 'axis', confidence: 'approximate', ring: courlandRing }],
    segments: [
      { id: 'courland', kind: 'secondary', label: 'Courland pocket', points: [a(23.15, 56.97, 'Tukums'), b(23.0, 56.6), a(22.9, 56.42, 'Auce'), b(22.2, 56.4), a(21.2, 56.35, 'south of Liepāja')] },
      {
        id: 'main', kind: 'main', points: [
          a(21.15, 55.62, 'Memel bridgehead'), b(21.9, 55.1, 'Neman'), a(22.3, 54.6, 'Gumbinnen–Goldap sector'), b(22.5, 54.0), b(22.0, 53.5), a(21.4, 52.9, 'Różan bridgehead'),
          a(21.05, 52.5, 'Serock bridgehead'), a(21.0, 52.25, 'Warsaw (German)'), a(21.3, 51.75, 'Magnuszew bridgehead'), a(21.95, 51.4, 'Puławy bridgehead'),
          a(21.35, 50.7, 'Sandomierz bridgehead'), b(21.6, 50.1), a(21.5, 49.75, 'Jasło'), b(21.0, 49.2, 'Slovakia'), b(20.0, 48.6), a(18.75, 47.8, 'Esztergom'),
          a(18.6, 47.45, 'west of Budapest'), a(18.0, 47.1, 'Lake Velence–Balaton'), b(17.4, 46.6), b(17.6, 46.0, 'Drava'), a(19.2, 45.15, 'Syrmian front'), b(18.6, 44.6),
        ],
      },
    ],
    pockets: [],
  },
  {
    id: 'east-1945-04-16', endsAt: '1945-05-09', theatre: 'east', date: '1945-04-16', label: 'Eastern Front, 16 April 1945 — Berlin operation begins',
    description: 'Soviet fronts on the Oder and Neisse, about 60 km from Berlin; Königsberg (9 Apr) and Vienna (13 Apr) taken; Breslau besieged; Courland still held.',
    uncertaintyKm: 30, sources: [...EAST, { id: 'beevor-berlin' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'soviet',
    extraHeld: [{ id: 'courland', label: 'Courland pocket', side: 'axis', confidence: 'approximate', ring: courlandRing }],
    segments: [
      { id: 'courland', kind: 'secondary', label: 'Courland pocket', points: [a(23.15, 56.97, 'Tukums'), b(23.0, 56.6), a(22.9, 56.42, 'Auce'), b(22.2, 56.4), a(21.2, 56.35, 'south of Liepāja')] },
      {
        id: 'main', kind: 'main', points: [
          a(14.3, 53.7, 'Stettin lagoon'), a(14.6, 53.42, 'Stettin (German)'), a(14.25, 53.05, 'Schwedt'), a(14.62, 52.57, 'Küstrin bridgehead'), a(14.55, 52.34, 'Frankfurt (Oder)'),
          a(14.7, 51.95, 'Guben'), a(14.7, 51.55, 'Neisse at Forst'), a(15.0, 51.15, 'Görlitz'), b(16.0, 50.85), a(17.5, 50.3, 'Upper Silesia'), a(18.2, 50.1, 'Ratibor'),
          a(18.3, 49.8, 'Moravská Ostrava (German)'), b(17.6, 49.2), a(16.6, 49.2, 'Brno (German until 26 Apr)'), a(16.37, 48.21, 'Vienna (Soviet, 13 Apr)'), b(15.6, 48.1, 'St Pölten'),
          b(16.0, 47.1), b(16.2, 46.4, 'Drava'),
        ],
      },
    ],
    pockets: [],
  },
  // ---------------- Western Front ----------------
  {
    id: 'west-1940-05-10', theatre: 'west', date: '1940-05-10', label: 'Western frontier, 10 May 1940',
    description: 'The German border with the Netherlands, Belgium, Luxembourg and France from which Army Groups B, A and C attacked on 10 May 1940.',
    uncertaintyKm: 5, sources: [{ id: 'frieser-blitzkrieg' }, { id: 'natural-earth' }, { id: 'atlas-reconstruction' }], confidence: 'documented', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{
      id: 'main', kind: 'main', points: [
        a(7.2, 53.3, 'Ems estuary'), a(7.05, 52.6), a(6.7, 52.05), a(6.15, 51.85, 'Rhine at Emmerich'), a(6.1, 51.2), a(6.0, 50.75, 'Aachen'), a(6.4, 50.32), a(6.13, 50.15),
        a(6.5, 49.8), a(6.4, 49.45), a(6.75, 49.15, 'Saar'), a(7.6, 49.08), a(8.2, 48.97, 'Lauterbourg'), a(7.8, 48.55, 'Rhine at Strasbourg'), a(7.55, 47.8), a(7.59, 47.58, 'Basel'),
      ],
    }],
  },
  {
    id: 'west-1940-05-21', endsAt: '1940-06-04', theatre: 'west', date: '1940-05-21', label: 'Western Front, 21 May 1940',
    description: 'German armour reached the Channel at Abbeville on 20 May, cutting off the Allied armies in Belgium and northern France. The southern front formed along the Somme and the Aisne.',
    uncertaintyKm: 25, sources: [{ id: 'frieser-blitzkrieg' }, { id: 'ellis-france' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [
      { id: 'pocket', kind: 'secondary', label: 'Allied northern armies (Escaut line)', points: [a(3.83, 51.33, 'Scheldt'), a(3.72, 51.05, 'Ghent'), a(3.6, 50.85, 'Oudenaarde'), a(3.39, 50.6, 'Tournai'), b(3.45, 50.4), a(2.78, 50.29, 'Arras (Allied counterattack 21 May)'), b(2.3, 50.35), b(1.65, 50.5)] },
      { id: 'main', kind: 'main', points: [a(1.6, 50.18, 'Somme estuary'), a(1.83, 50.08, 'Abbeville'), a(2.3, 49.89, 'Amiens'), a(2.93, 49.93, 'Péronne'), b(3.3, 49.65), a(3.62, 49.56, 'Laon'), b(4.37, 49.51, 'Aisne'), a(4.94, 49.70, 'Sedan bridgehead'), a(5.36, 49.52, 'Montmédy'), b(6.0, 49.45, 'Maginot Line'), b(6.75, 49.15), a(8.2, 48.97, 'Lauterbourg'), a(7.8, 48.55), a(7.59, 47.58, 'Basel')] },
    ],
  },
  {
    id: 'west-1944-06-12', theatre: 'west', date: '1944-06-12', label: 'Normandy beachhead, 12 June 1944',
    description: 'The five landing beaches joined into one lodgement; Carentan taken on 12 June. Caen remained in German hands.',
    uncertaintyKm: 8, sources: WEST44, confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'beachhead', kind: 'secondary', label: 'Allied lodgement', points: [a(-1.28, 49.52, 'Quinéville'), a(-1.38, 49.48, 'Montebourg (German)'), b(-1.40, 49.38), a(-1.25, 49.30, 'Carentan'), b(-1.0, 49.18), a(-0.80, 49.09, 'Caumont'), a(-0.62, 49.18, 'Tilly-sur-Seulles'), a(-0.40, 49.23, 'north of Caen'), b(-0.25, 49.25, 'Orne'), a(-0.18, 49.22, 'Ranville'), a(-0.12, 49.30, 'coast')] }],
  },
  {
    id: 'west-1944-07-24', theatre: 'west', date: '1944-07-24', label: 'Normandy, 24 July 1944 — eve of Cobra',
    description: 'After seven weeks of attrition: Cherbourg taken (29 June), Caen (north 9 July, south after Goodwood 18–20 July) and Saint-Lô (18 July).',
    uncertaintyKm: 8, sources: WEST44, confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'front', kind: 'secondary', label: 'Normandy front', points: [a(-1.6, 49.22, 'west coast near Lessay'), a(-1.41, 49.19, 'Périers'), a(-1.09, 49.12, 'Saint-Lô'), a(-0.80, 49.09, 'Caumont'), a(-0.65, 49.08, 'Villers-Bocage'), a(-0.30, 49.12, 'Bourguébus ridge'), a(-0.18, 49.18, 'Troarn'), a(-0.12, 49.3, 'coast')] }],
  },
  {
    id: 'west-1944-08-25', theatre: 'west', date: '1944-08-25', label: 'Western Front, 25 August 1944',
    description: 'Paris liberated; Allied armies on the Seine and pursuing east toward Troyes; in the south the Dragoon forces advanced up the Rhône valley. The front was fluid and discontinuous.',
    uncertaintyKm: 40, sources: WEST44, confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'main', kind: 'main', points: [a(0.2, 49.45, 'Seine estuary'), a(1.1, 49.4, 'Rouen (German until 30 Aug)'), a(1.7, 49.0, 'Mantes bridgehead'), a(2.35, 48.86, 'Paris (liberated)'), a(2.66, 48.54, 'Melun'), a(4.08, 48.30, 'Troyes'), c(4.6, 47.4, 'open flank'), c(4.8, 45.8), a(4.75, 44.56, 'Montélimar (battle 21–31 Aug)'), b(5.72, 45.19, 'Grenoble')] }],
  },
  {
    id: 'west-1944-09-15', theatre: 'west', date: '1944-09-15', label: 'Western Front, 15 September 1944',
    description: 'The pursuit ended at the German border: Antwerp taken (4 Sep) but its approaches still German; the Americans at the Westwall near Aachen; Nancy taken (15 Sep); Dragoon and Overlord forces linked up (11–12 Sep).',
    uncertaintyKm: 20, sources: WEST44, confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'main', kind: 'main', points: [a(3.55, 51.4, 'Scheldt (German south bank pocket)'), a(4.45, 51.28, 'Antwerp'), b(5.0, 51.15, 'Albert Canal'), a(5.69, 50.85, 'Maastricht'), a(6.05, 50.78, 'Aachen (German)'), a(6.24, 50.55, 'Monschau'), b(6.35, 50.25, 'Schnee Eifel'), a(6.13, 50.0, 'Our'), b(6.4, 49.6), a(6.05, 49.2, 'west of Metz (German)'), a(6.05, 48.9, 'Pont-à-Mousson'), a(6.3, 48.69, 'Nancy'), b(6.5, 48.4), a(6.45, 48.1, 'Épinal sector'), a(6.86, 47.64, 'Belfort Gap (German)'), b(7.0, 47.45, 'Swiss border')] }],
  },
  {
    id: 'west-1944-12-15', theatre: 'west', date: '1944-12-15', label: 'Western Front, 15 December 1944 — eve of the Bulge',
    description: 'The Allies held the Scheldt estuary, the Nijmegen salient and the Roer front; the Ardennes sector was thinly held. In Alsace the Allies were on the Rhine at Strasbourg but the Germans held the Colmar pocket.',
    uncertaintyKm: 12, sources: [...WEST44, { id: 'cole-ardennes' }], confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'main', kind: 'main', points: [a(4.1, 51.55, 'Scheldt'), b(4.6, 51.7, 'Moerdijk'), b(5.3, 51.75, 'Maas'), a(5.86, 51.84, 'Nijmegen salient'), b(6.0, 51.4, 'Maas'), a(6.12, 50.97, 'Geilenkirchen'), a(6.36, 50.9, 'Roer (Jülich German)'), a(6.37, 50.7, 'Hürtgen Forest'), a(6.24, 50.55, 'Monschau'), a(6.27, 50.38, 'Losheim Gap'), b(6.3, 50.25, 'St Vith sector'), a(6.13, 49.95, 'Our'), a(6.42, 49.8, 'Echternach'), b(6.6, 49.45), a(6.75, 49.32, 'Saarlautern bridgehead'), a(7.43, 49.05, 'Bitche'), a(7.75, 48.6, 'Strasbourg'), a(7.45, 48.26, 'Sélestat'), b(7.15, 47.9, 'Colmar pocket'), a(7.35, 47.78, 'Mulhouse'), b(7.55, 47.6)] }],
  },
  {
    id: 'west-1944-12-25', theatre: 'west', date: '1944-12-25', label: 'Western Front, 25 December 1944 — the Bulge at its maximum',
    description: 'German spearheads had reached Celles, a few kilometres from the Meuse at Dinant, on 24 December; Bastogne was encircled (relieved 26 December); the northern shoulder held at Elsenborn.',
    uncertaintyKm: 8, sources: [{ id: 'cole-ardennes' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    pockets: [],
    segments: [{ id: 'main', kind: 'main', points: [a(4.1, 51.55, 'Scheldt'), b(4.6, 51.7, 'Moerdijk'), b(5.3, 51.75, 'Maas'), a(5.86, 51.84, 'Nijmegen'), b(6.0, 51.4), a(6.12, 50.97, 'Geilenkirchen'), a(6.36, 50.9, 'Roer'), a(6.24, 50.55, 'Monschau'), a(6.2, 50.47, 'Elsenborn ridge'), a(5.93, 50.4, 'Stavelot'), a(5.81, 50.41, 'Stoumont'), a(5.45, 50.27, 'Hotton'), a(5.34, 50.23, 'Marche'), a(4.95, 50.23, 'Celles (furthest point)'), a(5.22, 50.16, 'Rochefort'), a(5.37, 50.03, 'St-Hubert'), a(5.6, 49.95, 'Bastogne (encircled)'), a(5.74, 49.83, 'Martelange'), a(6.1, 49.85, 'Ettelbruck'), a(6.42, 49.8, 'Echternach'), b(6.6, 49.45), a(6.75, 49.32, 'Saarlautern'), a(7.43, 49.05, 'Bitche'), a(7.75, 48.6, 'Strasbourg'), b(7.15, 47.9, 'Colmar pocket'), a(7.35, 47.78, 'Mulhouse'), b(7.55, 47.6)] }],
  },
  {
    id: 'west-1945-03-25', theatre: 'west', date: '1945-03-25', label: 'Western Front, 25 March 1945 — the Rhine crossings',
    description: 'The Allies held the west bank of the Rhine almost everywhere, with bridgeheads at Remagen (7 March), Oppenheim (22 March) and Wesel (Operation Plunder, 23–24 March).',
    uncertaintyKm: 15, sources: [{ id: 'macdonald-last' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'main', kind: 'main', points: [a(5.9, 51.95, 'Arnhem (German)'), a(6.25, 51.83, 'Emmerich'), a(6.8, 51.72, 'Wesel bridgehead'), b(6.75, 51.3, 'Rhine'), a(6.96, 50.94, 'Cologne (west bank Allied)'), a(7.5, 50.6, 'Remagen bridgehead'), b(7.6, 50.35, 'Koblenz'), b(8.2, 50.0, 'Mainz'), a(8.42, 49.85, 'Oppenheim bridgehead'), b(8.4, 49.3, 'Rhine'), b(8.1, 48.9), a(7.75, 48.6, 'Strasbourg'), b(7.55, 47.6, 'Basel')] }],
  },
  {
    id: 'west-1945-04-18', endsAt: '1945-05-08', theatre: 'west', date: '1945-04-18', label: 'Western Front, 18 April 1945',
    description: 'The Ruhr pocket surrendered (18 April); US forces on the Elbe at Magdeburg and on the Mulde at Leipzig; in the south the Americans and French were advancing into Bavaria and Württemberg.',
    uncertaintyKm: 30, sources: [{ id: 'macdonald-last' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'allied', eastSide: 'axis',
    segments: [{ id: 'main', kind: 'main', points: [a(8.8, 53.08, 'Bremen (German until 26 Apr)'), b(10.5, 52.9), a(11.63, 52.13, 'Magdeburg (Elbe)'), b(12.0, 51.7), a(12.37, 51.34, 'Leipzig (US, 19 Apr)'), b(12.6, 50.8, 'Mulde'), b(12.2, 50.3), a(11.58, 49.95, 'Bayreuth'), a(11.08, 49.45, 'Nuremberg (taken 20 Apr)'), b(10.0, 48.9), a(9.18, 48.78, 'Stuttgart (French, 22 Apr)'), b(8.4, 48.2, 'Black Forest'), b(7.9, 47.6)] }],
  },
  // ---------------- Italy ----------------
  {
    id: 'italy-1944-01-22', endsAt: '1944-05-11', theatre: 'italy', date: '1944-01-22', label: 'Italy, 22 January 1944 — Gustav Line and Anzio',
    description: 'The Allied armies faced the Gustav Line from the Garigliano through Cassino to Ortona; the Anzio landing opened a second front south of Rome on 22 January.',
    uncertaintyKm: 10, sources: [{ id: 'weinberg' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'allied',
    segments: [
      { id: 'main', kind: 'main', points: [a(14.40, 42.35, 'Ortona'), b(14.2, 42.0, 'Sangro'), b(14.0, 41.7), a(13.83, 41.49, 'Cassino'), b(13.8, 41.3, 'Garigliano'), a(13.75, 41.22, 'Garigliano mouth')] },
      { id: 'anzio', kind: 'secondary', label: 'Anzio beachhead', points: [a(12.55, 41.5, 'coast'), b(12.7, 41.58), a(12.65, 41.45, 'Anzio')] },
    ],
  },
  {
    id: 'italy-1944-09-01', theatre: 'italy', date: '1944-09-01', label: 'Italy, 1 September 1944 — Gothic Line',
    description: 'Rome fell on 4 June and Florence in August; the Allies attacked the Gothic Line in the northern Apennines from 25 August.',
    uncertaintyKm: 15, sources: [{ id: 'weinberg' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'allied',
    segments: [{ id: 'main', kind: 'main', points: [a(12.9, 43.92, 'Pesaro'), b(12.4, 43.8), b(11.8, 44.0, 'Apennines'), a(11.26, 43.95, 'north of Florence'), b(10.8, 43.85), a(10.4, 43.72, 'Pisa (Arno)')] }],
  },
  {
    id: 'italy-1945-04-09', endsAt: '1945-04-21', theatre: 'italy', date: '1945-04-09', label: 'Italy, 9 April 1945 — final offensive',
    description: 'The front of the winter 1944–45 from Massa on the Ligurian coast through the Apennines south of Bologna to the Senio river and Lake Comacchio.',
    uncertaintyKm: 15, sources: [{ id: 'weinberg' }, { id: 'esposito-wpa' }, { id: 'atlas-reconstruction' }], confidence: 'approximate', verification: 'reference-level', westSide: 'axis', eastSide: 'allied',
    segments: [{ id: 'main', kind: 'main', points: [a(12.15, 44.6, 'Lake Comacchio'), a(11.9, 44.4, 'Senio'), b(11.5, 44.3), a(11.3, 44.3, 'south of Bologna'), b(10.8, 44.15), a(10.14, 44.03, 'Massa')] }],
  },
];

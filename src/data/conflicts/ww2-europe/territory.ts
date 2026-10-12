import type { LonLat, TerritorySnapshot } from '../../../lib/history/types.ts';

// Political-control reconstructions.
// Method: modern Natural Earth country polygons are combined, intersected and cut with hand-digitised
// historical boundary rings below. Where a historical boundary followed a river (Bug, San, Dniester) the
// build script snaps the line to Natural Earth river geometry. Positional accuracy is roughly ±10–20 km;
// every unit is labelled with its confidence. Build with: npm run geo:control

/** Boundary path: either explicit points or a river reach that the build script snaps to Natural Earth geometry. */
export type BoundaryPart = { pts: LonLat[] } | { river: string; file: 'world' | 'europe'; from: LonLat; to: LonLat };

/** Memel Territory (annexed by Germany 23 March 1939): north-eastern boundary with Lithuania. */
export const MEMEL_BOUNDARY: LonLat[] = [
  [21.06, 55.87], [21.25, 55.86], [21.40, 55.72], [21.55, 55.62], [21.68, 55.50], [21.90, 55.35], [22.15, 55.26], [22.35, 55.15], [22.58, 55.08],
];

/**
 * German–Soviet boundary of 28 September 1939 (Boundary and Friendship Treaty), from the Lithuanian
 * junction south of Suwałki to the San source in the Carpathians. It followed the Pisa, Narew (briefly),
 * Bug and San rivers; Augustów, Łomża, Białystok and Brest lay on the Soviet side; Suwałki, Ostrołęka,
 * Jarosław and Sanok on the German side; Przemyśl was divided on the San.
 */
export const GERMAN_SOVIET_1939: BoundaryPart[] = [
  { pts: [[23.50, 53.94], [23.20, 53.99], [22.90, 53.98], [22.62, 53.95], [22.50, 53.82], [22.43, 53.70], [22.20, 53.58], [21.95, 53.48], [21.87, 53.40], [21.88, 53.23], [21.95, 53.08], [22.05, 52.90], [22.08, 52.74]] },
  { river: 'Bug', file: 'world', from: [22.08, 52.70], to: [24.22, 50.42] },
  { pts: [[24.10, 50.38], [23.75, 50.30], [23.40, 50.22], [23.10, 50.12], [22.85, 50.02]] },
  { river: 'San', file: 'europe', from: [22.80, 49.98], to: [22.87, 49.04] },
];

/** Carpathian main ridge between Galicia and Carpatho-Ukraine (Hungarian from March 1939). */
export const CARPATHIAN_RIDGE: LonLat[] = [
  [22.56, 49.08], [22.87, 49.00], [23.13, 48.86], [23.55, 48.73], [23.85, 48.60], [24.10, 48.45], [24.47, 48.30], [24.52, 48.16], [24.63, 48.05], [24.80, 47.92], [24.95, 47.73],
];

/** Riga Treaty (1921) Polish–Soviet border, north to south, then the Zbruch to the Dniester. Coarse. */
export const RIGA_1921: LonLat[] = [
  [28.15, 55.82], [28.45, 55.55], [28.35, 55.22], [28.05, 54.95], [27.75, 54.55], [27.35, 54.10], [27.05, 53.62], [27.05, 53.25], [27.10, 52.95], [27.35, 52.55], [27.25, 52.10], [27.60, 51.70], [27.55, 51.30], [27.15, 51.05], [27.30, 50.62], [26.95, 50.30], [26.60, 50.00], [26.20, 49.80], [26.17, 49.53], [26.17, 49.07], [26.16, 48.86], [26.42, 48.53],
];

const ring = (pts: LonLat[]): LonLat[] => [...pts, pts[0]];


export const RINGS = {
  kaliningrad: ring([[19.4, 54.2], [22.95, 54.2], [22.95, 55.35], [19.4, 55.35]]),
  memelland: ring([[20.9, 55.0], ...MEMEL_BOUNDARY, [22.6, 55.03], [20.9, 55.03]]),
  zakarpattia: ring([[22.0, 49.25], ...CARPATHIAN_RIDGE, [24.2, 47.3], [22.0, 47.5]]),
  northTransylvania: ring([
    [21.0, 46.95], [21.85, 46.85], [22.35, 46.72], [22.90, 46.75], [23.40, 46.68], [23.68, 46.66], [24.05, 46.47], [24.55, 46.42], [24.85, 46.25], [25.15, 46.06], [25.35, 45.92], [25.70, 45.78], [25.95, 45.73], [26.25, 45.85], [26.40, 46.05], [26.25, 46.45], [26.00, 46.85], [25.75, 47.15], [25.40, 47.35], [25.05, 47.55], [24.95, 47.73], [24.95, 48.40], [21.0, 48.40],
  ]),
  southSlovakia: ring([
    [17.0, 47.95], [17.20, 48.00], [17.55, 48.15], [17.95, 48.22], [18.30, 48.27], [18.95, 48.30], [19.30, 48.33], [19.90, 48.45], [20.35, 48.55], [20.90, 48.75], [21.35, 48.85], [21.65, 48.80], [22.10, 48.92], [22.6, 48.3], [17.0, 47.6],
  ]),
  generalGovernment1939: ring([
    [22.2, 52.95], [21.75, 52.95], [21.4, 52.75], [21.15, 52.62], [20.75, 52.45], [20.40, 52.38], [20.10, 52.25], [19.90, 52.05], [19.82, 51.80], [19.70, 51.55], [19.50, 51.25], [19.25, 51.05], [19.05, 50.85], [19.25, 50.65], [19.50, 50.45], [19.62, 50.20], [19.62, 49.90], [19.70, 49.60], [19.70, 49.25], [23.5, 49.0], [24.5, 52.0], [23.0, 53.2],
  ]),
  alsaceMoselle: ring([[5.95, 49.55], [5.95, 49.0], [6.35, 48.75], [6.95, 48.45], [7.05, 48.10], [6.85, 47.82], [7.0, 47.55], [7.7, 47.5], [8.3, 48.9], [6.5, 49.7]]),
  franceOccupiedZone: ring([
    [-1.25, 43.10], [-0.95, 43.40], [-0.77, 43.49], [-0.45, 43.95], [-0.24, 44.55], [-0.15, 45.05], [0.15, 45.60], [0.67, 46.01], [0.85, 46.55], [1.00, 47.13], [1.55, 47.22], [2.07, 47.22], [2.55, 46.90], [3.33, 46.57], [3.98, 46.48], [4.40, 46.62], [4.85, 46.78], [5.25, 46.85], [5.70, 46.80], [6.10, 46.45], [6.8, 47.3], [8.5, 49.5], [4.0, 51.6], [-6.0, 48.6], [-2.0, 43.35],
  ]),
  vilniusRegion: ring([[26.6, 55.7], [25.6, 55.45], [25.25, 55.2], [24.9, 54.95], [24.5, 54.72], [24.4, 54.4], [24.2, 54.1], [23.95, 53.9], [27.0, 53.9], [27.0, 55.7]]),
  cededKarelia1940: ring([[27.8, 60.55], [29.95, 60.13], [30.6, 60.5], [31.0, 60.75], [32.5, 61.25], [32.0, 61.8], [31.4, 62.45], [31.2, 62.65], [30.5, 62.05], [29.65, 61.5], [29.3, 61.3], [28.0, 60.62]]),
  petsamo: ring([[28.2, 68.9], [29.0, 68.85], [30.0, 69.05], [31.0, 69.5], [31.9, 69.85], [32.0, 70.3], [28.2, 70.3]]),
  southernDobruja: ring([[26.55, 44.08], [27.0, 43.75], [27.45, 43.5], [28.05, 43.33], [29.0, 43.3], [29.0, 44.3], [26.55, 44.3]]),
};

/** Romanian part of modern Ukraine and Moldova in 1939 (Bessarabia, Northern Bukovina, Hertsa). Built with the Dniester snapped from river data. */
export const BESSARABIA_BUKOVINA: BoundaryPart[] = [
  { pts: [[24.85, 47.95], [25.18, 48.26], [25.57, 48.45], [25.73, 48.62]] },
  { river: 'Dniester', file: 'world', from: [25.73, 48.62], to: [30.25, 46.12] },
  { pts: [[30.8, 45.9], [29.7, 45.15], [28.2, 45.25], [26.0, 47.5]] },
];

// Named composite rings (assembled by scripts/build-control.mjs):
//  EAST_OF_1939_LINE   — everything east of GERMAN_SOVIET_1939, closed far to the east.
//  WEST_OF_RIGA        — everything west of RIGA_1921, closed far to the west.
//  BESSARABIA_BUKOVINA — ring built from BESSARABIA_BUKOVINA parts with the Dniester snapped to river data.

const ALL_SOVIET_CORE = ['RUS', 'BLR', 'UKR', 'MDA', 'GEO', 'ARM', 'AZE', 'KAZ'];

export const territorySnapshots: TerritorySnapshot[] = [
  {
    id: 'territory-1939-09-01',
    date: '1939-09-01',
    label: 'Political borders, 1 September 1939',
    description: 'Europe on the day Germany invaded Poland: Austria and the Czech lands already absorbed, Slovakia a German client state, Memel annexed, Albania Italian.',
    sources: [{ id: 'weinberg' }, { id: 'mazower-empire' }, { id: 'atlas-reconstruction' }, { id: 'natural-earth' }],
    confidence: 'approximate',
    verification: 'reference-level',
    units: [
      { id: 'reich', name: 'German Reich', status: 'reich', include: ['DEU', 'AUT', 'CZE'], add: [], confidence: 'approximate', note: 'Includes Austria (1938), the Sudetenland (1938) and the Protectorate of Bohemia and Moravia (March 1939); internal boundaries not shown.', labelAt: [10.4, 51.2] },
      { id: 'reich-kal', name: 'East Prussia', status: 'reich', include: ['RUS'], intersect: [RINGS.kaliningrad], confidence: 'approximate' },
      { id: 'reich-memel', name: 'Memel Territory', status: 'reich-annexed', include: ['LTU'], intersect: [RINGS.memelland], confidence: 'approximate', note: 'Annexed from Lithuania 23 March 1939.' },
      { id: 'poland', name: 'Poland', status: 'allied', include: ['POL'], confidence: 'approximate', labelAt: [21.0, 52.2] },
      { id: 'poland-east', name: 'Poland (eastern provinces)', status: 'allied', include: ['BLR', 'UKR'], intersect: [{ ref: 'WEST_OF_RIGA' }], subtract: [RINGS.zakarpattia], confidence: 'approximate', note: 'Riga Treaty border of 1921, coarse reconstruction.' },
      { id: 'poland-wilno', name: 'Poland (Wilno region)', status: 'allied', include: ['LTU'], intersect: [RINGS.vilniusRegion], confidence: 'approximate' },
      { id: 'lithuania', name: 'Lithuania', status: 'neutral', include: ['LTU'], subtract: [RINGS.memelland, RINGS.vilniusRegion], confidence: 'approximate' },
      { id: 'latvia', name: 'Latvia', status: 'neutral', include: ['LVA'], confidence: 'documented' },
      { id: 'estonia', name: 'Estonia', status: 'neutral', include: ['EST'], confidence: 'documented' },
      { id: 'ussr', name: 'Soviet Union', status: 'neutral', include: ALL_SOVIET_CORE, subtract: [RINGS.kaliningrad, RINGS.cededKarelia1940, RINGS.petsamo, { ref: 'WEST_OF_RIGA' }, RINGS.zakarpattia, { ref: 'BESSARABIA_BUKOVINA' }], confidence: 'approximate', note: 'Non-belligerent toward Germany under the Molotov–Ribbentrop Pact (23 August 1939); invaded Poland 17 September.', labelAt: [38.0, 56.6] },
      { id: 'romania', name: 'Romania', status: 'neutral', include: ['ROU'], confidence: 'approximate', labelAt: [25.0, 45.6] },
      { id: 'romania-bess', name: 'Romania (Bessarabia, N. Bukovina)', status: 'neutral', include: ['UKR', 'MDA'], intersect: [{ ref: 'BESSARABIA_BUKOVINA' }], confidence: 'approximate' },
      { id: 'romania-dobruja', name: 'Romania (S. Dobruja)', status: 'neutral', include: ['BGR'], intersect: [RINGS.southernDobruja], confidence: 'approximate' },
      { id: 'hungary', name: 'Hungary', status: 'neutral', include: ['HUN'], confidence: 'approximate', note: 'Revisionist, aligned with the Axis but not yet a belligerent.' },
      { id: 'hungary-slovakia', name: 'Hungary (S. Slovakia)', status: 'neutral', include: ['SVK'], intersect: [RINGS.southSlovakia], confidence: 'approximate', note: 'First Vienna Award, 2 November 1938.' },
      { id: 'hungary-ruthenia', name: 'Hungary (Carpatho-Ukraine)', status: 'neutral', include: ['UKR'], intersect: [RINGS.zakarpattia], confidence: 'approximate', note: 'Occupied March 1939.' },
      { id: 'slovakia', name: 'Slovakia', status: 'axis', include: ['SVK'], subtract: [RINGS.southSlovakia], confidence: 'approximate', note: 'German client state from March 1939; took part in the invasion of Poland.' },
      { id: 'italy', name: 'Italy', status: 'axis', include: ['ITA', 'ALB', 'SMR', 'VAT'], confidence: 'approximate', note: 'Non-belligerent until 10 June 1940. Albania occupied April 1939.' },
      { id: 'france', name: 'France', status: 'allied', include: ['FRA', 'MCO'], confidence: 'documented' },
      { id: 'uk', name: 'United Kingdom', status: 'allied', include: ['GBR'], confidence: 'documented' },
      { id: 'finland', name: 'Finland', status: 'neutral', include: ['FIN'], add: [], confidence: 'approximate' },
      { id: 'finland-karelia', name: 'Finland (Karelia)', status: 'neutral', include: ['RUS'], intersect: [RINGS.cededKarelia1940], confidence: 'approximate', note: 'Ceded to the USSR in March 1940. Coarse.' },
      { id: 'finland-petsamo', name: 'Finland (Petsamo)', status: 'neutral', include: ['RUS'], intersect: [RINGS.petsamo], confidence: 'approximate' },
      { id: 'neutrals', name: 'Neutral states', status: 'neutral', include: ['SWE', 'NOR', 'DNK', 'NLD', 'BEL', 'LUX', 'CHE', 'LIE', 'ESP', 'PRT', 'AND', 'IRL', 'ISL', 'TUR', 'GRC', 'SRB', 'HRV', 'BIH', 'MNE', 'MKD', 'SVN', 'KOS', 'IRN', 'IRQ', 'SYR', 'LBN', 'JOR', 'ISR', 'PSX', 'SAU', 'EGY', 'CYP'], confidence: 'approximate', note: 'Includes Yugoslavia and Greece; Egypt and the Levant were under British or French control.' },
      { id: 'bulgaria', name: 'Bulgaria', status: 'neutral', include: ['BGR'], subtract: [RINGS.southernDobruja], confidence: 'approximate' },
      { id: 'french-n-africa', name: 'French North Africa', status: 'allied', include: ['MAR', 'DZA', 'TUN'], confidence: 'documented' },
      { id: 'libya', name: 'Libya (Italian)', status: 'axis', include: ['LBY'], confidence: 'documented' },
      { id: 'malta', name: 'Malta (British)', status: 'allied', include: ['MLT'], confidence: 'documented' },
    ],
  },
  {
    id: 'territory-1941-06-22',
    date: '1941-06-22',
    label: 'Political control, 22 June 1941',
    description: 'Europe on the morning of Operation Barbarossa. Poland partitioned; the Baltic states, Bessarabia and Northern Bukovina annexed by the USSR in 1940; France, the Low Countries, Denmark, Norway, Yugoslavia and Greece under Axis occupation.',
    sources: [{ id: 'weinberg' }, { id: 'mazower-empire' }, { id: 'gsww-4' }, { id: 'atlas-reconstruction' }, { id: 'natural-earth' }],
    confidence: 'approximate',
    verification: 'reference-level',
    units: [
      { id: 'reich', name: 'Greater German Reich', status: 'reich', include: ['DEU', 'AUT', 'CZE', 'LUX'], confidence: 'approximate', note: 'Includes Austria, Sudetenland, the Protectorate of Bohemia and Moravia and de facto annexed Luxembourg; internal boundaries not shown.', labelAt: [10.4, 51.2] },
      { id: 'reich-kal', name: 'East Prussia', status: 'reich', include: ['RUS'], intersect: [RINGS.kaliningrad], confidence: 'approximate' },
      { id: 'reich-memel', name: 'Memel Territory', status: 'reich-annexed', include: ['LTU'], intersect: [RINGS.memelland], confidence: 'approximate' },
      { id: 'reich-poland', name: 'Annexed Polish territory', status: 'reich-annexed', include: ['POL'], subtract: [RINGS.generalGovernment1939, { ref: 'EAST_OF_1939_LINE' }], confidence: 'approximate', note: 'Danzig–West Prussia, Wartheland, East Upper Silesia and the Zichenau district, annexed October 1939. Boundary with the General Government is approximate.' },
      { id: 'reich-alsace', name: 'Alsace-Moselle', status: 'reich-annexed', include: ['FRA'], intersect: [RINGS.alsaceMoselle], confidence: 'approximate', note: 'Annexed de facto in 1940 (no formal annexation).' },
      { id: 'gg', name: 'General Government', status: 'german-occupied', include: ['POL'], intersect: [RINGS.generalGovernment1939], subtract: [{ ref: 'EAST_OF_1939_LINE' }], confidence: 'approximate', note: 'German civil administration of occupied central Poland (Generalgouvernement). District Galicia added 1 August 1941.', labelAt: [21.6, 51.0] },
      { id: 'ussr-baltic', name: 'Soviet-annexed Baltic states', status: 'soviet', include: ['LTU', 'LVA', 'EST'], subtract: [RINGS.memelland], confidence: 'approximate', note: 'Occupied June 1940 and annexed August 1940.' },
      { id: 'ussr', name: 'Soviet Union', status: 'soviet', include: ALL_SOVIET_CORE, subtract: [RINGS.kaliningrad, RINGS.zakarpattia, RINGS.petsamo], confidence: 'approximate', note: 'Includes eastern Poland (annexed November 1939), the Baltic states (August 1940), Bessarabia and Northern Bukovina (June 1940) and the Finnish territory ceded in March 1940.', labelAt: [38.0, 56.6] },
      { id: 'ussr-poland', name: 'Soviet-annexed eastern Poland', status: 'soviet', include: ['POL'], intersect: [{ ref: 'EAST_OF_1939_LINE' }], confidence: 'approximate' },
      { id: 'romania', name: 'Romania', status: 'axis', include: ['ROU'], subtract: [RINGS.northTransylvania], confidence: 'approximate', note: 'Lost Bessarabia and N. Bukovina (USSR), N. Transylvania (Hungary) and S. Dobruja (Bulgaria) in 1940. Joined the Tripartite Pact 23 November 1940.', labelAt: [25.0, 44.9] },
      { id: 'hungary', name: 'Hungary', status: 'axis', include: ['HUN'], confidence: 'approximate', note: 'Joined the Tripartite Pact 20 November 1940; declared war on the USSR 27 June 1941.', labelAt: [19.3, 47.0] },
      { id: 'hungary-slovakia', name: 'Hungary (S. Slovakia)', status: 'axis', include: ['SVK'], intersect: [RINGS.southSlovakia], confidence: 'approximate' },
      { id: 'hungary-ruthenia', name: 'Hungary (Carpatho-Ukraine)', status: 'axis', include: ['UKR'], intersect: [RINGS.zakarpattia], confidence: 'approximate' },
      { id: 'hungary-transylvania', name: 'Hungary (N. Transylvania)', status: 'axis', include: ['ROU'], intersect: [RINGS.northTransylvania], confidence: 'approximate', note: 'Second Vienna Award, 30 August 1940.' },
      { id: 'slovakia', name: 'Slovakia', status: 'axis', include: ['SVK'], subtract: [RINGS.southSlovakia], confidence: 'approximate' },
      { id: 'bulgaria', name: 'Bulgaria', status: 'axis', include: ['BGR'], confidence: 'approximate', note: 'Joined the Tripartite Pact 1 March 1941; did not declare war on the USSR.' },
      { id: 'italy', name: 'Italy', status: 'axis', include: ['ITA', 'ALB', 'SMR', 'VAT'], confidence: 'approximate' },
      { id: 'occupied-yugoslavia-greece', name: 'Occupied Yugoslavia and Greece', status: 'axis-occupied', include: ['SRB', 'HRV', 'BIH', 'MNE', 'MKD', 'SVN', 'KOS', 'GRC'], confidence: 'approximate', note: 'Partitioned April–June 1941 among Germany, Italy, Hungary, Bulgaria and the Independent State of Croatia. Occupation zones are not drawn here.' },
      { id: 'occupied-west', name: 'German-occupied territory', status: 'german-occupied', include: ['NOR', 'DNK', 'NLD', 'BEL'], confidence: 'documented' },
      { id: 'france-occupied', name: 'Occupied France', status: 'german-occupied', include: ['FRA'], intersect: [RINGS.franceOccupiedZone], subtract: [RINGS.alsaceMoselle], confidence: 'approximate', note: 'Occupied zone defined by the armistice of 22 June 1940; the demarcation line is approximate.' },
      { id: 'vichy', name: 'Vichy France', status: 'vichy', include: ['FRA', 'MCO'], subtract: [RINGS.franceOccupiedZone, RINGS.alsaceMoselle], confidence: 'approximate', note: 'Unoccupied zone until 11 November 1942.', labelAt: [3.0, 45.1] },
      { id: 'finland', name: 'Finland', status: 'cobelligerent', include: ['FIN'], confidence: 'approximate', note: 'At war with the USSR from 25 June 1941 (Continuation War) as a co-belligerent, not a formal Axis ally.' },
      { id: 'finland-petsamo', name: 'Finland (Petsamo)', status: 'cobelligerent', include: ['RUS'], intersect: [RINGS.petsamo], confidence: 'approximate' },
      { id: 'uk', name: 'United Kingdom', status: 'allied', include: ['GBR', 'MLT', 'CYP'], confidence: 'documented' },
      { id: 'allied-occupied', name: 'Iceland (Allied-occupied)', status: 'allied-occupied', include: ['ISL'], confidence: 'documented' },
      { id: 'neutrals', name: 'Neutral states', status: 'neutral', include: ['SWE', 'CHE', 'LIE', 'ESP', 'PRT', 'AND', 'IRL', 'TUR', 'IRN', 'SAU'], confidence: 'documented' },
      { id: 'french-n-africa', name: 'French North Africa (Vichy)', status: 'vichy', include: ['MAR', 'DZA', 'TUN'], confidence: 'documented' },
      { id: 'libya', name: 'Libya (Italian)', status: 'axis', include: ['LBY'], confidence: 'documented' },
      { id: 'middle-east', name: 'British-controlled Middle East', status: 'allied', include: ['EGY', 'ISR', 'PSX', 'JOR', 'IRQ'], confidence: 'approximate' },
      { id: 'levant', name: 'Syria and Lebanon (Vichy, Allied invasion from 8 June 1941)', status: 'vichy', include: ['SYR', 'LBN'], confidence: 'documented' },
    ],
  },
];

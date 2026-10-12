import type { Person } from '../../../lib/history/types.ts';

// Commanders. Ranks are recorded at the dates they took effect (only the ranks relevant to 1939–45).
// Portraits: none are bundled. Add an image only when its licence permits reuse
// (e.g. Bundesarchiv images released under CC BY-SA 3.0 DE) and record credit + licence.
const P = (id: string, name: string, born: string, died: string, ranks: [string, string][], note?: string): Person => ({
  id, name, born, died, ranks: ranks.map(([from, rank]) => ({ from, rank })), portrait: null, note,
});

export const people: Person[] = [
  // Army group commanders
  P('bock', 'Fedor von Bock', '1880', '1945', [['1938-03-01', 'Generaloberst'], ['1940-07-19', 'Generalfeldmarschall']]),
  P('rundstedt', 'Gerd von Rundstedt', '1875', '1953', [['1938-03-01', 'Generaloberst'], ['1940-07-19', 'Generalfeldmarschall']]),
  P('leeb', 'Wilhelm Ritter von Leeb', '1876', '1956', [['1938-03-01', 'Generaloberst'], ['1940-07-19', 'Generalfeldmarschall']]),
  P('kuechler', 'Georg von Küchler', '1881', '1968', [['1940-07-19', 'Generaloberst'], ['1942-06-30', 'Generalfeldmarschall']]),
  P('model', 'Walter Model', '1891', '1945', [['1942-02-01', 'Generaloberst'], ['1944-03-01', 'Generalfeldmarschall']], 'Died by suicide in the Ruhr pocket, 21 April 1945.'),
  P('lindemann', 'Georg Lindemann', '1884', '1963', [['1942-07-03', 'Generaloberst']]),
  P('friessner', 'Johannes Frießner', '1892', '1971', [['1944-07-01', 'Generaloberst']]),
  P('schoerner', 'Ferdinand Schörner', '1892', '1973', [['1944-04-01', 'Generaloberst'], ['1945-04-05', 'Generalfeldmarschall']]),
  P('kluge', 'Günther von Kluge', '1882', '1944', [['1939-01-01', 'Generaloberst'], ['1940-07-19', 'Generalfeldmarschall']], 'Died by suicide, 19 August 1944.'),
  P('busch', 'Ernst Busch', '1885', '1945', [['1940-07-19', 'Generaloberst'], ['1943-02-01', 'Generalfeldmarschall']]),
  P('reinhardt', 'Georg-Hans Reinhardt', '1887', '1963', [['1940-06-01', 'General der Panzertruppe'], ['1942-01-01', 'Generaloberst']]),
  P('reichenau', 'Walter von Reichenau', '1884', '1942', [['1940-07-19', 'Generalfeldmarschall']], 'Died 17 January 1942 after a stroke.'),
  P('list', 'Wilhelm List', '1880', '1971', [['1940-07-19', 'Generalfeldmarschall']]),
  P('kleist', 'Ewald von Kleist', '1881', '1954', [['1940-07-19', 'Generaloberst'], ['1943-02-01', 'Generalfeldmarschall']]),
  P('weichs', 'Maximilian von Weichs', '1881', '1954', [['1940-07-19', 'Generaloberst'], ['1943-02-01', 'Generalfeldmarschall']]),
  P('manstein', 'Erich von Manstein', '1887', '1973', [['1940-06-01', 'General der Infanterie'], ['1942-01-01', 'Generaloberst'], ['1942-07-01', 'Generalfeldmarschall']]),
  P('harpe', 'Josef Harpe', '1887', '1968', [['1944-05-20', 'Generaloberst']]),
  P('rendulic', 'Lothar Rendulic', '1887', '1971', [['1944-06-01', 'Generaloberst']]),
  P('woehler', 'Otto Wöhler', '1894', '1987', [['1943-06-01', 'General der Infanterie']]),
  P('weiss', 'Walter Weiß', '1890', '1967', [['1944-08-01', 'Generaloberst']]),
  P('hilpert', 'Carl Hilpert', '1888', '1946', [['1944-08-01', 'General der Infanterie'], ['1945-05-01', 'Generaloberst']]),
  P('vietinghoff', 'Heinrich von Vietinghoff', '1887', '1952', [['1940-06-01', 'General der Panzertruppe'], ['1943-09-01', 'Generaloberst']]),
  P('rommel', 'Erwin Rommel', '1891', '1944', [['1942-06-22', 'Generalfeldmarschall']], 'Forced to commit suicide, 14 October 1944.'),
  P('kesselring', 'Albert Kesselring', '1885', '1960', [['1940-07-19', 'Generalfeldmarschall (Luftwaffe)']]),
  P('witzleben', 'Erwin von Witzleben', '1881', '1944', [['1940-07-19', 'Generalfeldmarschall']], 'Executed 8 August 1944 for his part in the 20 July plot.'),
  P('loehr', 'Alexander Löhr', '1885', '1947', [['1941-05-03', 'Generaloberst (Luftwaffe)']]),
  P('blaskowitz', 'Johannes Blaskowitz', '1883', '1948', [['1939-10-01', 'Generaloberst']]),
  P('balck', 'Hermann Balck', '1897', '1982', [['1943-11-01', 'General der Panzertruppe']]),
  P('hausser', 'Paul Hausser', '1880', '1972', [['1944-08-01', 'SS-Oberstgruppenführer']]),
  P('schulz', 'Friedrich Schulz', '1897', '1976', [['1944-01-01', 'General der Infanterie']]),
  P('student', 'Kurt Student', '1890', '1978', [['1944-07-13', 'Generaloberst (Luftwaffe)']]),
  P('himmler', 'Heinrich Himmler', '1900', '1945', [['1929-01-06', 'Reichsführer-SS']], 'No military command experience; appointed by Hitler.'),
  P('heinrici', 'Gotthard Heinrici', '1886', '1971', [['1941-01-01', 'General der Infanterie'], ['1943-01-01', 'Generaloberst']]),
  P('hitler', 'Adolf Hitler', '1889', '1945', [['1938-02-04', 'Supreme Commander of the Wehrmacht']], 'Took personal command of Army Group A from 10 September to 22 November 1942.'),
  P('arnim', 'Hans-Jürgen von Arnim', '1889', '1962', [['1942-12-04', 'Generaloberst']]),
  // Field armies and panzer groups, June 1941
  P('hoepner', 'Erich Hoepner', '1886', '1944', [['1940-07-19', 'Generaloberst']], 'Dismissed January 1942; executed 8 August 1944 after the 20 July plot.'),
  P('strauss', 'Adolf Strauß', '1879', '1973', [['1940-07-19', 'Generaloberst']]),
  P('hoth', 'Hermann Hoth', '1885', '1971', [['1940-07-19', 'Generaloberst']]),
  P('guderian', 'Heinz Guderian', '1888', '1954', [['1940-07-19', 'Generaloberst']], 'Relieved 26 December 1941.'),
  P('stuelpnagel', 'Carl-Heinrich von Stülpnagel', '1886', '1944', [['1939-04-20', 'General der Infanterie']]),
  P('schobert', 'Eugen Ritter von Schobert', '1883', '1941', [['1940-07-19', 'Generaloberst']], 'Killed 12 September 1941 when his aircraft landed in a minefield.'),
  // Corps commanders, June 1941 (names only; tenures cited at corps level)
  P('reinhardt-c', 'Georg-Hans Reinhardt', '1887', '1963', [['1940-06-01', 'General der Panzertruppe']]),
  P('rudolf-schmidt', 'Rudolf Schmidt', '1886', '1957', [['1940-06-01', 'General der Panzertruppe']]),
  P('kuntzen', 'Adolf-Friedrich Kuntzen', '1889', '1964', [['1941-04-01', 'General der Panzertruppe']]),
  P('geyr', 'Leo Geyr von Schweppenburg', '1886', '1974', [['1940-04-01', 'General der Panzertruppe']]),
  P('lemelsen', 'Joachim Lemelsen', '1888', '1954', [['1940-08-01', 'General der Panzertruppe']]),
  P('mackensen', 'Eberhard von Mackensen', '1889', '1969', [['1940-08-01', 'General der Kavallerie']]),
  P('kempf', 'Werner Kempf', '1886', '1964', [['1941-04-01', 'General der Panzertruppe']]),
  P('wietersheim', 'Gustav von Wietersheim', '1884', '1974', [['1938-02-01', 'General der Infanterie']]),
];

export const personById = new Map(people.map((p) => [p.id, p]));

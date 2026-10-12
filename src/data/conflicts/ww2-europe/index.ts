import type { ConflictPackage } from '../../../lib/history/types.ts';
import { sources } from './sources.ts';
import { places, physical } from './places.ts';
import { operations, battles, arrows, objectives } from './campaigns.ts';
import { events } from './events.ts';
import { frontlines } from './frontlines.ts';
import { germanArmyGroups } from './formations-de.ts';
import { oob1941, corpsCommanders } from './oob-1941.ts';
import { sovietFronts, alliedArmyGroups, opposingPeople } from './formations-opposing.ts';
import { people } from './people.ts';
import { territorySnapshots } from './territory.ts';

export const ww2Europe: ConflictPackage = {
  id: 'ww2-europe',
  title: 'Second World War in Europe, 1939–1945',
  range: { start: '1939-08-23', end: '1945-05-09' },
  defaultCamera: { lon: 20.0, lat: 52.0, zoom: 1.0 },
  sources,
  places,
  physical,
  operations,
  battles,
  arrows,
  objectives,
  events: [...events].sort((a, b) => a.date.localeCompare(b.date)),
  frontlines,
  formations: [...germanArmyGroups, ...oob1941, ...sovietFronts, ...alliedArmyGroups],
  people: [...people, ...corpsCommanders, ...opposingPeople],
  territorySnapshots: territorySnapshots.map((t) => ({ id: t.id, date: t.date, label: t.label, file: `/geo/territory-${t.date}.json` })),
};

export { territorySnapshots };

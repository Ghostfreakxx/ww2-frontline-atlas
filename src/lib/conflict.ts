import { ConflictIndex } from './history/query.ts';
import { ww2Europe } from '../data/conflicts/ww2-europe/index.ts';
import { barbarossaEpisode } from '../data/conflicts/ww2-europe/episodes/barbarossa.ts';
import { overviewEpisode } from '../data/conflicts/ww2-europe/episodes/overview.ts';
import type { Episode } from './episodes/types.ts';

// Registry of conflict packages and built-in episodes. Add new wars/periods here.
export const conflicts = { 'ww2-europe': new ConflictIndex(ww2Europe) } as const;
export type ConflictId = keyof typeof conflicts;

export const idx = conflicts['ww2-europe'];

export const builtInEpisodes: Episode[] = [barbarossaEpisode, overviewEpisode];

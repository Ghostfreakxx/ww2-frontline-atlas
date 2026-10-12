import type { FrontlineSnapshot } from '../../../lib/history/types.ts';
import { eastFront1941, closingRoutes as east1941Closing, type ClosingRoute } from './frontlines-east-1941.ts';
import { fronts1942to1945, closingRoutes1942 } from './frontlines-1942-1945.ts';

export type { ClosingRoute };

export const frontlines: FrontlineSnapshot[] = [...eastFront1941, ...fronts1942to1945].sort((a, b) => a.date.localeCompare(b.date));

export const closingRoutes: Record<string, ClosingRoute> = { ...east1941Closing, ...closingRoutes1942 };

/** Which territory snapshot defines the "home" territory used to compute occupied areas for a front. */
export const frontTerritoryBasis: Record<string, { territory: string; defenderStatus: string[] }> = {
  east: { territory: 'territory-1941-06-22', defenderStatus: ['soviet'] },
};

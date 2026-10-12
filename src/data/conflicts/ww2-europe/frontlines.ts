import type { FrontlineSnapshot } from '../../../lib/history/types.ts';
import { eastFront1941, closingRoutes as east1941Closing, type ClosingRoute } from './frontlines-east-1941.ts';

export type { ClosingRoute };

export const frontlines: FrontlineSnapshot[] = [...eastFront1941];

export const closingRoutes: Record<string, ClosingRoute> = { ...east1941Closing };

/** Which territory snapshot defines the "home" territory used to compute occupied areas for a front. */
export const frontTerritoryBasis: Record<string, { territory: string; defenderStatus: string[] }> = {
  east: { territory: 'territory-1941-06-22', defenderStatus: ['soviet'] },
};

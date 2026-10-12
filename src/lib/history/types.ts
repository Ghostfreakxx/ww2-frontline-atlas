// Core, conflict-agnostic data model for the atlas.
// A "conflict package" (e.g. src/data/conflicts/ww2-europe) supplies data in these shapes,
// so the renderer, presenter and episode builder can be reused for other wars and periods.

export type ISODate = string; // 'YYYY-MM-DD'
export type LonLat = [number, number];

/**
 * How strongly a data item is supported.
 * - documented: a dated fact stated in the cited sources (dates, names, appointments, captures).
 * - approximate: a reconstruction anchored on documented places/dates, drawn between anchors.
 * - schematic: a diagrammatic graphic (e.g. campaign arrows) that shows direction, not positions.
 * - planned: an intention or objective, not an achieved result.
 * - uncertain: sources disagree or are thin; shown with an explicit warning.
 */
export type Confidence = 'documented' | 'approximate' | 'schematic' | 'planned' | 'uncertain';

/** Whether a citation has been checked down to page level by a researcher. */
export type Verification = 'reference-level' | 'page-verified';

export interface SourceRef {
  id: string;
  /** Chapter, map number or page — only filled in when actually checked. */
  locator?: string;
  note?: string;
}

export type SourceKind = 'primary' | 'official-history' | 'secondary' | 'atlas' | 'dataset' | 'memoir';

export interface Source {
  id: string;
  kind: SourceKind;
  author: string;
  title: string;
  publisher?: string;
  year?: number;
  url?: string;
  /** Licence of the source itself when we reuse its data or imagery (datasets, maps). */
  license?: string;
  notes?: string;
}

export interface Cited {
  sources: SourceRef[];
  confidence: Confidence;
  verification?: Verification;
}

export type Side = 'axis' | 'soviet' | 'allied' | 'neutral';

export interface DatedName {
  from: ISODate;
  to?: ISODate;
  name: string;
}

export interface Place {
  id: string;
  name: string;
  /** Period-appropriate names (e.g. Königsberg / Leningrad / Stalino). */
  names?: DatedName[];
  modern?: string;
  at: LonLat;
  kind: 'capital' | 'city' | 'town' | 'fortress' | 'port' | 'physical';
  /** 1 = always labelled, 2 = labelled at medium zoom, 3 = labelled when zoomed in. */
  rank: 1 | 2 | 3;
  /** Optional label placement relative to the dot. */
  labelAt?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
}

export interface PhysicalLabel {
  id: string;
  name: string;
  at: LonLat;
  kind: 'mountains' | 'marsh' | 'sea' | 'region' | 'river' | 'upland';
  rotate?: number;
  rank: 1 | 2 | 3;
  size?: number;
}

/** A point on a reconstructed frontline. q: a = anchored on a documented place/event, b = interpolated, c = no continuous front / gap. */
export interface FrontPoint {
  at: LonLat;
  q: 'a' | 'b' | 'c';
  place?: string;
  note?: string;
}

export interface FrontSegment {
  id: string;
  kind: 'main' | 'secondary';
  label?: string;
  points: FrontPoint[];
}

export interface HeldArea {
  id: string;
  label: string;
  side: Side;
  /** Simple ring in lon/lat. */
  ring: LonLat[];
  confidence: Confidence;
  note?: string;
}

export interface FrontlineSnapshot extends Cited {
  id: string;
  theatre: TheatreId;
  /** The date the line represents. Shown until the next snapshot of the same theatre. */
  date: ISODate;
  label: string;
  description: string;
  uncertaintyKm: number;
  segments: FrontSegment[];
  /** Areas of the defender held behind the main line (pockets, bridgeheads, besieged cities). */
  pockets?: HeldArea[];
  /** Areas held by the attacker beyond the main line (e.g. Finnish-held Karelia). */
  extraHeld?: HeldArea[];
  /** Which side holds the ground "west" of the main line (left of the north→south direction of travel). */
  westSide: Side;
  eastSide: Side;
}

export type TheatreId = 'east' | 'west' | 'italy' | 'balkans' | 'north' | 'britain' | 'poland';

export interface Camera {
  /** Centre longitude/latitude. */
  lon: number;
  lat: number;
  /** 1 = the default Europe view; 2 = twice as close, etc. */
  zoom: number;
}

export interface CampaignArrow extends Cited {
  id: string;
  operationId: string;
  side: Side;
  formationId?: string;
  label: string;
  start: ISODate;
  end: ISODate;
  /** Centre-line of the arrow in lon/lat; the head is drawn at the last point. */
  path: LonLat[];
  weight: 'major' | 'minor';
  kind: 'advance' | 'counterattack' | 'encirclement' | 'withdrawal' | 'planned';
}

export interface Objective extends Cited {
  id: string;
  operationId: string;
  label: string;
  at: LonLat;
  /** Optional objective line (e.g. the Archangel–Astrakhan line). */
  line?: LonLat[];
  /** When the objective was set (directive date). */
  set: ISODate;
  formationId?: string;
  outcome: string;
  /** Date achieved, or null if never achieved. */
  achieved: ISODate | null;
}

export interface Battle extends Cited {
  id: string;
  name: string;
  start: ISODate;
  end: ISODate;
  at: LonLat;
  theatre: TheatreId;
  operationId?: string;
  kind: 'encirclement' | 'battle' | 'siege' | 'offensive' | 'air' | 'landing' | 'counteroffensive';
  result: string;
  summary: string;
  camera?: Camera;
  axis: string[];
  opponents: string[];
}

export interface Operation extends Cited {
  id: string;
  name: string;
  codename?: string;
  start: ISODate;
  end: ISODate;
  theatre: TheatreId;
  summary: string;
  camera: Camera;
  major: boolean;
}

export interface TimelineEvent extends Cited {
  id: string;
  date: ISODate;
  endDate?: ISODate;
  title: string;
  summary: string;
  theatre: TheatreId;
  kind: 'operation' | 'battle' | 'capture' | 'political' | 'command' | 'reorganization' | 'turning-point';
  placeId?: string;
  operationId?: string;
  camera?: Camera;
  major?: boolean;
}

// ---------------------------------------------------------------------------
// Formations and command
// ---------------------------------------------------------------------------

export type Echelon =
  | 'army-group'
  | 'front'
  | 'army'
  | 'panzer-group'
  | 'panzer-army'
  | 'corps'
  | 'division'
  | 'brigade'
  | 'regiment';

export interface Person {
  id: string;
  name: string;
  /** Rank held over time (highest relevant ranks only). */
  ranks: { from: ISODate; rank: string }[];
  born?: string;
  died?: string;
  /** Only add images whose licence permits reuse; record credit + licence. */
  portrait?: { src: string; credit: string; license: string; sourceUrl?: string } | null;
  note?: string;
}

export interface CommandTenure extends Partial<Cited> {
  personId: string;
  from: ISODate;
  to?: ISODate;
  /** The appointment is only documented for this date (order-of-battle snapshot). */
  snapshot?: ISODate;
  acting?: boolean;
  note?: string;
}

export interface LineageEvent extends Partial<Cited> {
  date: ISODate;
  type: 'formed' | 'renamed' | 'redesignated' | 'split' | 'merged' | 'subordinated' | 'dissolved' | 'destroyed' | 'surrendered' | 'moved';
  text: string;
  /** Formation records this event links to (predecessor/successor). */
  related?: string[];
}

export interface Assignment {
  /** Child formation id. */
  id: string;
  from: ISODate;
  to?: ISODate;
  /** The assignment is only documented for this date (an order-of-battle snapshot); later changes are not entered. */
  snapshot?: ISODate;
  note?: string;
  confidence?: Confidence;
}

export interface Sector extends Cited {
  from: ISODate;
  to?: ISODate;
  label: string;
  ring: LonLat[];
}

export interface FormationObjective extends Cited {
  from: ISODate;
  to?: ISODate;
  text: string;
  kind: 'planned' | 'revised' | 'defensive';
}

export interface Formation {
  id: string;
  side: Side;
  nation: string;
  echelon: Echelon;
  /** Period names; the first entry is the formation's name when created. */
  names: DatedName[];
  short?: string;
  existence: { from: ISODate; to?: ISODate };
  /** Atlas colour key, used for sector tints and arrows. */
  color?: string;
  theatre?: TheatreId;
  /** Previous / next organisational record — the same name can denote different organisations. */
  predecessor?: string;
  successor?: string;
  lineage?: LineageEvent[];
  commanders?: CommandTenure[];
  hq?: { from: ISODate; to?: ISODate; text: string; at?: LonLat; sources?: SourceRef[] }[];
  subordinates?: Assignment[];
  sectors?: Sector[];
  objectives?: FormationObjective[];
  operations?: string[];
  strength?: { date: ISODate; text: string; sources: SourceRef[] }[];
  fate?: string;
  summary?: string;
  sources?: SourceRef[];
  /** For subordinate units whose details have not yet been entered. */
  incomplete?: string;
}

// ---------------------------------------------------------------------------
// Territory
// ---------------------------------------------------------------------------

export type ControlStatus =
  | 'reich'
  | 'reich-annexed'
  | 'german-occupied'
  | 'german-civil-admin'
  | 'axis'
  | 'axis-occupied'
  | 'soviet'
  | 'allied'
  | 'allied-occupied'
  | 'neutral'
  | 'vichy'
  | 'cobelligerent';

/** A clipping ring: explicit lon/lat ring, or a named composite ring assembled by the build script. */
export type RingRef = LonLat[] | { ref: string };

export interface TerritoryUnit {
  id: string;
  name: string;
  status: ControlStatus;
  note?: string;
  /** Which modern Natural Earth countries (ADM0_A3) are combined, plus clip/cut rings. */
  include: string[];
  intersect?: RingRef[];
  subtract?: RingRef[];
  /** Extra polygon added as-is. */
  add?: LonLat[][];
  confidence: Confidence;
  labelAt?: LonLat;
}

export interface TerritorySnapshot extends Cited {
  id: string;
  date: ISODate;
  label: string;
  description: string;
  units: TerritoryUnit[];
}

// ---------------------------------------------------------------------------
// Conflict package
// ---------------------------------------------------------------------------

export interface ConflictPackage {
  id: string;
  title: string;
  range: { start: ISODate; end: ISODate };
  defaultCamera: Camera;
  sources: Source[];
  places: Place[];
  physical: PhysicalLabel[];
  operations: Operation[];
  battles: Battle[];
  arrows: CampaignArrow[];
  objectives: Objective[];
  events: TimelineEvent[];
  frontlines: FrontlineSnapshot[];
  formations: Formation[];
  people: Person[];
  territorySnapshots: { id: string; date: ISODate; label: string; file: string }[];
}

import type {
  Assignment,
  Battle,
  CampaignArrow,
  CommandTenure,
  ConflictPackage,
  Formation,
  FrontlineSnapshot,
  ISODate,
  Person,
  Side,
  TheatreId,
  TimelineEvent,
} from './types.ts';

// Date helpers ---------------------------------------------------------------

const DAY = 86_400_000;
export const toTime = (d: ISODate) => Date.parse(d + 'T00:00:00Z');
export const fromTime = (t: number): ISODate => new Date(t).toISOString().slice(0, 10);
export const addDays = (d: ISODate, n: number): ISODate => fromTime(toTime(d) + Math.round(n) * DAY);
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((toTime(b) - toTime(a)) / DAY);
export const clampDate = (d: ISODate, min: ISODate, max: ISODate) => (d < min ? min : d > max ? max : d);
export const inRange = (d: ISODate, from: ISODate, to?: ISODate) => d >= from && (!to || d <= to);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDate(d: ISODate, style: 'long' | 'short' | 'month' = 'long'): string {
  const [y, m, day] = d.split('-').map(Number);
  if (style === 'month') return `${MONTHS[m - 1]} ${y}`;
  if (style === 'short') return `${day} ${MONTHS_SHORT[m - 1]} ${y}`;
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
export function formatRange(a: ISODate, b?: ISODate): string {
  if (!b || a === b) return formatDate(a, 'short');
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  const da = Number(a.slice(8)), db = Number(b.slice(8));
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS_SHORT[ma - 1]} ${ya}`;
  if (ya === yb) return `${da} ${MONTHS_SHORT[ma - 1]} – ${db} ${MONTHS_SHORT[mb - 1]} ${ya}`;
  return `${formatDate(a, 'short')} – ${formatDate(b, 'short')}`;
}

// Index ----------------------------------------------------------------------

export class ConflictIndex {
  readonly pkg: ConflictPackage;
  readonly formations = new Map<string, Formation>();
  readonly people = new Map<string, Person>();
  readonly parents = new Map<string, { parent: string; a: Assignment }[]>();
  readonly frontsByTheatre = new Map<TheatreId, FrontlineSnapshot[]>();

  constructor(pkg: ConflictPackage) {
    this.pkg = pkg;
    for (const f of pkg.formations) this.formations.set(f.id, f);
    for (const p of pkg.people) if (!this.people.has(p.id)) this.people.set(p.id, p);
    for (const f of pkg.formations) for (const a of f.subordinates ?? []) {
      const list = this.parents.get(a.id) ?? [];
      list.push({ parent: f.id, a });
      this.parents.set(a.id, list);
    }
    for (const fl of pkg.frontlines) {
      const list = this.frontsByTheatre.get(fl.theatre) ?? [];
      list.push(fl);
      this.frontsByTheatre.set(fl.theatre, list);
    }
    for (const list of this.frontsByTheatre.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  }

  formation(id: string) {
    return this.formations.get(id);
  }

  nameAt(f: Formation, date: ISODate): string {
    const n = f.names.find((x) => inRange(date, x.from, x.to));
    if (n) return n.name;
    if (date < f.names[0].from) return f.names[0].name;
    return f.names[f.names.length - 1].name;
  }

  isActive(f: Formation, date: ISODate) {
    return inRange(date, f.existence.from, f.existence.to);
  }

  /** Commander on `date`; if none recorded, the most recent earlier tenure flagged as 'last-recorded'. */
  commanderAt(f: Formation, date: ISODate): { tenure: CommandTenure; person: Person | undefined; rank: string | null; status: 'current' | 'snapshot' | 'last-recorded' } | null {
    const list = f.commanders ?? [];
    const cur = list.filter((t) => inRange(date, t.from, t.to)).sort((a, b) => b.from.localeCompare(a.from))[0];
    const pick = cur ?? list.filter((t) => t.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
    if (!pick) return null;
    const person = this.people.get(pick.personId);
    const status = cur ? (cur.snapshot ? 'snapshot' : 'current') : 'last-recorded';
    return { tenure: pick, person, rank: person ? this.rankAt(person, date) : null, status };
  }

  rankAt(p: Person, date: ISODate): string | null {
    const r = [...p.ranks].filter((x) => x.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0];
    return r ? r.rank : p.ranks[0]?.rank ?? null;
  }

  /**
   * Subordinates on `date`. Dated assignments are used when they cover the date; snapshot assignments
   * (an order of battle documented for one day) are returned with `snapshot` set so the UI can label them.
   */
  subordinatesAt(f: Formation, date: ISODate): { a: Assignment; f: Formation; snapshot?: ISODate }[] {
    const out: { a: Assignment; f: Formation; snapshot?: ISODate }[] = [];
    for (const a of f.subordinates ?? []) {
      const child = this.formations.get(a.id);
      if (!child) continue;
      if (a.snapshot) {
        if (date >= a.from) out.push({ a, f: child, snapshot: a.snapshot });
      } else if (inRange(date, a.from, a.to)) out.push({ a, f: child });
    }
    return out;
  }

  parentAt(id: string, date: ISODate): Formation | undefined {
    const list = this.parents.get(id) ?? [];
    const hit = list.find(({ a }) => (a.snapshot ? date >= a.from : inRange(date, a.from, a.to)));
    return hit ? this.formations.get(hit.parent) : undefined;
  }

  /** Predecessor → … → successor chain of organisational records. */
  lineage(f: Formation): Formation[] {
    const back: Formation[] = [];
    let cur: Formation | undefined = f;
    const seen = new Set<string>();
    while (cur?.predecessor && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = this.formations.get(cur.predecessor);
      if (cur) back.unshift(cur);
    }
    const fwd: Formation[] = [];
    cur = f;
    while (cur?.successor && !seen.has(cur.successor)) {
      seen.add(cur.id);
      cur = this.formations.get(cur.successor);
      if (cur) fwd.push(cur);
    }
    return [...back, f, ...fwd];
  }

  armyGroupsAt(date: ISODate, side?: Side): Formation[] {
    return this.pkg.formations.filter((f) => (f.echelon === 'army-group' || f.echelon === 'front') && this.isActive(f, date) && (!side || f.side === side));
  }

  sectorAt(f: Formation, date: ISODate) {
    return (f.sectors ?? []).find((s) => inRange(date, s.from, s.to));
  }

  objectivesAt(f: Formation, date: ISODate) {
    return (f.objectives ?? []).filter((o) => inRange(date, o.from, o.to));
  }

  /** Latest front snapshot on or before `date` for a theatre. */
  frontAt(theatre: TheatreId, date: ISODate): FrontlineSnapshot | undefined {
    const list = this.frontsByTheatre.get(theatre) ?? [];
    let hit: FrontlineSnapshot | undefined;
    for (const fl of list) if (fl.date <= date) hit = fl;
    return hit;
  }

  previousFront(theatre: TheatreId, date: ISODate): FrontlineSnapshot | undefined {
    const list = this.frontsByTheatre.get(theatre) ?? [];
    const cur = this.frontAt(theatre, date);
    if (!cur) return undefined;
    const i = list.indexOf(cur);
    return i > 0 ? list[i - 1] : undefined;
  }

  /** Fronts to show on a date: one per theatre, only within the theatre's active period. */
  frontsAt(date: ISODate): FrontlineSnapshot[] {
    const out: FrontlineSnapshot[] = [];
    for (const [theatre, list] of this.frontsByTheatre) {
      const f = this.frontAt(theatre, date);
      if (!f) continue;
      const last = list[list.length - 1];
      // A theatre's final snapshot stays visible for 60 days only, unless it is the end state.
      if (f === last && f.date < date && Date.parse(date) - Date.parse(f.date) > 60 * DAY && !f.id.endsWith('final')) continue;
      out.push(f);
    }
    return out;
  }

  territoryAt(date: ISODate) {
    let hit = this.pkg.territorySnapshots[0];
    for (const t of this.pkg.territorySnapshots) if (t.date <= date) hit = t;
    return hit;
  }

  /** Arrows whose stage has started by `date` (completed ones are returned with `done`). */
  arrowsAt(date: ISODate, opts: { operationId?: string | null; formationIds?: string[]; windowDays?: number } = {}): { arrow: CampaignArrow; state: 'active' | 'done' }[] {
    const windowDays = opts.windowDays ?? 75;
    return this.pkg.arrows
      .filter((a) => a.start <= date && daysBetween(a.end, date) <= windowDays)
      .filter((a) => !opts.operationId || a.operationId === opts.operationId)
      .map((arrow) => ({ arrow, state: date <= arrow.end ? ('active' as const) : ('done' as const) }));
  }

  battlesAt(date: ISODate, recentDays = 21): { battle: Battle; state: 'active' | 'recent' }[] {
    return this.pkg.battles
      .filter((b) => b.start <= date && daysBetween(b.end, date) <= recentDays)
      .map((battle) => ({ battle, state: date <= battle.end ? ('active' as const) : ('recent' as const) }));
  }

  eventsOn(date: ISODate) {
    return this.pkg.events.filter((e) => e.date === date);
  }

  latestEvent(date: ISODate, majorOnly = false): TimelineEvent | undefined {
    let hit: TimelineEvent | undefined;
    for (const e of this.pkg.events) if (e.date <= date && (!majorOnly || e.major)) hit = e;
    return hit;
  }

  nextEvent(date: ISODate, majorOnly = false): TimelineEvent | undefined {
    return this.pkg.events.find((e) => e.date > date && (!majorOnly || e.major));
  }

  prevEvent(date: ISODate, majorOnly = false): TimelineEvent | undefined {
    let hit: TimelineEvent | undefined;
    for (const e of this.pkg.events) if (e.date < date && (!majorOnly || e.major)) hit = e;
    return hit;
  }

  operationsAt(date: ISODate) {
    return this.pkg.operations.filter((o) => inRange(date, o.start, o.end));
  }
}

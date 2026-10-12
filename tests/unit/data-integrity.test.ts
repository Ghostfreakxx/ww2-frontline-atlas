import { describe, expect, it } from 'vitest';
import { ww2Europe as pkg } from '../../src/data/conflicts/ww2-europe/index.ts';
import { sourceById } from '../../src/data/conflicts/ww2-europe/sources.ts';
import { ConflictIndex } from '../../src/lib/history/query.ts';
import type { SourceRef } from '../../src/lib/history/types.ts';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: string) => ISO.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().startsWith(d);

function collectSourceRefs(obj: unknown, path: string, out: { path: string; ref: SourceRef }[]) {
  if (Array.isArray(obj)) obj.forEach((v, i) => collectSourceRefs(v, `${path}[${i}]`, out));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'sources' && Array.isArray(v)) for (const r of v) out.push({ path, ref: r as SourceRef });
      else collectSourceRefs(v, `${path}.${k}`, out);
    }
  }
}

describe('source registry', () => {
  it('every cited source id exists', () => {
    const refs: { path: string; ref: SourceRef }[] = [];
    collectSourceRefs({ ...pkg, sources: undefined }, 'pkg', refs);
    const missing = refs.filter((r) => !sourceById.has(r.ref.id)).map((r) => `${r.path} → ${r.ref.id}`);
    expect(missing).toEqual([]);
    expect(refs.length).toBeGreaterThan(300);
  });

  it('every dated record carries at least one source and a confidence', () => {
    const lists = [pkg.operations, pkg.battles, pkg.arrows, pkg.objectives, pkg.events, pkg.frontlines];
    for (const list of lists) for (const item of list as { id: string; sources: SourceRef[]; confidence: string }[]) {
      expect(item.sources.length, item.id).toBeGreaterThan(0);
      expect(['documented', 'approximate', 'schematic', 'planned', 'uncertain']).toContain(item.confidence);
    }
  });

  it('campaign arrows are always labelled schematic and objectives as planned', () => {
    expect(pkg.arrows.every((a) => a.confidence === 'schematic')).toBe(true);
    expect(pkg.objectives.every((o) => o.confidence === 'planned')).toBe(true);
  });
});

describe('dates', () => {
  it('all dates are valid ISO dates in order', () => {
    for (const e of pkg.events) expect(validDate(e.date), e.id).toBe(true);
    for (const o of pkg.operations) { expect(validDate(o.start) && validDate(o.end), o.id).toBe(true); expect(o.start <= o.end, o.id).toBe(true); }
    for (const b of pkg.battles) { expect(validDate(b.start) && validDate(b.end), b.id).toBe(true); expect(b.start <= b.end, b.id).toBe(true); }
    for (const a of pkg.arrows) { expect(validDate(a.start) && validDate(a.end), a.id).toBe(true); expect(a.start <= a.end, a.id).toBe(true); }
    for (const f of pkg.formations) {
      expect(validDate(f.existence.from), f.id).toBe(true);
      if (f.existence.to) expect(f.existence.from <= f.existence.to, f.id).toBe(true);
      for (const c of f.commanders ?? []) { expect(validDate(c.from), f.id).toBe(true); if (c.to) expect(c.from <= c.to, `${f.id} ${c.personId}`).toBe(true); }
    }
  });

  it('events are sorted chronologically and lie within the conflict range', () => {
    const dates = pkg.events.map((e) => e.date);
    expect([...dates].sort()).toEqual(dates);
    for (const d of dates) { expect(d >= pkg.range.start).toBe(true); expect(d <= pkg.range.end).toBe(true); }
  });

  it('event ids are unique', () => {
    const ids = pkg.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formations', () => {
  const idx = new ConflictIndex(pkg);

  it('formation ids are unique and all references resolve', () => {
    const ids = pkg.formations.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const problems: string[] = [];
    for (const f of pkg.formations) {
      for (const s of f.subordinates ?? []) if (!idx.formations.has(s.id)) problems.push(`${f.id} → subordinate ${s.id}`);
      if (f.predecessor && !idx.formations.has(f.predecessor)) problems.push(`${f.id} → predecessor ${f.predecessor}`);
      if (f.successor && !idx.formations.has(f.successor)) problems.push(`${f.id} → successor ${f.successor}`);
      for (const c of f.commanders ?? []) if (!idx.people.has(c.personId)) problems.push(`${f.id} → person ${c.personId}`);
      for (const l of f.lineage ?? []) for (const r of l.related ?? []) if (!idx.formations.has(r)) problems.push(`${f.id} lineage → ${r}`);
    }
    for (const b of pkg.battles) for (const id of [...b.axis, ...b.opponents]) if (!idx.formations.has(id)) problems.push(`battle ${b.id} → ${id}`);
    for (const a of pkg.arrows) if (a.formationId && !idx.formations.has(a.formationId)) problems.push(`arrow ${a.id} → ${a.formationId}`);
    expect(problems).toEqual([]);
  });

  it('commander tenures of a formation do not overlap', () => {
    const problems: string[] = [];
    for (const f of pkg.formations) {
      const list = [...(f.commanders ?? [])].sort((a, b) => a.from.localeCompare(b.from));
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        if (prev.to && prev.to > list[i].from) problems.push(`${f.id}: ${prev.personId} (${prev.to}) overlaps ${list[i].personId} (${list[i].from})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('predecessor/successor links are symmetric where both ends declare them', () => {
    for (const f of pkg.formations) {
      if (f.successor) {
        const s = idx.formations.get(f.successor)!;
        if (s.predecessor) expect(s.predecessor, `${f.id} → ${s.id}`).toBe(f.id);
      }
    }
  });

  it('operations referenced by formations exist', () => {
    const ops = new Set(pkg.operations.map((o) => o.id));
    const missing = pkg.formations.flatMap((f) => (f.operations ?? []).filter((o) => !ops.has(o)).map((o) => `${f.id} → ${o}`));
    expect(missing).toEqual([]);
  });
});

describe('places and geometry', () => {
  it('coordinates lie within the map extent', () => {
    for (const p of pkg.places) {
      expect(p.at[0], p.id).toBeGreaterThan(-25);
      expect(p.at[0], p.id).toBeLessThan(90);
      expect(p.at[1], p.id).toBeGreaterThan(27);
      expect(p.at[1], p.id).toBeLessThan(78);
    }
  });

  it('frontline points run north to south overall and have quality flags', () => {
    for (const fl of pkg.frontlines) for (const seg of fl.segments) {
      if (seg.kind !== 'main' || fl.theatre !== 'east') continue;
      const first = seg.points[0].at[1], last = seg.points[seg.points.length - 1].at[1];
      expect(first, fl.id).toBeGreaterThan(last);
      for (const p of seg.points) expect(['a', 'b', 'c']).toContain(p.q);
    }
  });

  it('front snapshot ids are unique and every theatre has at least one snapshot per year of fighting', () => {
    const ids = pkg.frontlines.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const eastYears = new Set(pkg.frontlines.filter((f) => f.theatre === 'east').map((f) => f.date.slice(0, 4)));
    expect([...eastYears].sort()).toEqual(['1941', '1942', '1943', '1944', '1945']);
  });

  it('place ids referenced by events exist', () => {
    const ids = new Set(pkg.places.map((p) => p.id));
    const missing = pkg.events.filter((e) => e.placeId && !ids.has(e.placeId)).map((e) => `${e.id} → ${e.placeId}`);
    expect(missing).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { ww2Europe as pkg } from '../../src/data/conflicts/ww2-europe/index.ts';
import { ConflictIndex, addDays, formatDate, formatRange } from '../../src/lib/history/query.ts';

const idx = new ConflictIndex(pkg);
const f = (id: string) => idx.formation(id)!;

describe('time-aware command queries', () => {
  it('Army Group Centre commander changes with the date', () => {
    expect(idx.commanderAt(f('de-hg-centre'), '1941-06-22')?.person?.name).toBe('Fedor von Bock');
    expect(idx.commanderAt(f('de-hg-centre'), '1941-12-25')?.person?.name).toBe('Günther von Kluge');
    expect(idx.commanderAt(f('de-hg-centre'), '1944-07-10')?.person?.name).toBe('Walter Model');
  });

  it('Army Group South: Rundstedt → Reichenau → Bock', () => {
    expect(idx.commanderAt(f('de-hg-south'), '1941-11-30')?.person?.name).toBe('Gerd von Rundstedt');
    expect(idx.commanderAt(f('de-hg-south'), '1941-12-15')?.person?.name).toBe('Walter von Reichenau');
    expect(idx.commanderAt(f('de-hg-south'), '1942-03-01')?.person?.name).toBe('Fedor von Bock');
  });

  it('rank is date-aware (Bock promoted field marshal 19 July 1940)', () => {
    const bock = idx.people.get('bock')!;
    expect(idx.rankAt(bock, '1940-05-10')).toBe('Generaloberst');
    expect(idx.rankAt(bock, '1941-06-22')).toBe('Generalfeldmarschall');
  });

  it('same name, different organisation: three "Army Group North" records', () => {
    const norths = pkg.formations.filter((x) => x.echelon === 'army-group' && x.names.some((n) => /^Army Group North( \(\d{4}\))?$/.test(n.name)));
    expect(norths.map((n) => n.id).sort()).toEqual(['de-hg-north', 'de-hg-north-1939', 'de-hg-north-1945']);
    expect(idx.lineage(f('de-hg-centre')).map((x) => x.id)).toEqual(['de-hg-north-1939', 'de-hg-b-1939', 'de-hg-centre', 'de-hg-north-1945']);
    expect(idx.lineage(f('de-hg-north')).map((x) => x.id)).toEqual(['de-hg-c-1939', 'de-hg-north', 'de-hg-courland']);
  });

  it('panzer group renamed to panzer army on the right date', () => {
    expect(idx.nameAt(f('de-pzgr-2'), '1941-09-01')).toBe('Panzer Group 2');
    expect(idx.nameAt(f('de-pzgr-2'), '1941-10-10')).toBe('2nd Panzer Army');
  });

  it('subordinates are date-aware; Panzer Group 4 moves from North to Centre', () => {
    const north = idx.subordinatesAt(f('de-hg-north'), '1941-07-01').map((s) => s.f.id);
    expect(north).toContain('de-pzgr-4');
    expect(idx.subordinatesAt(f('de-hg-north'), '1941-10-01').map((s) => s.f.id)).not.toContain('de-pzgr-4');
    expect(idx.subordinatesAt(f('de-hg-centre'), '1941-10-01').map((s) => s.f.id)).toContain('de-pzgr-4');
  });

  it('June 1941 order of battle reaches division level and labels the snapshot', () => {
    const corps = idx.subordinatesAt(f('de-pzgr-4'), '1941-06-22');
    const lvi = corps.find((c) => c.f.id === 'de-corps-lvi')!;
    expect(lvi.snapshot).toBe('1941-06-22');
    expect(idx.subordinatesAt(lvi.f, '1941-06-22').map((d) => idx.nameAt(d.f, '1941-06-22'))).toContain('8th Panzer Division');
    expect(idx.commanderAt(lvi.f, '1941-06-22')?.person?.name).toBe('Erich von Manstein');
  });

  it('active army groups on 22 June 1941 are North, Centre, South, D', () => {
    const ids = idx.armyGroupsAt('1941-06-22', 'axis').map((x) => x.id).sort();
    expect(ids).toEqual(['de-hg-centre', 'de-hg-d', 'de-hg-north', 'de-hg-south']);
  });
});

describe('frontlines and timeline', () => {
  it('frontAt returns the latest snapshot on or before the date', () => {
    expect(idx.frontAt('east', '1941-06-21')).toBeUndefined();
    expect(idx.frontAt('east', '1941-06-22')?.id).toBe('east-1941-06-22');
    expect(idx.frontAt('east', '1941-08-01')?.id).toBe('east-1941-07-09');
    expect(idx.frontAt('east', '1941-12-05')?.id).toBe('east-1941-12-05');
  });

  it('next/previous event navigation is strictly ordered', () => {
    let d = '1941-06-21';
    const seen: string[] = [];
    for (let i = 0; i < 10; i++) {
      const e = idx.nextEvent(d)!;
      expect(e.date > d).toBe(true);
      seen.push(e.date);
      d = e.date;
    }
    expect(seen[0]).toBe('1941-06-22');
    expect(idx.prevEvent('1941-06-22')!.date < '1941-06-22').toBe(true);
  });

  it('arrows appear only after their start date', () => {
    expect(idx.arrowsAt('1941-06-21').every((x) => x.arrow.start <= '1941-06-21')).toBe(true);
    expect(idx.arrowsAt('1941-06-21', { operationId: 'barbarossa' }).length).toBe(0);
    const a = idx.arrowsAt('1941-06-25').map((x) => x.arrow.id);
    expect(a).toContain('a-pzgr3-minsk');
    expect(a).not.toContain('a-typhoon-pzgr3');
  });

  it('date helpers', () => {
    expect(addDays('1941-06-22', 10)).toBe('1941-07-02');
    expect(formatDate('1941-06-22')).toBe('22 June 1941');
    expect(formatRange('1941-06-22', '1941-07-09')).toBe('22 Jun – 9 Jul 1941');
  });
});

import { describe, expect, it } from 'vitest';
import { CARE_LABOUR_PER_ACRE, SEED_PER_ACRE, TITHE_RATE } from './balance';
import { dayIndexOf, dayInfo } from './calendar';
import { dailyFarm, fieldTask, manureFactor, rollYield, workStrips } from './farm';
import { createState, type SimState } from './state';
import { weatherFor } from './weather';

const W = { tempC: 12, sky: 'fair' as const, cropQuality: 0, morale: 0 };
const fresh = (): SimState => createState(1, 0);
const on = (y: number, m: number, d: number) => dayInfo(dayIndexOf(y, m, d));

describe('agriculture', () => {
  it('starts with a growing winter field, an unsown spring field and a fallow', () => {
    const s = fresh();
    expect(s.fields.map((f) => [f.kind, f.stage])).toEqual([['winter', 'growing'], ['spring', 'unsown'], ['fallow', 'fallow']]);
    expect(fieldTask(s, on(1345, 3, 25))).toMatchObject({ task: 'sow', field: { kind: 'spring' } });
  });
  it('sowing takes labour and seed grain', () => {
    const s = fresh();
    const i = on(1345, 3, 26);
    const grain = s.wealth.grain;
    for (let n = 0; n < 20 && s.fields[1]!.stage === 'unsown'; n++) workStrips(s, i);
    expect(s.fields[1]!.stage).toBe('growing');
    expect(s.wealth.grain).toBe(grain - s.fields[1]!.acres * SEED_PER_ACRE);
    expect(s.fields[1]!.sownShare).toBe(1);
  });
  it('sows only part of the field when seed runs short', () => {
    const s = fresh();
    s.wealth.grain = 2;
    for (let n = 0; n < 20 && s.fields[1]!.stage === 'unsown'; n++) workStrips(s, on(1345, 3, 26));
    expect(s.fields[1]!.sownShare).toBeCloseTo(2 / (s.fields[1]!.acres * SEED_PER_ACRE));
  });
  it('an unsown spring field lies idle when the window closes', () => {
    const s = fresh();
    dailyFarm(s, on(1345, 5, 1), W);
    expect(s.fields[1]!.stage).toBe('harvested');
    expect(s.log.at(-1)!.text).toMatch(/never sown/);
  });
  it('yield rolls by weather, labour (care) and manure', () => {
    const avg = (mod: (s: SimState) => void) => {
      let t = 0;
      for (let i = 0; i < 50; i++) {
        const s = createState(i, 0);
        mod(s);
        t += rollYield(s, s.fields[0]!);
      }
      return t / 50;
    };
    const base = avg(() => {});
    expect(avg((s) => { s.fields[0]!.weatherSum = 30; s.fields[0]!.weatherDays = 100; })).toBeGreaterThan(base);
    expect(avg((s) => { s.fields[0]!.careLabour = s.fields[0]!.acres * CARE_LABOUR_PER_ACRE; })).toBeGreaterThan(base);
    expect(avg((s) => { s.wealth.cow = 1; s.wealth.ox = 1; })).toBeGreaterThan(base);
    const s = fresh(); const m = manureFactor(s); s.wealth.pig = 0; expect(manureFactor(s)).toBeLessThan(m);
  });
  it('ripens in August, then harvest labour brings in grain less a 10% tithe', () => {
    const s = fresh();
    for (let d = dayIndexOf(1345, 7, 1); d <= dayIndexOf(1345, 8, 1); d++) dailyFarm(s, dayInfo(d), weatherFor(1, d));
    const f = s.fields[0]!;
    expect(f.stage).toBe('ripe');
    const grain = s.wealth.grain;
    const piety = s.soul.publicPiety;
    for (let n = 0; n < 40 && f.stage === 'ripe'; n++) workStrips(s, on(1345, 8, 2));
    expect(f.stage).toBe('harvested');
    expect(f.harvested).toBeCloseTo(f.expectedYield, 5);
    expect(s.wealth.grain - grain).toBeCloseTo(f.expectedYield * (1 - TITHE_RATE), 5);
    expect(s.soul.publicPiety).toBeGreaterThan(piety);
    expect(s.log.at(-1)!.text).toMatch(/Tithe/);
  });
  it('an unharvested crop mostly rots when the harvest window closes', () => {
    const s = fresh();
    const f = s.fields[0]!;
    f.stage = 'ripe'; f.expectedYield = 100;
    const grain = s.wealth.grain;
    dailyFarm(s, on(1345, 10, 1), W); // the same dawn also turns the fields
    expect(s.wealth.grain - grain).toBeCloseTo(30 * (1 - TITHE_RATE));
    expect(s.log.some((e) => /rotting/.test(e.text))).toBe(true);
  });
  it('rotates winter -> spring -> fallow -> winter when the winter sowing opens', () => {
    const s = fresh();
    dailyFarm(s, on(1345, 10, 1), W);
    expect(s.fields.map((f) => [f.kind, f.stage])).toEqual([['spring', 'harvested'], ['fallow', 'fallow'], ['winter', 'unsown']]);
    expect(['wheat', 'rye']).toContain(s.fields[2]!.crop);
    dailyFarm(s, on(1346, 3, 1), W);
    expect(s.fields[0]!.stage).toBe('unsown');
    expect(['barley', 'oats', 'peas']).toContain(s.fields[0]!.crop);
  });
});

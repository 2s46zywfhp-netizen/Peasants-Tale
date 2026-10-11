import { describe, expect, it } from 'vitest';
import { HUNGRY_GAP } from './balance';
import { foodServings, grainBuyPrice } from './actions';
import { dayInfo } from './calendar';
import { createLife, debugFastForward } from './sim';

describe('the Hungry Gap (April to June)', () => {
  it('grain is dearer at market in the gap', () => {
    for (const m of HUNGRY_GAP.months) expect(grainBuyPrice(m)).toBeGreaterThan(grainBuyPrice(9));
  });

  it('for an ordinary life left to habit, the larder is leanest in the gap', () => {
    const byMonth = new Map<number, number[]>();
    for (const seed of [11, 23, 37]) {
      let s = createLife(seed, 0);
      for (let d = 0; d < 730; d++) {
        s = debugFastForward(s, 6, 0);
        if (s.dead) break;
        const m = dayInfo(d).month;
        if (!byMonth.has(m)) byMonth.set(m, []);
        byMonth.get(m)!.push(foodServings(s) + s.wealth.grain * 4);
      }
    }
    const mean = (m: number) => byMonth.get(m)!.reduce((a, b) => a + b, 0) / byMonth.get(m)!.length;
    const months = [...byMonth.keys()];
    const gap = HUNGRY_GAP.months.reduce((a, m) => a + mean(m), 0) / HUNGRY_GAP.months.length;
    const rest = months.filter((m) => !HUNGRY_GAP.months.includes(m));
    const other = rest.reduce((a, m) => a + mean(m), 0) / rest.length;
    expect(gap).toBeLessThan(other);
  }, 60_000);
});

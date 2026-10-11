import { describe, expect, it } from 'vitest';
import { createLife } from '../sim/sim';
import { talk } from './talk';

describe('villager talk', () => {
  it('neighbours do not all say the same thing', () => {
    const s = createLife(3, 0);
    const lines = new Set(s.village.map((v) => talk('villager', s, v.id).pages.join(' / ')));
    expect(lines.size).toBeGreaterThanOrEqual(12);
  });
  it('the same villager says different things across a day', () => {
    const s = createLife(4, 0);
    const said = new Set<string>();
    for (let b = 0; b < 12; b++) {
      s.block = b;
      said.add(talk('villager', s, 'godric').pages[1]!);
    }
    expect(said.size).toBeGreaterThanOrEqual(3);
  });
  it('a friend greets warmly and an enemy coldly', () => {
    const s = createLife(5, 0);
    const v = s.village[3]!;
    v.opinion = 80;
    const warm = talk('villager', s, v.id).pages[0]!;
    v.opinion = -80;
    const cold = talk('villager', s, v.id).pages[0]!;
    expect(warm).not.toBe(cold);
  });
});

import { describe, expect, it } from 'vitest';
import { BLOCK_MS, INHERIT_OPINION } from './balance';
import { bury, heirOf } from './bloodline';
import { act, advance, createLife } from './sim';
import { peasant, type SimState } from './state';

const grownSon = (s: SimState) => {
  s.members[2]!.bornDay = -16 * 365;
};

describe('death and the bloodline', () => {
  it('the widow inherits when the only child is young; the lord takes the best beast', () => {
    const s = createLife(1, 0);
    s.obligations.debt = 9;
    s.standing.lord = 90;
    s.village[0]!.opinion = -60;
    const wife = s.members[1]!;
    expect(heirOf(s)).toBe(wife);
    bury(s, peasant(s), 'of the fever');
    expect(peasant(s)).toBe(wife);
    expect(wife.role).toBe('peasant');
    expect(s.wealth.pig).toBe(0); // heriot
    expect(s.obligations.debt).toBe(9); // debts pass to the heir
    expect(s.standing.lord).toBe(70); // half the distance from 50
    expect(s.village[0]!.opinion).toBe(Math.round(-60 * INHERIT_OPINION)); // grudges carry
    expect(s.wealth.acres).toBe(15); // the land
    expect(s.generation).toBe(2);
    expect(s.chronicle).toHaveLength(2);
    expect(s.chronicle[0]!.diedYear).toBe(1345);
    expect(s.chronicle[0]!.cause).toBe('of the fever');
    expect(s.chronicle[1]!.name).toContain(wife.name);
    expect(s.dead).toBe(false);
  });

  it('an eldest child of fourteen comes first; the surviving parent stays on', () => {
    const s = createLife(2, 0);
    grownSon(s);
    const son = s.members[2]!;
    bury(s, peasant(s), 'of the flux');
    expect(peasant(s)).toBe(son);
    expect(s.members.find((m) => m.role === 'parent')).toBeDefined();
  });

  it('with nobody left, the line ends', () => {
    const s = createLife(3, 0);
    s.members = s.members.slice(0, 1);
    bury(s, peasant(s), 'of hunger');
    expect(s.dead).toBe(true);
    expect(s.log.at(-1)!.text).toContain('No one is left');
  });

  it('death in play hands over to the heir and the life goes on', () => {
    let s = createLife(4, 0);
    s = advance(s, 6 * BLOCK_MS + 1).state;
    s.members[0]!.body.health = 0.5;
    s.members[0]!.body.illness = { kind: 'fever', daysLeft: 5 };
    const heir = s.members[1]!.name;
    s = advance(s, 13 * BLOCK_MS + 1).state;
    expect(peasant(s).name).toBe(heir);
    expect(s.log.some((e) => e.type === 'death' && e.text.includes('now head'))).toBe(true);
    const r = act(s, 'rest', 13 * BLOCK_MS + 2);
    expect(r.ok).toBe(true);
  });
});

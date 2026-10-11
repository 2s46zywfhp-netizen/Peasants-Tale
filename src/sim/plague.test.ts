import { describe, expect, it } from 'vitest';
import { PLAGUE } from './balance';
import { dayIndexOf, dayInfo } from './calendar';
import { dailyPlague, phaseOn, PLAGUE_DAYS } from './plague';
import { createLife, debugFastForward } from './sim';

describe('the Black Death, 1348', () => {
  it('is fixed to the calendar: omens from June 1348, outbreak October, aftermath June 1349, over at Lady Day 1350', () => {
    expect(phaseOn(dayIndexOf(1348, 5, 31))).toBe('none');
    expect(phaseOn(dayIndexOf(1348, 6, 1))).toBe('omens');
    expect(phaseOn(dayIndexOf(1348, 10, 1))).toBe('outbreak');
    expect(phaseOn(dayIndexOf(1349, 5, 31))).toBe('outbreak');
    expect(phaseOn(dayIndexOf(1349, 6, 1))).toBe('aftermath');
    expect(phaseOn(dayIndexOf(1350, 3, 25))).toBe('over');
  });

  it('runs its course in the village: omens, mass death, vacant holdings, dear wages, a tighter lord', () => {
    const s = createLife(1348, 0);
    s.members = s.members.slice(0, 1);
    s.members[0]!.body.health = 1e9; // keep the observer alive
    for (let d = PLAGUE_DAYS.omens - 1; d <= PLAGUE_DAYS.over; d++) {
      s.block = d * 6;
      dailyPlague(s, dayInfo(d));
      if (s.members[0]!.body.illness) s.members[0]!.body.illness = null;
    }
    const texts = s.log.filter((e) => e.type === 'plague').map((e) => e.text);
    expect(texts.some((t) => t.includes('June, 1348'))).toBe(true);
    expect(texts.some((t) => /Rats|birds|Melcombe|Bristol|star/.test(t))).toBe(true);
    expect(texts.some((t) => t.includes('pestilence is in Ashby'))).toBe(true);
    expect(texts.some((t) => t.includes('Ordinance of Labourers'))).toBe(true);
    expect(texts.at(-1)).toContain('has passed');
    expect(s.plague.phase).toBe('over');
    const dead = s.village.filter((v) => !v.alive).length;
    expect(dead).toBeGreaterThanOrEqual(2);
    expect(dead).toBeLessThan(13);
    expect(s.plague.vacant).toBeGreaterThan(1);
    expect(s.wageMult).toBe(PLAGUE.wageMult);
    expect(s.lordGrip).toBeGreaterThan(1);
  });

  it('fires and resolves in a played life, whatever becomes of the family', () => {
    const start = dayIndexOf(1348, 5, 1);
    let s = createLife(77, 0);
    s = debugFastForward(s, start * 6, 1);
    const end = dayIndexOf(1350, 4, 1);
    s = debugFastForward(s, (end - start) * 6, 1);
    expect(s.block).toBe(end * 6);
    expect(s.plague.phase === 'over' || s.dead).toBe(true);
    if (!s.dead) expect(s.log.some((e) => e.type === 'plague' && e.text.includes('has passed'))).toBe(true);
  }, 60_000);
});

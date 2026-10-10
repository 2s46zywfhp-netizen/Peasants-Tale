import { describe, expect, it } from 'vitest';
import { createLife } from '../sim/sim';
import { addTag } from '../sim/state';
import { almanacLines, dutyLines, householdLines, selfLines, soulLines, standingLines } from './symptoms';

describe('stat screen symptoms', () => {
  it('describes the body in symptoms, never numbers', () => {
    const s = createLife(1, 0);
    const b = s.members[0]!.body;
    b.reserve = 45; b.hunger = 80; b.warmth = 10; b.filth = 90;
    b.illness = { kind: 'fever', daysLeft: 3 };
    const l = selfLines(s);
    expect(l).toContain('Your belt is looser.');
    expect(l).toContain('You are faint with hunger.');
    expect(l).toContain('You shiver to the bone.');
    expect(l).toContain('Lice crawl in your hair.');
    expect(l).toContain('A fever burns in you.');
  });
  it('never shows a digit on any page', () => {
    const s = createLife(1, 0);
    addTag(s, 'heathen', 99);
    s.obligations.debt = 5;
    for (const lines of [selfLines(s), householdLines(s), soulLines(s), standingLines(s), dutyLines(s)]) {
      for (const l of lines) expect(l, l).not.toMatch(/\d/);
    }
    expect(standingLines(s)).toContain('Mothers pull their children away from you.');
  });
  it('the almanac names date, moon and weather', () => {
    const l = almanacLines(createLife(1, 0), 0);
    expect(l[0]).toBe('FRI 25 MAR 1345');
    expect(l.some((x) => /moon/.test(x))).toBe(true);
  });
});

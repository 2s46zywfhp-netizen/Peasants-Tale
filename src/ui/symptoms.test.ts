import { describe, expect, it } from 'vitest';
import { createLife } from '../sim/sim';
import { addTag } from '../sim/state';
import { bury } from '../sim/bloodline';
import { almanacLines, chronicleLines, dutyLines, householdLines, selfLines, soulLines, standingLines, villageLines } from './symptoms';

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
    for (const lines of [selfLines(s), householdLines(s), soulLines(s), standingLines(s), dutyLines(s), villageLines(s)]) {
      for (const l of lines) expect(l, l).not.toMatch(/\d/);
    }
    expect(standingLines(s)).toContain('Mothers pull their children away from you.');
  });
  it('shows each member of the family, their age in words and their condition', () => {
    const s = createLife(2, 0);
    s.members[2]!.body.hunger = 80;
    const l = householdLines(s);
    expect(l).toContain(`Your wife ${s.members[1]!.name}, grown.`);
    expect(l).toContain(`Your son ${s.members[2]!.name}, a child.`);
    expect(l).toContain(`${s.members[2]!.name} is faint with hunger.`);
    expect(selfLines(s)[0]).toBe(`${s.members[0]!.name} ${s.familyName}, a villein of the manor.`);
  });
  it('the village page names every villager and the favours owed', () => {
    const s = createLife(3, 0);
    s.village[5]!.owes = 2;
    s.village[6]!.alive = false;
    const l = villageLines(s);
    expect(l.some((x) => x.startsWith(s.village[5]!.name) && x.includes('owes you favours'))).toBe(true);
    expect(l).toContain(`${s.village[6]!.name} lies in the churchyard.`);
  });
  it('the chronicle records each generation', () => {
    const s = createLife(4, 0);
    bury(s, s.members[0]!, 'of the fever');
    const l = chronicleLines(s);
    expect(l[0]).toContain(s.familyName);
    expect(l.some((x) => /^I\. .*13[01]\d-1345/.test(x))).toBe(true);
    expect(l).toContain('Died of the fever.');
    expect(l.some((x) => x.startsWith('II. ') && x.includes('living'))).toBe(true);
  });
  it('the almanac names date, moon and weather', () => {
    const l = almanacLines(createLife(1, 0), 0);
    expect(l[0]).toBe('FRI 25 MAR 1345');
    expect(l.some((x) => /moon/.test(x))).toBe(true);
  });
});

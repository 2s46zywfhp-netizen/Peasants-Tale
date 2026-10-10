import { describe, expect, it } from 'vitest';
import { CONCEPTION, COURTSHIP, MERCHET_PENCE } from './balance';
import { dayIndexOf, dayInfo } from './calendar';
import { childLabour, court, courtShort, dailyFamily, frailty, marry, marryShort, spouse } from './family';
import { labourPerBlock } from './farm';
import { createLife } from './sim';
import { ageOf, type SimState } from './state';
import { villager } from './village';

const widow = (s: SimState) => {
  s.members = s.members.filter((m) => m.role !== 'spouse');
};

describe('family', () => {
  it('starts with a man of 28, a wife of 25 and a son of 6, each with their own body', () => {
    const s = createLife(1, 0);
    expect(s.members.map((m) => [m.role, m.sex, ageOf(m.bornDay, 0)])).toEqual([
      ['peasant', 'm', 28], ['spouse', 'f', 25], ['child', 'm', 6],
    ]);
    expect(new Set(s.members.map((m) => m.body)).size).toBe(3);
  });

  it('children work from seven: labour rises; small children sicken more easily', () => {
    const s = createLife(2, 0);
    const kid = s.members[2]!;
    expect(childLabour(s)).toBe(0);
    expect(frailty(kid, 0)).toBeGreaterThan(1);
    const base = labourPerBlock(s);
    s.block = 400 * 6;
    expect(ageOf(kid.bornDay, 400)).toBe(7);
    expect(childLabour(s)).toBeGreaterThan(0);
    expect(labourPerBlock(s)).toBeGreaterThan(base);
    expect(frailty(kid, 400)).toBe(1);
  });

  it('a married woman of age conceives, and a child is born after nine months', () => {
    const s = createLife(3, 0);
    let d = 1;
    while (s.family.pregnantSince === null && d < 3000) dailyFamily(s, dayInfo(d++));
    expect(s.family.pregnantSince).not.toBeNull();
    const n = s.members.length;
    const due = s.family.pregnantSince! + CONCEPTION.pregnancyDays;
    for (; d <= due; d++) {
      s.block = d * 6;
      dailyFamily(s, dayInfo(d));
    }
    expect(s.members.length).toBe(n + 1);
    expect(s.members.at(-1)!.role).toBe('child');
    expect(s.log.some((e) => e.type === 'family' && e.text.includes('is born'))).toBe(true);
  });

  it('courtship goes faster on feast days; marriage needs the merchet paid', () => {
    const s = createLife(4, 0);
    expect(courtShort(s, 'emma')).toBe('ALREADY WED');
    widow(s);
    expect(courtShort(s, 'thomas')).toBe('NOT FREE TO WED'); // a man
    expect(courtShort(s, 'margery')).toBe('NOT FREE TO WED'); // married
    expect(courtShort(s, 'emma')).toBeNull();
    const emma = villager(s, 'emma')!;
    court(s, 'emma', dayInfo(4)); // a weekday
    expect(emma.courtship).toBe(COURTSHIP.ordinary);
    court(s, 'emma', dayInfo(dayIndexOf(1345, 5, 1))); // May Day
    expect(emma.courtship).toBe(COURTSHIP.ordinary + COURTSHIP.feast);
    expect(marryShort(s, 'emma')).toBe('NOT WON YET');
    while (emma.courtship < COURTSHIP.needed) court(s, 'emma', dayInfo(0));
    emma.opinion = Math.max(emma.opinion, 10);
    s.wealth.pence = MERCHET_PENCE - 1;
    expect(marryShort(s, 'emma')).toBe(`MERCHET ${MERCHET_PENCE}D`);
    s.wealth.pence = MERCHET_PENCE + 5;
    expect(marryShort(s, 'emma')).toBeNull();
    marry(s, 'emma', dayInfo(30));
    expect(s.wealth.pence).toBe(5);
    expect(spouse(s)!.name).toBe('EMMA');
    expect(emma.gone).toBe(true);
    expect(s.chronicle[0]!.notes.some((n) => n.includes('Married'))).toBe(true);
  });

  it('a free family pays no merchet', () => {
    const s = createLife(5, 0);
    widow(s);
    s.station.free = true;
    const emma = villager(s, 'emma')!;
    emma.courtship = COURTSHIP.needed;
    emma.opinion = 20;
    s.wealth.pence = 0;
    expect(marryShort(s, 'emma')).toBeNull();
  });

  it('grown children who are not the heir leave home in time', () => {
    const s = createLife(6, 0);
    const kid2 = { ...s.members[2]!, id: 'x', name: 'NED', bornDay: s.members[2]!.bornDay + 300 };
    s.members.push(kid2);
    let d = 11 * 365;
    while (s.members.includes(kid2) && d < 30 * 365) {
      s.family.pregnantSince = null;
      dailyFamily(s, dayInfo(d++));
    }
    expect(s.members.includes(kid2)).toBe(false);
    expect(s.members.some((m) => m.id === 'child1')).toBe(true); // the eldest, the heir, stays
  });
});

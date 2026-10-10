import { describe, expect, it } from 'vitest';
import { FINE_PENCE, MEAL_VALUE, RENT_PENCE, STRIKE_FORGIVE_DAYS, WEEK_WORK_MIN_BLOCKS } from './balance';
import { dayIndexOf, dayInfo } from './calendar';
import { creditWeekWork, dawnObligations, endOfDayObligations, isBoonDay, isWeekWorkDay, strike } from './obligations';
import { createState, hasTag, peasant } from './state';

const on = (y: number, m: number, d: number) => dayInfo(dayIndexOf(y, m, d));

describe('manorial obligations', () => {
  it('owes week-work three days a week, but not on holy days', () => {
    const week = Array.from({ length: 7 }, (_, i) => dayInfo(14 + i)).filter(isWeekWorkDay);
    expect(week).toHaveLength(3);
    expect(isWeekWorkDay(on(1345, 12, 26))).toBe(false); // Twelve Days
  });
  it('missing week-work escalates: fine -> suspicion -> manor court -> eviction', () => {
    const s = createState(1, 0);
    const owed = Array.from({ length: 40 }, (_, i) => dayInfo(3 + i)).filter(isWeekWorkDay);
    const pence = s.wealth.pence;
    endOfDayObligations(s, owed[0]!);
    expect(s.wealth.pence).toBe(pence - FINE_PENCE);
    endOfDayObligations(s, owed[1]!);
    expect(hasTag(s, 'suspect')).toBe(true);
    endOfDayObligations(s, owed[2]!);
    expect(s.obligations.manorCourtDay).toBe(owed[2]!.dayIndex + 7);
    dawnObligations(s, dayInfo(owed[2]!.dayIndex + 7));
    expect(s.obligations.manorCourtHeld).toBe(true);
    expect(s.obligations.evicted).toBe(false);
    endOfDayObligations(s, dayInfo(owed[2]!.dayIndex + 8 + (isWeekWorkDay(dayInfo(owed[2]!.dayIndex + 8)) ? 0 : 1)));
    strike(s, owed[2]!.dayIndex + 9, 'test');
    expect(s.obligations.evicted).toBe(true);
    expect(s.wealth.acres).toBe(0);
  });
  it('doing the week-work clears the day', () => {
    const s = createState(1, 0);
    const i = dayInfo(3);
    expect(isWeekWorkDay(i)).toBe(true);
    for (let n = 0; n < WEEK_WORK_MIN_BLOCKS; n++) creditWeekWork(s, i);
    endOfDayObligations(s, i);
    expect(s.obligations.strikes).toBe(0);
  });
  it('old strikes are forgiven after a long clean spell', () => {
    const s = createState(1, 0);
    strike(s, 10, 'x');
    dawnObligations(s, dayInfo(10 + STRIKE_FORGIVE_DAYS));
    expect(s.obligations.strikes).toBe(0);
  });
  it('boon days at harvest and ploughing come with a meal from the lord', () => {
    const boons = Array.from({ length: 365 }, (_, d) => dayInfo(d)).filter(isBoonDay);
    expect(boons.map((b) => b.month)).toEqual(expect.arrayContaining([8, 10]));
    expect(boons.every((b) => b.month === 8 || b.month === 10)).toBe(true);
    const s = createState(1, 0);
    peasant(s).body.hunger = 80;
    for (let n = 0; n < WEEK_WORK_MIN_BLOCKS; n++) creditWeekWork(s, boons[0]!);
    expect(peasant(s).body.hunger).toBe(80 - MEAL_VALUE.boon);
    expect(s.obligations.boonMealToday).toBe(true);
  });
  it('rent falls due at Michaelmas; a shortfall is a debt and a strike', () => {
    const paid = createState(1, 0);
    paid.wealth.pence = RENT_PENCE + 5;
    dawnObligations(paid, on(1345, 9, 29));
    expect(paid.wealth.pence).toBe(5);
    const short = createState(1, 0);
    short.wealth.pence = 10;
    dawnObligations(short, on(1345, 9, 29));
    expect(short.obligations.debt).toBe(RENT_PENCE - 10 + FINE_PENCE);
    expect(hasTag(short, 'debtor')).toBe(true);
    expect(short.obligations.strikes).toBe(1);
    short.wealth.pence = 100;
    dawnObligations(short, on(1345, 9, 30));
    expect(short.obligations.debt).toBe(0);
    expect(hasTag(short, 'debtor')).toBe(false);
  });
});

describe('church obligations', () => {
  it('skipping Sunday mass costs priest standing and public piety and marks a heathen', () => {
    const s = createState(1, 0);
    const sunday = dayInfo(2);
    const before = { ...s.standing, ...s.soul };
    endOfDayObligations(s, sunday);
    expect(s.standing.priest).toBeLessThan(before.priest);
    expect(s.soul.publicPiety).toBeLessThan(before.publicPiety);
    expect(hasTag(s, 'heathen')).toBe(true);
  });
  it('attending mass leaves no mark', () => {
    const s = createState(1, 0);
    s.obligations.massToday = true;
    endOfDayObligations(s, dayInfo(2));
    expect(s.obligations.missedMasses).toEqual([]);
    expect(hasTag(s, 'heathen')).toBe(false);
  });
});

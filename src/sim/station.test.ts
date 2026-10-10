import { describe, expect, it } from 'vitest';
import { BEGGAR_AFTER_DAYS, DEBT, FLIGHT, FREEDOM, HALLMOTE_EVERY_DAYS, HOLDING, PLAGUE, WAGE_PER_BLOCK } from './balance';
import { availability, runActionBlock } from './actions';
import { dayInfo } from './calendar';
import { dailyHallmote } from './hallmote';
import { createLife } from './sim';
import type { SimState } from './state';
import {
  dailyStation, entryFine, flee, freedomPrice, hire, owesLabour, rankOf, rentDue, takeHolding, wage,
} from './station';

const monday = dayInfo(4);

function hallmote(s: SimState, day: number): void {
  s.block = day * 6;
  s.hallmote.nextDay = day;
  dailyHallmote(s, dayInfo(day));
}

describe('ranks', () => {
  it('climbs from cottar through villein and virgater to reeve, free tenant and yeoman', () => {
    const s = createLife(1, 0);
    expect(rankOf(s)).toBe('VILLEIN');
    s.wealth.acres = 5;
    expect(rankOf(s)).toBe('COTTAR');
    s.wealth.acres = 30;
    expect(rankOf(s)).toBe('VIRGATER');
    s.station.reeveUntil = 100;
    expect(rankOf(s)).toBe('REEVE');
    s.station.reeveUntil = 0;
    s.station.free = true;
    expect(rankOf(s)).toBe('YEOMAN');
    s.wealth.acres = 15;
    expect(rankOf(s)).toBe('FREE TENANT');
  });

  it('rent scales with land; a free tenant pays more money but owes no labour; the reeve pays none', () => {
    const s = createLife(2, 0);
    expect(rentDue(s)).toBe(36);
    expect(owesLabour(s)).toBe(true);
    s.station.free = true;
    expect(rentDue(s)).toBe(60);
    expect(owesLabour(s)).toBe(false);
    expect(availability(s, 'weekWork', monday, 1)).toBe('NOT OWED');
    s.station.free = false;
    s.station.reeveUntil = 999;
    expect(rentDue(s)).toBe(0);
    expect(owesLabour(s)).toBe(false);
  });

  it('vacant land can be taken up for an entry fine; the acres join the fallow field', () => {
    const s = createLife(3, 0);
    s.wealth.pence = entryFine() + 1;
    expect(availability(s, 'takeHolding', monday, 1)).toBeNull();
    takeHolding(s);
    expect(s.wealth.acres).toBe(15 + HOLDING.acres);
    expect(s.fields.find((f) => f.kind === 'fallow')!.acres).toBe(5 + HOLDING.acres);
    expect(availability(s, 'takeHolding', monday, 1)).toBe('NO LAND VACANT');
  });

  it('freedom can be bought from a willing lord', () => {
    const s = createLife(4, 0);
    s.wealth.pence = FREEDOM.pence;
    s.standing.lord = FREEDOM.minLord - 1;
    expect(availability(s, 'buyFreedom', monday, 1)).toBe('LORD UNWILLING');
    s.standing.lord = 70;
    runActionBlock(s, 'buyFreedom', null, monday, 1, true);
    expect(s.station.free).toBe(true);
    expect(s.wealth.pence).toBe(0);
    s.plague.phase = 'over';
    expect(freedomPrice(s)).toBeLessThan(FREEDOM.pence);
  });
});

describe('decline', () => {
  it('debt takes the beasts first, then the land; the landless labour for hire, then beg', () => {
    const s = createLife(5, 0);
    s.obligations.debt = DEBT.seizeAt + 1;
    s.block = 6 * 6;
    dailyStation(s, dayInfo(6));
    expect(s.wealth.pig).toBe(0);
    s.wealth.hens = 0;
    s.obligations.debt = DEBT.evictAt + 1;
    dailyStation(s, dayInfo(7));
    expect(s.obligations.evicted).toBe(true);
    expect(rankOf(s)).toBe('LABOURER');
    expect(availability(s, 'workStrips', monday, 1)).toBe('NO LAND');
    const p = s.wealth.pence;
    hire(s);
    expect(s.wealth.pence).toBe(p + WAGE_PER_BLOCK);
    Object.assign(s.wealth, { grain: 0, bread: 0, pottage: 0, meat: 0, eggs: 0, pence: 0 });
    for (let d = 8; d < 8 + BEGGAR_AFTER_DAYS; d++) dailyStation(s, dayInfo(d));
    expect(rankOf(s)).toBe('BEGGAR');
    expect(availability(s, 'beg', monday, 1)).toBeNull();
  });

  it('poaching when landless gets you outlawed; an outlaw lives in the woods and can be hanged', () => {
    const s = createLife(6, 0);
    s.obligations.evicted = true;
    s.lordGrip = 1000; // always caught
    runActionBlock(s, 'poach', null, monday, 0, true);
    expect(rankOf(s)).toBe('OUTLAW');
    expect(s.station.residence).toBe('camp');
    expect(availability(s, 'tavern', monday, 4)).toBe('OUTLAWED');
    expect(availability(s, 'rob', monday, 3)).toBeNull();
    runActionBlock(s, 'rob', null, monday, 3, true);
    expect(s.doom).toContain('hanged');
  });

  it('a landholder caught poaching is only fined', () => {
    const s = createLife(7, 0);
    s.lordGrip = 1000;
    runActionBlock(s, 'poach', null, monday, 0, true);
    expect(rankOf(s)).toBe('VILLEIN');
    expect(s.obligations.debt).toBeGreaterThan(0);
  });

  it('flight to the town: a year and a day uncaught makes the family free', () => {
    const s = createLife(8, 0);
    s.block = 10 * 6;
    flee(s);
    expect(rankOf(s)).toBe('FUGITIVE');
    expect(s.wealth.acres).toBe(0);
    expect(availability(s, 'workStrips', monday, 1)).toBe('IN THE TOWN');
    expect(wage(s)).toBeGreaterThan(WAGE_PER_BLOCK);
    s.lordGrip = 0;
    for (let d = 11; d <= 10 + FLIGHT.daysToFree; d++) dailyStation(s, dayInfo(d));
    expect(s.station.free).toBe(true);
    expect(rankOf(s)).toBe('CRAFTSMAN');
  });

  it('a fugitive can be caught and dragged home', () => {
    const s = createLife(9, 0);
    flee(s);
    s.lordGrip = 1e6;
    dailyStation(s, dayInfo(2));
    expect(s.station.residence).toBe('village');
    expect(rankOf(s)).toBe('LABOURER');
  });

  it('wages treble after the pestilence', () => {
    const s = createLife(10, 0);
    s.wageMult = PLAGUE.wageMult;
    expect(wage(s)).toBe(WAGE_PER_BLOCK * 3);
  });
});

describe('hallmote', () => {
  it('sits every three weeks; a brawler is fined publicly and the village thinks less of him', () => {
    const s = createLife(11, 0);
    s.counters.brawls = 1;
    s.wealth.pence = 50;
    const village = s.standing.village;
    const mean = s.village.reduce((n, v) => n + v.opinion, 0);
    hallmote(s, 20);
    expect(s.wealth.pence).toBeLessThan(50);
    expect(s.standing.village).toBeLessThan(village);
    expect(s.village.reduce((n, v) => n + v.opinion, 0)).toBeLessThan(mean);
    expect(s.hallmote.nextDay).toBe(20 + HALLMOTE_EVERY_DAYS);
    expect(s.counters.brawls).toBe(0);
  });

  it('missed work since the last session is presented', () => {
    const s = createLife(12, 0);
    s.counters.strikesSince = 1;
    s.wealth.pence = 50;
    hallmote(s, 20);
    expect(s.log.some((e) => e.text.includes('work owed'))).toBe(true);
  });

  it('elects a reeve once a year after Michaelmas: a well-liked family head can win', () => {
    const s = createLife(13, 0);
    for (const v of s.village) v.opinion = 90;
    s.standing.village = 70;
    s.standing.lord = 60;
    hallmote(s, 200); // October 1345
    expect(dayInfo(200).month).toBe(10);
    expect(rankOf(s)).toBe('REEVE');
    expect(s.hallmote.reeve).toBe('player');
    hallmote(s, 230);
    expect(s.log.filter((e) => e.text.includes('reeve for the year')).length).toBe(1);
  });

  it('a disliked family is not elected', () => {
    const s = createLife(14, 0);
    for (const v of s.village) v.opinion = -50;
    hallmote(s, 200);
    expect(rankOf(s)).not.toBe('REEVE');
    expect(s.hallmote.reeve).not.toBe('player');
  });
});

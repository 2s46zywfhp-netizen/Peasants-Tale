import { describe, expect, it } from 'vitest';
import { ACTIONS, COOK_YIELD, MEAT_SEEN, PRICES, type ActionId } from './balance';
import { ACTION_IDS, availability, bestFood, eat, runActionBlock } from './actions';
import { dayIndexOf, dayInfo } from './calendar';
import { EVENTS, EVENT_IDS, dailyEvents, triggerEvent } from './events';
import { addTag, createState, hasTag, peasant } from './state';

const sunday = dayInfo(2);
const monday = dayInfo(3);
const wednesday = dayInfo(5);

describe('actions', () => {
  it('defines every action with duration, location, valid times and effects in balance', () => {
    expect(ACTION_IDS.sort()).toEqual(
      [
        'attendMass', 'brew', 'confess', 'cook', 'eat', 'gatherFirewood', 'pray', 'rest', 'sleep', 'socialise', 'tavern', 'trade', 'wash', 'weekWork', 'workStrips',
        'court', 'marry', 'helpNeighbour', 'askFavour', 'accuse', 'takeHolding', 'buyFreedom', 'hire', 'beg', 'flee', 'poach', 'rob', 'offering', 'surrender', 'prayHome', 'stokeFire',
      ].sort(),
    );
    for (const id of ACTION_IDS) {
      const d = ACTIONS[id];
      expect(d.duration).toBeGreaterThanOrEqual(0);
      expect(d.blocks.length).toBeGreaterThan(0);
      expect(d.location).toBeTruthy();
    }
  });
  it('checks valid times and days', () => {
    const s = createState(1, 0);
    expect(availability(s, 'attendMass', sunday, 1)).toBeNull();
    expect(availability(s, 'attendMass', sunday, 3)).toBe('NOT NOW');
    expect(availability(s, 'attendMass', monday, 1)).toBe('SUNDAYS ONLY');
    expect(availability(s, 'weekWork', monday, 1)).toBeNull();
    expect(availability(s, 'weekWork', wednesday, 1)).toBe('NOT OWED TODAY');
    expect(availability(s, 'tavern', monday, 1)).toBe('NOT NOW');
  });
  it('checks costs', () => {
    const s = createState(1, 0);
    s.wealth.pence = 0;
    expect(availability(s, 'tavern', monday, 4)).toBe('NO PENNY');
    s.wealth.grain = 0;
    expect(availability(s, 'cook', monday, 1)).toBe('NO GRAIN');
    expect(availability(s, 'trade', monday, 1, 'buyGrain')).toBe('TOO POOR');
  });
  it('cooking turns grain into bread and pottage; brewing makes ale', () => {
    const s = createState(1, 0);
    const w = { ...s.wealth };
    runActionBlock(s, 'cook', null, monday, 1, true);
    expect(s.wealth.grain).toBe(w.grain - 1);
    expect(s.wealth.bread).toBe(w.bread + COOK_YIELD.bread);
    expect(s.wealth.pottage).toBe(w.pottage + COOK_YIELD.pottage);
    runActionBlock(s, 'brew', null, monday, 2, true);
    expect(s.wealth.ale).toBeGreaterThan(w.ale);
  });
  it('eating feeds the whole household and uses stores (a small child eats half a serving)', () => {
    const s = createState(1, 0);
    expect(s.members.map((m) => m.role)).toEqual(['peasant', 'spouse', 'child']);
    s.members.forEach((m) => (m.body.hunger = 60));
    const pot = s.wealth.pottage;
    expect(eat(s, monday)).toBe('pottage');
    expect(s.wealth.pottage).toBe(pot - 2.5);
    expect(s.members.every((m) => m.body.hunger === 30)).toBe(true);
  });
  it('avoids meat on fast days, and meat eaten on a fast may be seen', () => {
    const s = createState(1, 0);
    s.wealth.pottage = 0; s.wealth.bread = 0; s.wealth.eggs = 0; s.wealth.grain = 0;
    const friday = dayInfo(dayIndexOf(1345, 4, 8));
    expect(friday.isFriday).toBe(true);
    expect(bestFood(s, friday)).toBe('meat'); // nothing else left
    s.wealth.grain = 10;
    expect(bestFood(s, friday)).toBe('grain');
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const t = createState(i, 0);
      t.wealth.meat = 10;
      const priest = t.standing.priest;
      eat(t, friday, 'meat');
      if (t.standing.priest === priest + MEAT_SEEN.priest) seen++;
      const u = createState(i, 0); u.wealth.meat = 10; eat(u, dayInfo(dayIndexOf(1345, 4, 7)), 'meat');
      expect(u.standing.priest).toBe(50); // a Thursday after Easter: no sin
    }
    expect(seen).toBeGreaterThan(20);
    expect(seen).toBeLessThan(90);
  });
  it('trade buys and sells at balance prices', () => {
    const s = createState(1, 0);
    const p = s.wealth.pence;
    runActionBlock(s, 'trade', 'sellGrain', monday, 1, true);
    expect(s.wealth.pence).toBe(p + 2 * PRICES.grainSell);
    runActionBlock(s, 'trade', 'buyFirewood', monday, 1, true);
    expect(s.wealth.pence).toBe(p + 2 * PRICES.grainSell - PRICES.firewoodBuy);
  });
  it('drink and company leave tags', () => {
    const s = createState(1, 0);
    for (let i = 0; i < 4; i++) runActionBlock(s, 'tavern', null, monday, 4, true);
    expect(hasTag(s, 'drunkard')).toBe(true);
    for (let i = 0; i < 3; i++) runActionBlock(s, 'socialise', null, monday, 2, true);
    expect(hasTag(s, 'goodNeighbour')).toBe(true);
  });
  it('washing cleans; confession shortens the heathen mark', () => {
    const s = createState(1, 0);
    peasant(s).body.filth = 90;
    runActionBlock(s, 'wash', null, monday, 1, true);
    expect(peasant(s).body.filth).toBe(30);
    addTag(s, 'heathen', 100);
    runActionBlock(s, 'confess', null, monday, 1, true);
    expect(s.tags.find((t) => t.id === 'heathen')!.untilDay).toBeLessThan(100);
  });
  it('every action can run a block without throwing', () => {
    for (const id of ACTION_IDS as ActionId[]) {
      const s = createState(1, 0);
      expect(() => runActionBlock(s, id, id === 'trade' ? 'sellEggs' : null, monday, 1, true)).not.toThrow();
    }
  });
});

describe('events', () => {
  it('every event can be triggered (debug trigger-any-event)', () => {
    for (const id of EVENT_IDS) {
      const s = createState(1, 0);
      s.wealth.grain = 50;
      expect(triggerEvent(s, id, monday)).toBe(true);
    }
    expect(triggerEvent(createState(1, 0), 'nope', monday)).toBe(false);
  });
  it('the heathen tag raises negative-event odds', () => {
    const count = (heathen: boolean) => {
      let bad = 0;
      for (let i = 0; i < 3000; i++) {
        const s = createState(i, 0);
        if (heathen) addTag(s, 'heathen', 999);
        const e = dailyEvents(s, monday);
        if (e?.negative) bad++;
      }
      return bad;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 1.5);
    expect(EVENTS.some((e) => !e.negative)).toBe(true);
  });
});

describe('the MVP at home', () => {
  it('one can pray at home, every block of the day', () => {
    const s = createState(1, 0);
    for (let bod = 0; bod < 6; bod++) expect(availability(s, 'prayHome', monday, bod)).toBeNull();
    const before = s.soul.privatePiety;
    runActionBlock(s, 'prayHome', null, monday, 5, true);
    expect(s.soul.privatePiety).toBeGreaterThan(before);
  });
});

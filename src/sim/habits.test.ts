import { describe, expect, it } from 'vitest';
import { BLOCK_MS, REAL_DAY_MS } from './balance';
import { dayInfo } from './calendar';
import { chooseAction, recordAction, recordMeal, shouldAutoEat, slotOf, weeklyHabitDecay } from './habits';
import { act, advance, createLife } from './sim';
import { createState, peasant } from './state';
import { weatherFor } from './weather';

const thursday = dayInfo(6); // a week-work day
const saturday = dayInfo(8);
const mild = weatherFor(1, 8);

describe('habit recording', () => {
  it('records the player choice per (weekday, block) slot, fading older choices', () => {
    const s = createState(1, 0);
    const slot = slotOf(6, 2);
    recordAction(s, slot, 'wash');
    recordAction(s, slot, 'tavern');
    const w = s.habits.actions[slot]!;
    expect(w.tavern).toBe(1);
    expect(w.wash).toBeLessThan(1);
    recordMeal(s, slot);
    expect(s.habits.meals[slot]).toBe(1);
  });
  it('weekly decay fades minor habits but keeps the dominant routine', () => {
    const s = createState(1, 0);
    const w = s.habits.actions[0]!;
    w.rest = 2; w.pray = 1;
    for (let i = 0; i < 20; i++) weeklyHabitDecay(s);
    expect(w.rest).toBe(2);
    expect(w.pray).toBeLessThan(0.6);
  });
  it('act() records habits so the absent peasant repeats them', () => {
    let s = createLife(3, 0);
    // Every Saturday (day 1, 8, 15...) at midday the player goes to the green.
    for (let week = 0; week < 4; week++) {
      const b = (1 + week * 7) * 6 + 2;
      s = advance(s, b * BLOCK_MS + 1).state;
      s = act(s, 'socialise', b * BLOCK_MS + 1).state;
    }
    const b = (1 + 4 * 7) * 6 + 2;
    s = advance(s, (b + 1) * BLOCK_MS + 1).state; // absent this time
    const auto = s.log.find((e) => e.day === 29 && e.block === 'midday' && e.type === 'auto' && !/eats/.test(e.text));
    expect(auto?.text).toMatch(/green/);
  });
});

describe('autopilot', () => {
  it('follows the default routine when nothing is pressing', () => {
    const s = createLife(1, 0);
    expect(chooseAction(s, thursday, 1, mild).action).toBe('weekWork');
    expect(chooseAction(s, saturday, 5, mild).action).toBe('sleep');
  });
  it('urgent hunger overrides habit', () => {
    const s = createLife(1, 0);
    s.wealth.bread = 0; s.wealth.pottage = 0; s.wealth.eggs = 0; s.wealth.meat = 0;
    peasant(s).body.hunger = 90;
    expect(chooseAction(s, saturday, 2, mild).action).toBe('cook');
    s.wealth.grain = 0;
    expect(chooseAction(s, saturday, 2, mild)).toMatchObject({ action: 'trade', param: 'buyGrain' });
  });
  it('cold overrides habit', () => {
    const s = createLife(1, 0);
    peasant(s).body.warmth = 5;
    s.wealth.firewood = 0;
    expect(chooseAction(s, saturday, 2, { ...mild, tempC: -2 }).action).toBe('gatherFirewood');
  });
  it('eats when hungry or at habitual mealtimes; low morale makes meals late', () => {
    const s = createLife(1, 0);
    peasant(s).body.hunger = 40;
    expect(shouldAutoEat(s, saturday, 1)).toBe(true);
    peasant(s).body.hunger = 20;
    expect(shouldAutoEat(s, saturday, 1)).toBe(false);
    expect(shouldAutoEat(s, saturday, 2)).toBe(true); // habitual dinner
    s.soul.morale = 10;
    expect(shouldAutoEat(s, saturday, 2)).toBe(false);
  });
  it('low morale shifts choices toward vice: drink and skipped duties', () => {
    const tally = (morale: number) => {
      let tavern = 0, weekWork = 0;
      for (let i = 0; i < 200; i++) {
        const s = createLife(i, 0);
        s.soul.morale = morale;
        if (chooseAction(s, thursday, 4, mild).action === 'tavern') tavern++;
        if (chooseAction(s, thursday, 1, mild).action === 'weekWork') weekWork++;
      }
      return { tavern, weekWork };
    };
    const happy = tally(60);
    const low = tally(5);
    expect(low.tavern).toBeGreaterThan(happy.tavern + 50);
    expect(low.weekWork).toBeLessThan(happy.weekWork - 50);
  });
  it('every autonomous action writes to the event log', () => {
    const s = advance(createLife(2, 0), REAL_DAY_MS).state; // 42 blocks, player absent
    const autos = s.log.filter((e) => e.type === 'auto' && !/eats/.test(e.text));
    const starts = new Set(autos.map((e) => `${e.day}-${e.block}`));
    // Every block either starts an autonomous action (logged) or continues a multi-block one.
    expect(starts.size).toBeGreaterThan(30);
    for (const e of s.log) {
      const keys = Object.keys(e).filter((k) => k !== 'action').sort();
      expect(keys).toEqual(['actors', 'block', 'date', 'day', 'text', 'type']);
      if (e.type === 'auto') expect(e.action).toBeDefined();
      expect(e.actors.length).toBeGreaterThan(0);
    }
  });
  it('keeps a household alive for a year in ordinary conditions', () => {
    for (const seed of [11, 12, 13, 14, 15]) {
      let s = createLife(seed, 0);
      for (let d = 1; d <= 365; d++) s = advance(s, d * 6 * BLOCK_MS + 1).state;
      expect(s.dead, `seed ${seed}`).toBe(false);
    }
  }, 30_000);
});

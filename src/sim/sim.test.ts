import { describe, expect, it } from 'vitest';
import { BLOCK_MS, CATCHUP_CAP_BLOCKS, REAL_DAY_MS, type ActionId } from './balance';
import { reserveTier } from './body';
import { dayInfo } from './calendar';
import { isBoonDay, isWeekWorkDay } from './obligations';
import { act, advance, blockAt, createLife, stateHash, type SimState } from './sim';

/** Real time a little way into block `b` of a life anchored at 0. */
const at = (b: number) => b * BLOCK_MS + 1;

/** Plays the player's choice for every block from the current one up to `endBlock`. */
function play(s: SimState, endBlock: number, choose: (s: SimState, block: number) => { action: ActionId; eat?: boolean; food?: string }): SimState {
  while (s.block < endBlock) {
    if (s.dead) {
      s = advance(s, at(s.block + 1)).state;
      continue;
    }
    const b = s.block;
    const c = choose(s, b);
    if (c.eat) s = act(s, 'eat', at(b), c.food ?? null).state;
    const r = act(s, c.action, at(b));
    s = r.state;
    s = advance(s, at(b + 1)).state;
  }
  return s;
}

/** A dutiful routine: mass on Sundays, week-work and boon work when owed, the strips otherwise, three meals a day. */
function dutiful(s: SimState, b: number): { action: ActionId; eat?: boolean } {
  const bod = b % 6;
  const info = dayInfo(Math.floor(b / 6));
  const eat = bod === 0 || bod === 2 || bod === 4; // breakfast, dinner, supper
  if (bod === 5) return { action: 'sleep', eat };
  if (bod === 0) return { action: s.wealth.firewood < 2 ? 'gatherFirewood' : 'rest', eat };
  if (bod === 4) return { action: s.wealth.bread + s.wealth.pottage < 8 && s.wealth.grain >= 1 ? 'cook' : 'rest', eat };
  if (info.isSunday) return { action: bod === 1 ? 'attendMass' : 'rest', eat };
  if (isWeekWorkDay(info) || isBoonDay(info)) return { action: 'weekWork', eat };
  return { action: 'workStrips', eat };
}

describe('acceptance 1: determinism', () => {
  it('same seed + same actions -> identical state hash after 2 game years', () => {
    const end = 730 * 6;
    const a = play(createLife(1234, 0), end, dutiful);
    const b = play(createLife(1234, 0), end, dutiful);
    expect(a.block).toBe(end);
    expect(a.dead).toBe(false); // a full, living two years, not a corpse being advanced
    expect(stateHash(a)).toBe(stateHash(b));
    const c = play(createLife(1235, 0), end, dutiful);
    expect(stateHash(c)).not.toBe(stateHash(a));
  }, 120_000);

  it('autopilot is deterministic whatever the advance granularity', () => {
    const fine = (() => {
      let s = createLife(9, 0);
      for (let b = 1; b <= 6 * 60; b++) s = advance(s, at(b)).state;
      return s;
    })();
    const coarse = advance(createLife(9, 0), at(6 * 60)).state;
    expect(stateHash(coarse)).toBe(stateHash({ ...fine, lastSimMs: coarse.lastSimMs }));
  });
});

describe('acceptance 2: catch-up speed', () => {
  it('simulates 30 real days (1260 blocks) in under 200ms', () => {
    const s = createLife(5, 0);
    advance(s, REAL_DAY_MS); // warm up the JIT and calendar cache
    const t0 = performance.now();
    const r = advance(createLife(5, 0), 30 * REAL_DAY_MS);
    const ms = performance.now() - t0;
    expect(r.blocksRun).toBe(1260);
    expect(ms).toBeLessThan(200);
  });
});

describe('acceptance 3: late feeding', () => {
  /** Both lives keep the same dutiful routine (so no fines or eviction interfere); only meal timing differs. */
  function feedingLife(mealBlocks: readonly number[], days: number): SimState {
    const s = createLife(42, 0);
    s.wealth.pottage = 100_000;
    return play(s, days * 6, (st, b) => {
      const d = dutiful(st, b);
      const action: ActionId = d.action === 'cook' ? 'rest' : d.action;
      // On the first day, the late schedule's dawn meal would be "yesterday's supper"; skip it.
      return { action, eat: mealBlocks.includes(b % 6) && b > 0, food: 'pottage' };
    });
  }
  const ON_TIME = [2, 4]; // dinner at midday, supper at dusk
  const LATE = [4, 0]; // each meal two blocks later: dinner at dusk, supper at the next dawn

  it('meals 2 blocks late every day for 8 game weeks bring reserve down to thin', () => {
    const onTime = feedingLife(ON_TIME, 56);
    const late = feedingLife(LATE, 56);
    expect(onTime.obligations.evicted || late.obligations.evicted).toBe(false);
    expect(reserveTier(onTime.members[0]!.body.reserve)).toBe('healthy');
    expect(reserveTier(late.members[0]!.body.reserve)).toBe('thin');
  });

  it('the loss is gradual: still healthy after one game week of late meals', () => {
    const s = feedingLife(LATE, 7);
    expect(reserveTier(s.members[0]!.body.reserve)).toBe('healthy');
    expect(s.members[0]!.body.reserve).toBeLessThan(62);
  });
});

describe('acceptance 4: missed mass -> church court on schedule', () => {
  const heathen = (s: SimState, b: number) => {
    const r = dutiful(s, b);
    return r.action === 'attendMass' ? { ...r, action: 'rest' as ActionId } : r;
  };
  // Sundays of 1345 from Lady Day (a Friday): day 2 (Easter), 9, 16, 23...
  it('three missed masses within 8 weeks bring a summons, the court sits 7 days later, then penance', () => {
    let s = play(createLife(7, 0), 16 * 6, heathen); // through Saturday day 15
    expect(s.obligations.missedMasses).toEqual([2, 9]);
    expect(s.obligations.churchCourtDay).toBeNull();
    s = play(s, 17 * 6, heathen); // Sunday day 16: third miss
    expect(s.obligations.missedMasses).toEqual([2, 9, 16]);
    expect(s.obligations.churchCourtDay).toBe(23);
    expect(s.log.some((e) => e.type === 'church' && e.day === 16 && /Summoned/.test(e.text))).toBe(true);
    s = play(s, 23 * 6, dutiful);
    expect(s.obligations.penanceSundaysLeft).toBe(0);
    s = play(s, 23 * 6 + 1, dutiful); // dawn of day 23: the court sits
    expect(s.obligations.penanceSundaysLeft).toBe(3);
    expect(s.tags.some((t) => t.id === 'penitent')).toBe(true);
    const priestAtPenance = s.standing.priest;
    s = play(s, 44 * 6, dutiful); // mass on days 23, 30, 37
    expect(s.obligations.penanceSundaysLeft).toBe(0);
    expect(s.log.some((e) => /Penance complete/.test(e.text))).toBe(true);
    expect(s.standing.priest).toBeGreaterThan(priestAtPenance);
  });

  it('two misses, or misses spread beyond 8 weeks, do not', () => {
    // Skip mass only on days 2 and 9, then 72: never 3 inside a 56-day window.
    const skipSome = (s: SimState, b: number) => {
      const r = dutiful(s, b);
      const day = Math.floor(b / 6);
      return r.action === 'attendMass' && [2, 9, 72].includes(day) ? { ...r, action: 'rest' as ActionId } : r;
    };
    const s = play(createLife(7, 0), 80 * 6, skipSome);
    expect(s.obligations.churchCourtDay).toBeNull();
    expect(s.obligations.penanceSundaysLeft).toBe(0);
    expect(s.tags.some((t) => t.id === 'heathen')).toBe(true);
  });
});

describe('acceptance 6: clock tampering', () => {
  it('never rewinds when the clock goes backwards', () => {
    const s = advance(createLife(3, 0), at(100)).state;
    expect(s.block).toBe(100);
    const back = advance(s, at(50));
    expect(back.state).toBe(s);
    expect(back.blocksRun).toBe(0);
    // A rewound clock that later returns to the old time resumes exactly where it left off.
    const fwd = advance(s, at(101));
    expect(fwd.blocksRun).toBe(1);
    // Acting with a rewound clock acts in the current block, never an earlier one.
    const r = act(s, 'rest', at(10));
    expect(r.state.block).toBe(100);
    expect(r.state.plan?.from).toBe(100);
  });

  it('treats a forward jump beyond the cap as the cap and marks neglect', () => {
    const s = createLife(3, 0);
    const now = 45 * REAL_DAY_MS + 1000;
    const r = advance(s, now);
    expect(r.blocksRun).toBe(CATCHUP_CAP_BLOCKS);
    expect(r.neglected).toBe(true);
    expect(r.state.block).toBe(CATCHUP_CAP_BLOCKS);
    expect(r.state.neglect).toBe(true);
    expect(r.state.log.filter((e) => e.type === 'neglect')).toHaveLength(1);
    // The dropped time is gone: the current block is now "now", so nothing more is due.
    expect(blockAt(r.state, now)).toBe(CATCHUP_CAP_BLOCKS);
    expect(advance(r.state, now).blocksRun).toBe(0);
    expect(advance(r.state, now + BLOCK_MS).blocksRun).toBe(1);
    // Exactly the cap is not neglect.
    expect(advance(createLife(3, 0), 30 * REAL_DAY_MS).neglected).toBe(false);
  });

  it('acting clears the neglect state', () => {
    const r = advance(createLife(3, 0), 45 * REAL_DAY_MS);
    const a = act(r.state, 'rest', 45 * REAL_DAY_MS);
    expect(a.ok).toBe(true);
    expect(a.state.neglect).toBe(false);
  });
});

describe('time', () => {
  it('runs 6 blocks a game day and 7 game days a real day (~34m17s a block)', () => {
    expect(BLOCK_MS / 60_000).toBeCloseTo(34.2857, 3);
    const s = advance(createLife(1, 0), REAL_DAY_MS).state;
    expect(s.block).toBe(42);
    expect(Math.floor(s.block / 6)).toBe(7);
  });
  it('is pure: advance never mutates its input', () => {
    const s = createLife(1, 0);
    const before = stateHash(s);
    advance(s, REAL_DAY_MS);
    act(s, 'rest', 1);
    expect(stateHash(s)).toBe(before);
  });
});

describe('the hearth', () => {
  it('is out with no wood, banked on a mild day, blazing when it is cold', async () => {
    const { hearthOf } = await import('./sim');
    const s = createLife(1, 0);
    s.wealth.firewood = 0;
    expect(hearthOf(s, 0)).toBe('out');
    s.wealth.firewood = 3;
    expect(hearthOf(s, 20)).toBe('banked');
    expect(hearthOf(s, 2)).toBe('blazing');
  });
});

describe('hastening a chosen task', () => {
  it('the rest of the task passes at once, and the clock stays consistent afterwards', async () => {
    const { hasten } = await import('./sim');
    let s = createLife(5, 0);
    s = advance(s, at(7)).state; // monday morning
    s = act(s, 'workStrips', at(7)).state;
    const until = s.plan!.until;
    const done = hasten(s, at(7) + 1000);
    expect(done.block).toBe(until);
    expect(blockAt(done, at(7) + 1000)).toBe(until);
    // Nothing to hasten without a chosen task.
    expect(hasten(done, at(7) + 2000).block).toBe(until);
    // Time then carries on normally from there.
    expect(advance(done, at(7) + 1000 + BLOCK_MS).state.block).toBe(until + 1);
  });
});

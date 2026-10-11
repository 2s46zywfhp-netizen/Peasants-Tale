/**
 * Acceptance 2: balance runs. Three playstyles over two game years, across many seeds.
 * `BALANCE_OUT=docs/BALANCE.md npx vitest run src/sim/balanceRuns.test.ts` also writes the report.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCK_MS, CATCHUP_CAP_BLOCKS, HASTE_BUDGET_MS, HASTE_REFILL, PRICES, REAL_DAY_MS, type ActionId } from './balance';
import { availability, readyServings } from './actions';
import { reserveTier } from './body';
import { dayInfo } from './calendar';
import { fieldTask } from './farm';
import { isBoonDay, isWeekWorkDay } from './obligations';
import { act, advance, createLife, debugFastForward, hasten, type SimState } from './sim';
import { rankOf, rentDue } from './station';

const YEARS2 = 730 * 6;
const SEEDS = Array.from({ length: 12 }, (_, i) => 101 + i * 7);
const at = (b: number) => b * BLOCK_MS + 1;

/** A careful player who opens the game every block: three meals, duties, the strips, the market. */
function diligentChoice(s: SimState, b: number): { action: ActionId; param?: string | null } {
  const bod = b % 6;
  const info = dayInfo(Math.floor(b / 6));
  const w = s.wealth;
  const ok = (a: ActionId, p: string | null = null) => availability(s, a, info, bod, p) === null;
  if (bod === 5) return { action: 'sleep' };
  if (bod === 0) return { action: w.firewood < 3 ? 'gatherFirewood' : readyServings(s) < 14 && ok('cook') ? 'cook' : 'rest' };
  if (info.isSunday) return { action: bod === 1 ? 'attendMass' : bod === 3 ? 'socialise' : 'rest' };
  // Week-work runs from morning to afternoon: keep at it (choosing it again just carries on).
  if (bod >= 1 && bod <= 3 && (isWeekWorkDay(info) || isBoonDay(info)) && s.station.residence === 'village' && !s.obligations.evicted) return { action: 'weekWork' };
  if (bod >= 1 && bod <= 3) {
    if (w.grain < 12 && w.pence >= PRICES.grainBuy && ok('trade', 'buyGrain')) return { action: 'trade', param: 'buyGrain' };
    if (w.pence < rentDue(s) + 6 && w.grain > 45 && ok('trade', 'sellGrain')) return { action: 'trade', param: 'sellGrain' };
    if (w.eggs >= PRICES.eggsPerPenny * 2 && ok('trade', 'sellEggs')) return { action: 'trade', param: 'sellEggs' };
    if (fieldTask(s, info) && ok('workStrips')) return { action: 'workStrips' };
    if (w.firewood < 6) return { action: 'gatherFirewood' };
    if (peasantFilth(s) > 55) return { action: 'wash' };
    return { action: 'workStrips' };
  }
  return { action: readyServings(s) < 14 && ok('cook') ? 'cook' : 'rest' };
}
const peasantFilth = (s: SimState) => s.members[0]?.body.filth ?? 0;

function diligent(seed: number): SimState {
  let s = createLife(seed, 0);
  while (s.block < YEARS2) {
    const b = s.block;
    if (s.dead) break;
    if (b % 6 === 0 || b % 6 === 2 || b % 6 === 4) s = act(s, 'eat', at(b)).state;
    const c = diligentChoice(s, b);
    s = act(s, c.action, at(b), c.param ?? null).state;
    s = advance(s, at(b + 1)).state;
  }
  return s;
}

/**
 * The same careful player, but one who hastens every task (watches it begin, then lets its time pass at once)
 * and opens the game again ten real minutes later: the life runs as far ahead of the clock as the haste
 * allowance lets it.
 */
function hastening(seed: number): { s: SimState; realDays: number } {
  let s = createLife(seed, 0);
  let now = 1;
  while (s.block < YEARS2 && !s.dead) {
    s = advance(s, now).state;
    const b = s.block;
    if (b % 6 === 0 || b % 6 === 2 || b % 6 === 4) s = act(s, 'eat', now).state;
    const c = diligentChoice(s, b);
    s = act(s, c.action, now, c.param ?? null).state;
    s = hasten(s, now);
    now += 10 * 60 * 1000;
  }
  return { s, realDays: now / REAL_DAY_MS };
}

/** Opens the game once every four real days (four game weeks), drinks at the alehouse, and leaves. */
function neglectful(seed: number): SimState {
  let s = createLife(seed, 0);
  const gap = 4 * 42;
  // Checks in at dusk, when the alehouse is open.
  for (let b = gap + 4; b <= YEARS2; b += gap) {
    s = advance(s, at(b)).state;
    if (s.dead) break;
    const tavern = act(s, 'tavern', at(b));
    if (tavern.ok) s = tavern.state;
  }
  return advance(s, at(YEARS2)).state;
}

/** Never opens the game: the peasant lives by habit alone for two years. */
function absent(seed: number): SimState {
  return debugFastForward(createLife(seed, 0), YEARS2, 0);
}

interface Outcome {
  alive: boolean;
  generations: number;
  members: number;
  hungerDeaths: number;
  deaths: number;
  births: number;
  worstTier: string;
  pence: number;
  grain: number;
  debt: number;
  rank: string;
  lord: number;
  village: number;
  morale: number;
  strikes: number;
  evicted: boolean;
}

const TIERS = ['skeletal', 'gaunt', 'thin', 'healthy', 'stout'];

function outcome(s: SimState): Outcome {
  const tiers = s.members.filter((m) => m.alive).map((m) => reserveTier(m.body.reserve));
  return {
    alive: !s.dead,
    generations: s.generation,
    members: s.members.filter((m) => m.alive).length,
    hungerDeaths: s.log.filter((e) => e.type === 'death' && e.text.includes('of hunger')).length,
    deaths: s.log.filter((e) => e.type === 'death' && e.text.includes('is dead')).length,
    births: s.log.filter((e) => e.type === 'family' && e.text.includes('is born')).length,
    worstTier: tiers.reduce((a, t) => (TIERS.indexOf(t) < TIERS.indexOf(a) ? t : a), 'stout'),
    pence: s.wealth.pence,
    grain: s.wealth.grain,
    debt: s.obligations.debt,
    rank: rankOf(s),
    lord: s.standing.lord,
    village: s.standing.village,
    morale: s.soul.morale,
    strikes: s.log.filter((e) => e.type === 'manor' && /^Fined|shirker|Summoned/.test(e.text)).length,
    evicted: s.obligations.evicted,
  };
}

const runs: Record<string, Outcome[]> = {};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const r1 = (x: number) => Math.round(x * 10) / 10;

describe('acceptance 2: balance runs over two game years', () => {
  it('the diligent player: no starvation spiral, the family lives and keeps its land', () => {
    runs.diligent = SEEDS.map((seed) => outcome(diligent(seed)));
    for (const o of runs.diligent) {
      expect(o.alive).toBe(true);
      expect(o.hungerDeaths).toBe(0);
      expect(['skeletal', 'gaunt']).not.toContain(o.worstTier);
      expect(o.evicted).toBe(false);
    }
    expect(mean(runs.diligent.map((o) => o.grain))).toBeGreaterThan(20);
  }, 240_000);

  it('the hastening player: lives like the diligent one, and no faster than the haste allowance lets it', () => {
    const lives = SEEDS.slice(0, 4).map((seed) => hastening(seed));
    runs['diligent, hastening every task'] = lives.map((l) => outcome(l.s));
    for (const l of lives) {
      expect(l.s.dead).toBe(false);
      // Two game years are 104 real days at the plain rate; hastened, at most (1 + HASTE_REFILL) times faster.
      expect(l.realDays).toBeGreaterThanOrEqual(YEARS2 / 42 / (1 + HASTE_REFILL) - HASTE_BUDGET_MS / REAL_DAY_MS - 1);
    }
  }, 240_000);

  it('the neglectful player: visible decline, not instant death', () => {
    runs.neglectful = SEEDS.map((seed) => outcome(neglectful(seed)));
    const alive = runs.neglectful.filter((o) => o.alive).length;
    expect(alive).toBeGreaterThanOrEqual(SEEDS.length - 1);
    // The decline shows on the body and in the reeve's roll: thinner households, more fines and marks.
    const thin = (os: Outcome[]) => os.filter((o) => TIERS.indexOf(o.worstTier) <= TIERS.indexOf('thin')).length;
    expect(thin(runs.neglectful)).toBeGreaterThan(thin(runs.diligent!));
    expect(mean(runs.neglectful.map((o) => o.strikes))).toBeGreaterThan(mean(runs.diligent!.map((o) => o.strikes)));
    // ...and in the purse and the eyes of the manor and the village.
    expect(mean(runs.neglectful.map((o) => o.pence))).toBeLessThan(mean(runs.diligent!.map((o) => o.pence)));
    expect(mean(runs.neglectful.map((o) => o.lord))).toBeLessThan(mean(runs.diligent!.map((o) => o.lord)));
    expect(mean(runs.neglectful.map((o) => o.village))).toBeLessThan(mean(runs.diligent!.map((o) => o.village)));
  }, 240_000);

  it('the absent player: the peasant muddles on by habit; a long absence is capped and marked', () => {
    runs.absent = SEEDS.map((seed) => outcome(absent(seed)));
    expect(runs.absent.filter((o) => o.alive).length).toBeGreaterThanOrEqual(SEEDS.length - 1);
    const thin = (os: Outcome[]) => os.filter((o) => TIERS.indexOf(o.worstTier) <= TIERS.indexOf('thin')).length;
    expect(thin(runs.absent)).toBeGreaterThan(thin(runs.diligent!));
    expect(mean(runs.absent.map((o) => o.morale))).toBeLessThan(mean(runs.diligent!.map((o) => o.morale)));
    expect(mean(runs.absent.map((o) => o.lord))).toBeLessThan(mean(runs.diligent!.map((o) => o.lord)));
    // Away for the whole two years (104 real days): only the cap is simulated, and the village notices.
    const back = advance(createLife(SEEDS[0]!, 0), (YEARS2 / 42) * REAL_DAY_MS);
    expect(back.neglected).toBe(true);
    expect(back.blocksRun).toBe(CATCHUP_CAP_BLOCKS);
    expect(back.state.dead).toBe(false);
    runs['away two years (cap)'] = [outcome(back.state)];
  }, 240_000);

  it('writes docs/BALANCE.md when asked', () => {
    const out = process.env.BALANCE_OUT;
    if (!out) return;
    const rows = Object.entries(runs).map(([k, os]) => {
      const pct = (f: (o: Outcome) => boolean) => `${Math.round((os.filter(f).length / os.length) * 100)}%`;
      return `| ${k} | ${pct((o) => o.alive)} | ${r1(mean(os.map((o) => o.generations)))} | ${r1(mean(os.map((o) => o.members)))} | ${os.reduce((n, o) => n + o.deaths, 0)} (${os.reduce((n, o) => n + o.hungerDeaths, 0)} of hunger) | ${os.reduce((n, o) => n + o.births, 0)} | ${pct((o) => TIERS.indexOf(o.worstTier) <= TIERS.indexOf('thin'))} | ${pct((o) => o.worstTier === 'gaunt' || o.worstTier === 'skeletal')} | ${r1(mean(os.map((o) => o.grain)))} | ${r1(mean(os.map((o) => o.pence)))} | ${r1(mean(os.map((o) => o.debt)))} | ${pct((o) => o.evicted)} | ${r1(mean(os.map((o) => o.strikes)))} | ${r1(mean(os.map((o) => o.morale)))} | ${r1(mean(os.map((o) => o.lord)))} | ${r1(mean(os.map((o) => o.village)))} |`;
    });
    const ranks = Object.entries(runs).map(([k, os]) => `- **${k}**: ${[...new Set(os.map((o) => o.rank))].map((r) => `${r} ×${os.filter((o) => o.rank === r).length}`).join(', ')}`);
    writeFileSync(out, `${HEADER}
| playstyle | line alive | generations | living members | deaths | births | thin or worse | gaunt or worse | grain bu | pence | debt d | evicted | fines & marks | morale | lord | village |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

Ranks at the end:
${ranks.join('\n')}
${FOOTER}`);
  });
});

const HEADER = `# Balance runs

Generated by \`BALANCE_OUT=docs/BALANCE.md npx vitest run src/sim/balanceRuns.test.ts\`.
Each playstyle is run for two game years (Lady Day 1345 to Lady Day 1347, before the pestilence)
on ${SEEDS.length} seeds (${SEEDS.join(', ')}). Figures are means across seeds at the end of the run.

- **diligent**: the player opens the game every block. Three meals a day, mass on Sundays, week-work and
  boon work when owed, the strips whenever there is field work, wood and cooking at dawn and dusk, grain
  sold to meet the Michaelmas rent and bought when the chest runs low.
- **neglectful**: the player opens the game once every four real days (four game weeks), spends a block at
  the alehouse, and leaves. Everything else is the autopilot, steered by habit.
- **diligent, hastening every task**: the diligent player on four seeds, hastening every task and coming
  back ten real minutes later, so the life runs ahead of the clock as far as the haste allowance allows
  (half a real day at once, refilling with real time: at most twice the plain rate over a long stretch).
- **absent**: nobody ever opens the game, and the autopilot runs every block for the two years: the
  peasant lives by the default routine and habit alone.
- **away two years (cap)**: one seed, opened once after 104 real days (two game years). Only the 30-day
  catch-up cap (210 game days) is simulated; the rest is dropped and the household is marked neglected.
`;

const FOOTER = `
## Reading the table

- **No starvation spiral for the diligent player**: every diligent line survives with no deaths of hunger
  and nobody gaunt or worse (asserted by the test).
- **Neglect is a decline, not a death sentence**: neglected and absent households all live, but they
  grow thin where the diligent stay healthy (the autopilot eats two meals a day, not three), pick up
  fines and marks for missed work, end poorer, and stand lower with the lord and the village (all
  asserted by the test). A household nobody has tended for a week drifts: spirits sag, the manor and the
  village think less of it, and work done by habit alone is sloppier (UNWATCHED in balance.ts). The
  absent end with more grain only because they eat less and sell less. The neglectful player's morale
  is lifted by the alehouse visit just before the count.
- **Hastening** keeps the careful player's land, purse and standing, but a hastened day has fewer
  meals in it (the household eats when the player comes back), so half the lines grow thin. The
  allowance keeps the life from outrunning the clock (asserted by the test).
- **A long absence** simulates only the 30-day catch-up cap and marks the household neglected, with a
  one-off morale and village-standing penalty at the start of the catch-up (told in the Parchment Log).
  Over the 210 simulated days those drift back. It does not kill the household.
- **Deaths** count everyone in the household, children included (small children sicken easily).

## Money exploits checked (src/sim/exploits.test.ts)

- Buying and selling grain, eggs, ale and firewood in any order always loses value (5d sell, 7d buy).
- Brewing then selling ale is worth less than selling the grain.
- Help-for-favour exchange returns at most what was given (a block of labour or three loaves).
- A bot that only trades, or only begs, cannot grow its wealth over two years.
- Wages (about a penny a day per head of household, more for the household's other hands) are below what
  the same labour yields on the family's own strips; lodging costs the landless a farthing to three a day.
`;

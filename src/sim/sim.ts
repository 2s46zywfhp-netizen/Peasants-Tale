import {
  HASTE_BUDGET_MS,
  HEARTH,
  UNWATCHED,
  HASTE_REFILL,
  ACTIONS, BLOCKS_PER_DAY, BLOCKS_PER_REAL_DAY, CATCHUP_CAP_BLOCKS, EGGS_PER_HEN_PER_DAY, FEAST_MORALE, FOOD_SPOIL_PER_DAY,
  FIRE_BELOW_C, GARDEN_MONTHS, GARDEN_POTTAGE_PER_DAY, MARTINMAS_PORK, MORALE_COLD_BLOCK, MORALE_DRIFT, MORALE_HUNGRY_BLOCK, MORALE_ILL_BLOCK, NEGLECT, PIETY_DAILY_DECAY,
  REAL_DAY_MS, STANDING_DRIFT, URGENT_HUNGER, WARMTH_COLD, type ActionId, type Food,
} from './balance';
import { dailyHealth, injure, injuryChance, tickBody } from './body';
import { BLOCK_NAMES, dayInfo, type DayInfo } from './calendar';
import { dailyFarm } from './farm';
import { availability, eat, runActionBlock } from './actions';
import { bury, chronicleEntry } from './bloodline';
import { dailyDark, nightTerrors, roadAtNight } from './dark';
import { dailyEvents, triggerEvent } from './events';
import { dailyFamily, frailty } from './family';
import { dailyHallmote, weeklyReeve } from './hallmote';
import { dailyPlague } from './plague';
import { dailyStation, placeFor } from './station';
import { createVillage, dailyVillage } from './village';
import { chooseAction, planLength, recordAction, recordMeal, seedDefaultHabits, shouldAutoEat, slotOf, weeklyHabitDecay } from './habits';
import { log } from './log';
import { dawnObligations, endOfDayObligations } from './obligations';
import { clamp, createState, peasant, rand, type LifeOptions, type Member, type SimState } from './state';
import { weatherFor, type Weather } from './weather';

export { stateHash, type SimState } from './state';

/** Deep copy for pure updates. Log entries are never mutated after being written, so they are shared. */
export function cloneState(s: SimState): SimState {
  const log = s.log;
  const copy: SimState = structuredClone({ ...s, log: [] });
  copy.log = log.slice();
  return copy;
}

/** A new life: the default routine is seeded into the habits so the autopilot works from the first block. */
export function createLife(seed: number, nowMs: number, opts: LifeOptions = {}): SimState {
  const s = createState(seed, nowMs, opts);
  createVillage(s);
  seedDefaultHabits(s);
  s.chronicle.push(chronicleEntry(s, peasant(s)));
  log(s, 'feast', 'Lady Day, 1345. A new year. The Lenten fast is nearly done.');
  return s;
}

/**
 * Upgrades a Phase 2/3 life (sim version 2) to version 3: the household gains ages and sexes, the village
 * is peopled, and the new ledgers start empty. The life keeps its seed, clock, stores, fields and log.
 */
export function migrateSim(old: Record<string, unknown>): SimState {
  if (old.version === 3) return old as unknown as SimState;
  const o = old as unknown as SimState & { members: (Partial<SimState['members'][number]> & { role: string })[] };
  const fresh = createState(o.seed, o.anchorMs);
  const day = Math.floor(o.block / BLOCKS_PER_DAY);
  const s: SimState = {
    ...fresh,
    ...o,
    version: 3,
    members: o.members.map((m, i) => ({
      ...fresh.members[Math.min(i, 1)]!,
      ...m,
      role: i === 0 ? 'peasant' : 'spouse',
      sex: i === 0 ? 'm' : 'f',
      bornDay: fresh.members[Math.min(i, 1)]!.bornDay,
    })) as SimState['members'],
    counters: { ...fresh.counters, ...o.counters },
    village: [],
    chronicle: [],
  };
  // The dead are buried before the new ledgers begin.
  s.members = s.members.filter((m) => m.alive);
  createVillage(s);
  const p = s.members[0];
  if (p) s.chronicle.push(chronicleEntry(s, p));
  else s.dead = true;
  s.hallmote.nextDay = day + 7;
  return s;
}

/** Index of the block containing real time `nowMs`. */
export function blockAt(s: SimState, nowMs: number): number {
  return Math.floor(((nowMs - s.anchorMs) * BLOCKS_PER_REAL_DAY) / REAL_DAY_MS);
}

export interface Clock {
  info: DayInfo;
  bod: number;
  blockName: (typeof BLOCK_NAMES)[number];
  weather: Weather;
  /** Real ms until the current block ends. */
  msToNext: number;
}

export function clock(s: SimState, nowMs: number): Clock {
  const day = Math.floor(s.block / BLOCKS_PER_DAY);
  const bod = s.block % BLOCKS_PER_DAY;
  const end = s.anchorMs + ((s.block + 1) * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
  return { info: dayInfo(day), bod, blockName: BLOCK_NAMES[bod]!, weather: weatherFor(s.seed, day), msToNext: Math.max(0, end - nowMs) };
}

/**
 * The hearth as the family would see it: out (no wood), banked (embers for the pot, on a mild day) or
 * blazing (wood on a cold day, which is when the household burns it).
 */
export type Hearth = 'out' | 'banked' | 'blazing';
export function hearthOf(s: SimState, _tempC?: number): Hearth {
  const fuel = s.hearth ?? 0;
  return fuel >= HEARTH.blaze ? 'blazing' : fuel > 0 ? 'banked' : 'out';
}

/** Feeds the fire from the woodstock: up to HEARTH.stoke logs, as many as are in the stock. Returns how many. */
export function stokeFire(s: SimState): number {
  const n = Math.min(HEARTH.stoke, Math.floor(s.wealth.firewood));
  s.wealth.firewood -= n;
  s.hearth = (s.hearth ?? 0) + n;
  return n;
}

/* ───────────── daily processing ───────────── */

/** Nobody has tended this household for a while (the player has not chosen anything for UNWATCHED.afterDays). */
export function unwatched(s: SimState): boolean {
  return s.block - (s.counters.lastPlayerBlock ?? 0) > UNWATCHED.afterDays * BLOCKS_PER_DAY;
}

function dawn(s: SimState, info: DayInfo, w: Weather): void {
  if (s.dead) return;
  const day = info.dayIndex;
  s.soul.morale = clamp(s.soul.morale + w.morale);
  if (unwatched(s)) {
    s.soul.morale = Math.max(Math.min(s.soul.morale, UNWATCHED.moraleFloor), s.soul.morale + UNWATCHED.morale);
    s.standing.village = Math.max(Math.min(s.standing.village, UNWATCHED.villageFloor), s.standing.village + UNWATCHED.village);
    s.standing.lord = Math.max(Math.min(s.standing.lord, UNWATCHED.lordFloor), s.standing.lord + UNWATCHED.lord);
  }
  if (w.sky === 'storm' || w.sky === 'snow') log(s, 'weather', w.sky === 'storm' ? 'A storm howls over the village.' : 'Snow lies on the thatch.');
  for (const f of info.feasts) {
    s.soul.morale = clamp(s.soul.morale + FEAST_MORALE[f]);
    if (f !== 'lent' && f !== 'twelveDays') log(s, 'feast', FEAST_TEXT[f]);
  }
  if (info.feasts.includes('martinmas') && s.wealth.pig > 0) {
    s.wealth.meat += MARTINMAS_PORK;
    log(s, 'feast', 'Martinmas: the pig is killed and salted for winter. A piglet is kept on.');
  }
  s.soul.privatePiety = clamp(s.soul.privatePiety - PIETY_DAILY_DECAY.privatePiety);
  s.soul.publicPiety = clamp(s.soul.publicPiety - PIETY_DAILY_DECAY.publicPiety);
  s.tags = s.tags.filter((t) => t.untilDay > day);
  for (const k of ['lord', 'priest', 'village'] as const) s.standing[k] = clamp(s.standing[k] + (50 - s.standing[k]) * STANDING_DRIFT);
  if (info.isSunday) {
    s.counters.tavernThisWeek = 0;
    s.counters.socialThisWeek = 0;
    weeklyHabitDecay(s);
  }
  s.wealth.eggs += s.wealth.hens * EGGS_PER_HEN_PER_DAY;
  if (!s.obligations.evicted && s.station.residence === 'village' && GARDEN_MONTHS.includes(info.month)) s.wealth.pottage += GARDEN_POTTAGE_PER_DAY;
  s.wealth.pottage *= 1 - FOOD_SPOIL_PER_DAY.pottage;
  s.wealth.bread *= 1 - FOOD_SPOIL_PER_DAY.bread;
  s.wealth.eggs *= 1 - FOOD_SPOIL_PER_DAY.eggs;
  dailyFarm(s, info, w);
  dawnObligations(s, info);
  dailyVillage(s, info);
  dailyHallmote(s, info);
  if (info.isSunday) weeklyReeve(s);
  dailyStation(s, info);
  dailyPlague(s, info);
  dailyDark(s);
  const childbed = dailyFamily(s, info);
  for (const m of childbed) bury(s, m, 'in childbed');
  const wet = w.sky === 'rain' || w.sky === 'storm' || w.sky === 'snow';
  const omen = s.tags.some((t) => t.id === 'omen') ? 1.5 : 1;
  for (const m of [...s.members]) {
    if (!m.alive) continue;
    // Frailty (the very young, the old, an ill omen) makes the illness roll land more often.
    const r = { illness: rand(s) / (frailty(m, day) * omen), kind: rand(s), severity: rand(s), infection: rand(s) };
    const ill = m.body.illness?.kind ?? null;
    const out = dailyHealth(m.body, info.season, wet, r);
    if (out.fellIll) log(s, 'illness', `${m.name} falls ill: ${ILLNESS_TEXT[out.fellIll]}.`, [m.name]);
    if (out.recovered) log(s, 'illness', `${m.name} recovers from the ${ILLNESS_TEXT[out.recovered]}.`, [m.name]);
    if (out.died) bury(s, m, causeOf(m, ill));
    if (s.dead) return;
  }
  if (s.doom) {
    bury(s, peasant(s), s.doom);
    s.doom = null;
  }
  if (!s.dead) dailyEvents(s, info);
}

const ILLNESS_TEXT = { ague: 'ague', flux: 'flux', fever: 'fever', infectedInjury: 'festering wound', pestilence: 'pestilence' } as const;

function causeOf(m: Member, ill: keyof typeof ILLNESS_TEXT | null): string {
  if (ill) return `of the ${ILLNESS_TEXT[ill]}`;
  if (m.body.reserve < 15) return 'of hunger';
  return 'in their sleep';
}

const FEAST_TEXT: Record<DayInfo['feasts'][number], string> = {
  ladyDay: 'Lady Day. The year turns.',
  ashWednesday: 'Ash Wednesday. Lent begins: no meat until Easter.',
  lent: '',
  goodFriday: 'Good Friday. The church is stripped and dark.',
  easter: 'Easter Day. The bells ring and the fast is broken.',
  ploughMonday: 'Plough Monday. The plough is dragged round the village for pennies.',
  mayDay: 'May Day. Greenery over the doors, dancing on the green.',
  midsummer: 'Midsummer Eve. Bonfires on the hill against the dark.',
  lammas: 'Lammas. A loaf of the new grain is blessed at mass.',
  michaelmas: 'Michaelmas. Rents fall due.',
  martinmas: 'Martinmas. The killing time.',
  christmas: 'Christmas Day. Twelve days of rest begin.',
  twelveDays: '',
  epiphany: 'Twelfth Day. The feast ends; the work returns.',
};

/* ───────────── block resolution ───────────── */

function resolveBlock(s: SimState): void {
  const day = Math.floor(s.block / BLOCKS_PER_DAY);
  const bod = s.block % BLOCKS_PER_DAY;
  const info = dayInfo(day);
  const w = weatherFor(s.seed, day);
  if (bod === 0) dawn(s, info, w);
  if (s.dead) {
    s.block += 1;
    return;
  }
  const p = peasant(s);
  let plan = s.plan && s.block >= s.plan.from && s.block < s.plan.until ? s.plan : null;
  const present = plan?.byPlayer === true;
  if (!present && shouldAutoEat(s, info, bod)) {
    const food = eat(s, info);
    if (food) log(s, 'auto', `${p.name} eats ${food}${p.body.hunger >= URGENT_HUNGER ? ', ravenous' : ''}.`, undefined, 'eat');
  }
  if (!plan) {
    const c = chooseAction(s, info, bod, w);
    plan = { action: c.action, param: c.param, from: s.block, until: s.block + planLength(c.action, bod), byPlayer: false };
    s.plan = plan;
  }
  const first = plan.from === s.block;
  const did = runActionBlock(s, plan.action, plan.param, info, bod, first);
  if (first && !plan.byPlayer) log(s, 'auto', `${p.name} ${did}.`, undefined, plan.action);
  if (s.doom) {
    bury(s, p, s.doom);
    s.doom = null;
    finishBlock(s, info, bod);
    return;
  }
  if (bod >= 4) roadAtNight(s, info);
  if (bod === 5 && s.location !== 'camp') nightTerrors(s);

  // Hearth: its logs burn down (fast in a blaze, slowly as embers on a mild day). On a cold day whoever is at
  // home lays a log from the woodstock when the fire is down to its last; feeding it more makes it blaze.
  const cold = w.tempC < FIRE_BELOW_C;
  const someoneHome = s.location === 'home' || s.members.some((m) => m.alive && m !== p);
  if (cold && someoneHome && (s.hearth ?? 0) < HEARTH.keep && s.wealth.firewood >= 1) {
    s.wealth.firewood -= 1;
    s.hearth = (s.hearth ?? 0) + 1;
  }
  const fuel = s.hearth ?? 0;
  const blazing = fuel >= HEARTH.blaze;
  const fireLit = cold && fuel > 0;
  s.hearth = Math.max(0, fuel - (blazing ? HEARTH.blazeBurn : cold ? HEARTH.burn : HEARTH.embers));
  if (blazing && s.location === 'home') s.soul.morale = clamp(s.soul.morale + HEARTH.blazeMorale);
  const activity = ACTIONS[plan.action].activity;
  const warmer = blazing ? HEARTH.blazeWarmth : 0;
  const atHome = s.location === 'home';
  tickBody(p.body, { activity, tempC: w.tempC + (atHome ? warmer : 0), atHome: atHome || s.location === 'town', fireLit, night: bod === 5 });
  for (const m of s.members) {
    if (m === p || !m.alive) continue;
    tickBody(m.body, { activity: bod === 5 ? 'sleep' : 'light', tempC: w.tempC + warmer, atHome: true, fireLit, night: bod === 5 });
  }
  if (rand(s) < injuryChance(p.body, activity)) {
    injure(p.body);
    log(s, 'body', `${p.name} is hurt, worn out at the work.`);
  }
  const m = s.soul;
  m.morale = clamp(m.morale + (50 - m.morale) * MORALE_DRIFT);
  if (p.body.hunger >= URGENT_HUNGER) m.morale = clamp(m.morale + MORALE_HUNGRY_BLOCK);
  if (p.body.illness) m.morale = clamp(m.morale + MORALE_ILL_BLOCK);
  if (p.body.warmth < WARMTH_COLD) m.morale = clamp(m.morale + MORALE_COLD_BLOCK);

  finishBlock(s, info, bod);
}

function finishBlock(s: SimState, info: DayInfo, bod: number): void {
  if (bod === BLOCKS_PER_DAY - 1 && !s.dead) endOfDayObligations(s, info);
  s.block += 1;
  s.ateThisBlock = false;
  if (s.plan && s.block >= s.plan.until) s.plan = null;
}

function runTo(s: SimState, target: number): number {
  let n = 0;
  while (s.block < target) {
    resolveBlock(s);
    n++;
  }
  return n;
}

export interface AdvanceResult {
  state: SimState;
  blocksRun: number;
  neglected: boolean;
}

/**
 * Simulates every whole block elapsed up to `nowMs`. Pure: returns a new state (or the same one when
 * nothing is due). Never rewinds: if `nowMs` is before the last simulation, nothing happens. A gap longer
 * than the catch-up cap is treated as the cap; the rest is dropped and the peasant is marked neglected.
 */
export function advance(state: SimState, nowMs: number): AdvanceResult {
  if (nowMs < state.lastSimMs) return { state, blocksRun: 0, neglected: false };
  const due = blockAt(state, nowMs) - state.block;
  if (due <= 0) return { state, blocksRun: 0, neglected: false };
  const s = cloneState(state);
  let run = due;
  let neglected = false;
  if (due > CATCHUP_CAP_BLOCKS) {
    const dropped = due - CATCHUP_CAP_BLOCKS;
    s.anchorMs += (dropped * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
    run = CATCHUP_CAP_BLOCKS;
    neglected = true;
    s.neglect = true;
    s.soul.morale = clamp(s.soul.morale + NEGLECT.morale);
    s.standing.village = clamp(s.standing.village + NEGLECT.village);
    log(s, 'neglect', `Left to fend alone for over ${Math.round(due / BLOCKS_PER_REAL_DAY)} days. The neighbours whisper.`);
  }
  runTo(s, s.block + run);
  s.lastSimMs = nowMs;
  return { state: s, blocksRun: run, neglected };
}

export interface ActResult {
  state: SimState;
  ok: boolean;
  message: string;
}

/** The player commits an action in the current block. Catches the sim up to `nowMs` first. */
export function act(state: SimState, id: ActionId, nowMs: number, param: string | null = null): ActResult {
  const caught = advance(state, nowMs).state;
  const s = caught === state ? cloneState(state) : caught;
  const bod = s.block % BLOCKS_PER_DAY;
  const info = dayInfo(Math.floor(s.block / BLOCKS_PER_DAY));
  const why = availability(s, id, info, bod, param);
  if (why) return { state: caught, ok: false, message: why };
  s.neglect = false;
  s.counters.lastPlayerBlock = s.block;
  const p = peasant(s);
  const slot = slotOf(info.weekday, bod);
  if (id === 'stokeFire') {
    const n = stokeFire(s);
    log(s, 'action', `${p.name} lays ${n === 1 ? 'a log' : `${n} logs`} on the fire.`, undefined, 'stokeFire');
    return { state: s, ok: true, message: n >= 2 ? 'THE FIRE ROARS UP' : 'A LOG ON THE FIRE' };
  }
  if (id === 'eat') {
    const food = eat(s, info, (param as Food | null) ?? null);
    recordMeal(s, slot);
    log(s, 'meal', `${p.name} eats ${food}.`, undefined, 'eat');
    return { state: s, ok: true, message: `ATE ${String(food).toUpperCase()}` };
  }
  const ongoing = s.plan && s.block >= s.plan.from && s.block < s.plan.until ? s.plan : null;
  if (ongoing && ongoing.action === id && ongoing.param === param) {
    // Choosing what you are already doing just carries on with it.
    ongoing.byPlayer = true;
    return { state: s, ok: true, message: ACTIONS[id].label };
  }
  s.plan = { action: id, param, from: s.block, until: s.block + planLength(id, bod), byPlayer: true };
  const def = ACTIONS[id];
  s.location = placeFor(s, id, def.location);
  recordAction(s, slot, id);
  log(s, 'action', `${p.name} chooses to ${def.label.toLowerCase()}.`, undefined, id);
  return { state: s, ok: true, message: def.label };
}

/**
 * The player watches their peasant work: the rest of the chosen task passes at once. The life's clock is
 * moved on to the end of the task (the life runs that much ahead of the wall clock from now on) and the
 * blocks are simulated. Only a task the player chose; returns the state unchanged otherwise.
 */
export function hasten(state: SimState, nowMs: number): SimState {
  const caught = advance(state, nowMs).state;
  const plan = caught.plan;
  if (!plan || !plan.byPlayer || caught.dead || caught.block >= plan.until) return caught;
  const s = caught === state ? cloneState(state) : caught;
  const elapsed = nowMs - s.anchorMs;
  const target = (plan.until * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
  const need = target - elapsed + 1; // a millisecond into the next block, clear of rounding
  // The allowance refills with real time; the life only jumps as far as it allows.
  const h = s.haste ?? { budgetMs: HASTE_BUDGET_MS, atMs: nowMs };
  const budget = Math.min(HASTE_BUDGET_MS, h.budgetMs + Math.max(0, nowMs - h.atMs) * HASTE_REFILL);
  const jump = Math.min(need, budget);
  s.haste = { budgetMs: budget - jump, atMs: nowMs };
  if (jump <= 0) return s;
  s.anchorMs -= jump;
  const to = jump >= need ? plan.until : Math.floor(((nowMs - s.anchorMs) * BLOCKS_PER_REAL_DAY) / REAL_DAY_MS);
  runTo(s, to);
  s.lastSimMs = Math.max(s.lastSimMs, nowMs);
  return s;
}

/* ───────────── debug ───────────── */

/** Jumps the life forward by `blocks`, simulating every block (no catch-up cap, no neglect). */
export function debugFastForward(state: SimState, blocks: number, nowMs: number): SimState {
  const s = cloneState(state);
  s.anchorMs -= (blocks * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
  runTo(s, Math.max(s.block, blockAt(s, nowMs)));
  s.lastSimMs = Math.max(s.lastSimMs, nowMs);
  log(s, 'debug', `Debug: fast-forwarded ${blocks} blocks.`);
  return s;
}

export function debugTrigger(state: SimState, id: string): SimState {
  const s = cloneState(state);
  const ok = triggerEvent(s, id, dayInfo(Math.floor(s.block / BLOCKS_PER_DAY)));
  log(s, 'debug', `Debug: triggered ${id}${ok ? '' : ' (unknown)'}.`);
  return s;
}

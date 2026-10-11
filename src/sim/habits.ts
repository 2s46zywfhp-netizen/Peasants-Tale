import {
  ACTIONS, AUTOPILOT_NOISE, AUTO_EAT_HABIT_HUNGER, AUTO_EAT_HUNGER, DEFAULT_MEAL_BLOCKS, DEFAULT_ROUTINE, DEFAULT_SUNDAY,
  DEFAULT_WEEK_WORK_DAY, ENOUGH_COOKED, LOW_COOKED, FIRE_BELOW_C, HABIT_DEFAULT_WEIGHT, HABIT_SLOT_DECAY, HABIT_WEEKLY_DECAY, HABIT_WEIGHT, PRICES,
  LOW_GRAIN, RENT_PENCE, SURPLUS_GRAIN, URGENT_HUNGER, VICE_LATENESS_HUNGER, VICE_MORALE, WARMTH_COLD, WEEK_WORK_DAYS, type ActionId, type TradeKind, TOOL_MEND, TOOLS_MEND_BELOW,
} from './balance';
import { ACTION_IDS, availability, bestFood, foodServings, readyServings } from './actions';
import type { DayInfo } from './calendar';
import { fieldTask } from './farm';
import { isBoonDay } from './obligations';
import { peasant, rand, type SimState } from './state';
import { present } from './village';
import type { Weather } from './weather';

export const slotOf = (weekday: number, bod: number): number => weekday * 6 + bod;

export function seedDefaultHabits(s: SimState): void {
  for (let wd = 0; wd < 7; wd++) {
    const routine = wd === 0 ? DEFAULT_SUNDAY : WEEK_WORK_DAYS.includes(wd) ? DEFAULT_WEEK_WORK_DAY : DEFAULT_ROUTINE;
    routine.forEach((a, bod) => {
      s.habits.actions[slotOf(wd, bod)]![a] = HABIT_DEFAULT_WEIGHT;
    });
    for (const bod of DEFAULT_MEAL_BLOCKS) s.habits.meals[slotOf(wd, bod)] = 1;
  }
}

/** The player chose `a` in this slot: older choices there fade, this one grows. */
export function recordAction(s: SimState, slot: number, a: ActionId): void {
  const w = s.habits.actions[slot]!;
  for (const k of Object.keys(w) as ActionId[]) w[k] = w[k]! * HABIT_SLOT_DECAY;
  w[a] = (w[a] ?? 0) + 1;
}

export function recordMeal(s: SimState, slot: number): void {
  s.habits.meals[slot] = s.habits.meals[slot]! * HABIT_SLOT_DECAY + 1;
}

/**
 * Weekly fade: in every slot, all but the strongest habit decay, so old one-off choices are forgotten
 * while the established routine persists through a long absence.
 */
export function weeklyHabitDecay(s: SimState): void {
  for (const w of s.habits.actions) {
    const keys = Object.keys(w) as ActionId[];
    const top = keys.reduce<ActionId | null>((a, k) => (a === null || w[k]! > w[a]! ? k : a), null);
    for (const k of keys) if (k !== top) w[k] = w[k]! * HABIT_WEEKLY_DECAY;
  }
}

const lowMorale = (s: SimState) => s.soul.morale < VICE_MORALE;

/** Should the absent peasant eat now? Hunger first, then habit; low morale makes meals late. */
export function shouldAutoEat(s: SimState, info: DayInfo, bod: number): boolean {
  if (s.ateThisBlock || !bestFood(s, info)) return false;
  const h = peasant(s).body.hunger;
  const late = lowMorale(s) ? VICE_LATENESS_HUNGER : 0;
  if (h >= AUTO_EAT_HUNGER + late) return true;
  return s.habits.meals[slotOf(info.weekday, bod)]! >= 0.5 && h >= AUTO_EAT_HABIT_HUNGER + late;
}

export interface Choice {
  action: ActionId;
  param: string | null;
  why: 'habit' | 'need' | 'vice';
}

/** Choices the autopilot never makes on its own: they are the player's to make. */
const DELIBERATE: ReadonlySet<ActionId> = new Set(['eat', 'court', 'marry', 'accuse', 'takeHolding', 'buyFreedom', 'flee', 'rob', 'offering', 'surrender', 'askFavour']);

/** The neighbour the autopilot would help: whoever likes the family best and is owed nothing yet. */
function neighbourToHelp(s: SimState): string | null {
  let best: string | null = null;
  let score = -Infinity;
  for (const v of s.village) {
    if (!present(v) || v.owes >= 1) continue;
    if (v.opinion > score) {
      score = v.opinion;
      best = v.id;
    }
  }
  return best;
}

function tradeNeed(s: SimState): TradeKind | null {
  const w = s.wealth;
  if ((w.grain < LOW_GRAIN || foodServings(s) < 2) && w.pence >= PRICES.grainBuy) return 'buyGrain';
  // In the town there is no wood to gather: it is bought.
  if (s.station.residence === 'town' && w.firewood < 2 && w.pence >= PRICES.firewoodBuy) return 'buyFirewood';
  if (w.grain > SURPLUS_GRAIN && w.pence < RENT_PENCE) return 'sellGrain';
  if (w.eggs >= PRICES.eggsPerPenny * 2) return 'sellEggs';
  if (w.tools < TOOLS_MEND_BELOW && w.pence >= TOOL_MEND.pence + RENT_PENCE) return 'mendTools';
  return null;
}

/** The absent peasant's choice: habit weight plus needs. Urgent hunger and cold override habit. */
export function chooseAction(s: SimState, info: DayInfo, bod: number, w: Weather): Choice {
  const b = peasant(s).body;
  const habit = s.habits.actions[slotOf(info.weekday, bod)]!;
  const duty = lowMorale(s) ? s.soul.morale / VICE_MORALE : 1;
  const cold = b.warmth < WARMTH_COLD;
  const task = fieldTask(s, info);
  const trade = tradeNeed(s);
  let best: Choice = { action: 'rest', param: null, why: 'need' };
  let bestScore = -Infinity;
  const landless = s.obligations.evicted;
  const hungry = foodServings(s) < 3;
  for (const id of ACTION_IDS) {
    if (DELIBERATE.has(id)) continue;
    const param = id === 'trade' ? trade : id === 'helpNeighbour' ? neighbourToHelp(s) : null;
    if ((id === 'trade' || id === 'helpNeighbour') && !param) continue;
    if (availability(s, id, info, bod, param) !== null) continue;
    const h = (habit[id] ?? 0) * HABIT_WEIGHT;
    let need = 0;
    let override = 0;
    let vice = 0;
    switch (id) {
      case 'sleep': need = (bod === 5 ? 4 : 0) + Math.max(0, (b.fatigue - 60) / 10); break;
      case 'rest': need = (b.fatigue > 50 ? 1 : 0) + (cold && s.wealth.firewood > 0 ? 2 : 0); if (cold && s.wealth.firewood > 0) override = 8; break;
      case 'cook':
        need = readyServings(s) < LOW_COOKED ? 5 + (readyServings(s) < 2 ? 3 : 0) : readyServings(s) >= ENOUGH_COOKED ? -10 : 0;
        if (readyServings(s) < 1 && b.hunger >= URGENT_HUNGER) override = 10;
        break;
      case 'gatherFirewood':
        need = s.wealth.firewood < 3 && w.tempC < FIRE_BELOW_C ? 3 : 0;
        if (cold && s.wealth.firewood < 1) override = 10;
        break;
      case 'workStrips': need = task ? (task.task === 'care' ? 1 : 3) : 0; break;
      case 'weekWork': need = (isBoonDay(info) ? 6 : 3) * duty; break;
      case 'attendMass': need = 4 * duty; break;
      case 'wash': need = b.filth > 50 ? 2 + (b.filth - 50) / 10 : 0; break;
      case 'trade':
        need = param === 'buyGrain' ? 4 : param === 'sellGrain' ? (info.month === 8 || info.month === 9 ? 5 : 2) : 1;
        if (param === 'buyGrain' && (b.hunger >= URGENT_HUNGER || foodServings(s) < 2 * s.members.length)) override = 10;
        if (param === 'buyFirewood') need = 5;
        break;
      case 'tavern': vice = lowMorale(s) ? 1 + (VICE_MORALE - s.soul.morale) / 5 : 0; break;
      case 'socialise': need = s.soul.morale < 45 ? 0.5 : 0; break;
      // The landless work for hire, beg when there is nothing, and poach when outlawed and hungry.
      case 'hire': need = landless || s.station.residence === 'town' ? 6 + (hungry ? 3 : 0) : 0; break;
      case 'beg': need = s.station.beggar && hungry ? 7 : 0; break;
      case 'poach': need = s.station.outlaw ? (hungry ? 8 : 3) : 0; break;
      case 'helpNeighbour': need = 0; break;
      default: break;
    }
    // Duties the habit points at also weaken with low morale (lateness, skipped duties).
    const dutyHabit = id === 'weekWork' || id === 'attendMass' ? h * duty : h;
    const score = dutyHabit + need + vice + override + rand(s) * AUTOPILOT_NOISE;
    if (score > bestScore) {
      bestScore = score;
      best = { action: id, param, why: override > 0 || need > dutyHabit ? 'need' : vice > dutyHabit ? 'vice' : 'habit' };
    }
  }
  return best;
}

/** Plan length for an action started in block-of-day `bod`: multi-block actions stop at dusk. */
export function planLength(id: ActionId, bod: number): number {
  const d = Math.max(1, ACTIONS[id].duration);
  return d > 1 ? Math.min(d, 4 - bod) : d;
}


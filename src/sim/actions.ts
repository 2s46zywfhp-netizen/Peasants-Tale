import {
  ACTIONS, BREW_GRAIN, BREW_YIELD, CONFESS_HEATHEN_DAYS, COOK_GRAIN, COOK_YIELD, DRUNKARD_HIT, DRUNKARD_TAVERN_PER_WEEK,
  BRAWL_CHANCE, DEED, GOOD_NEIGHBOUR_GAIN, GOOD_NEIGHBOUR_SOCIAL_PER_WEEK, LORD_HIT, MEAL_VALUE, MEAT_SEEN, MEAT_SEEN_CHANCE, PRICES, SERVING_COST, BEAST_PRICES, HUNGRY_GAP, TOOL_MEND,
  TAG_DAYS, VICE_MORALE, type ActionId, type Effects, type Food, type TradeKind,
} from './balance';
import type { DayInfo } from './calendar';
import { offering, offeringShort } from './dark';
import { court, courtShort, living, marry, marryShort, servingShare } from './family';
import { workStrips } from './farm';
import { log } from './log';
import { creditWeekWork, isBoonDay, isWeekWorkDay, recordMass } from './obligations';
import { addTag, clamp, hasTag, peasant, rand, today, type SimState } from './state';
import {
  beg, buyFreedom, flee, hire, owesLabour, placeFor, poach, rob, stationShort, surrender, takeHolding,
} from './station';
import { accuse, askFavour, deed, favourShort, hearGossip, helpNeighbour, present, villager } from './village';

export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];
export const FOODS: readonly Food[] = ['pottage', 'bread', 'eggs', 'meat', 'grain'];
export const TRADE_KINDS: readonly TradeKind[] = [
  'sellGrain', 'buyGrain', 'sellEggs', 'buyFirewood', 'sellAle', 'buyHen', 'sellHen', 'buyPig', 'sellPig', 'buyCow', 'sellCow', 'buyOx', 'sellOx', 'mendTools',
];
type Beast = keyof typeof BEAST_PRICES;
const BEAST_FIELD = { hen: 'hens', pig: 'pig', cow: 'cow', ox: 'ox' } as const;
const beastOf = (kind: TradeKind): Beast | null => {
  const m = /^(buy|sell)(Hen|Pig|Cow|Ox)$/.exec(kind);
  return m ? (m[2]!.toLowerCase() as Beast) : null;
};

/** Grain's market price this month: dearer in the Hungry Gap. */
export function grainBuyPrice(month: number): number {
  return HUNGRY_GAP.months.includes(month) ? Math.round(PRICES.grainBuy * HUNGRY_GAP.grainPriceMult) : PRICES.grainBuy;
}

function servings(s: SimState, food: Food): number {
  return Math.floor((s.wealth[food] + 1e-9) / SERVING_COST[food]);
}

/** Total servings of any food in the house. */
export function foodServings(s: SimState): number {
  return FOODS.reduce((n, f) => n + servings(s, f), 0);
}

/** Servings of cooked food and eggs/meat: what is ready to eat without resorting to raw grain. */
export function readyServings(s: SimState): number {
  return FOODS.reduce((n, f) => n + (f === 'grain' ? 0 : servings(s, f)), 0);
}

/**
 * Best food on hand: one that feeds the whole household if possible. Meat is avoided on fast days
 * and raw grain is the last resort.
 */
export function bestFood(s: SimState, info: DayInfo): Food | null {
  const day = today(s);
  const mouths = Math.max(1, Math.ceil(living(s).reduce((n, m) => n + servingShare(m, day), 0)));
  const order = FOODS.filter((f) => !(f === 'meat' && info.isFastDay));
  return order.find((f) => servings(s, f) >= mouths) ?? order.find((f) => servings(s, f) >= 1) ?? (servings(s, 'meat') >= 1 ? 'meat' : null);
}

export function tradeAvailable(s: SimState, kind: TradeKind, month = 1): string | null {
  const w = s.wealth;
  const beast = beastOf(kind);
  if (beast) {
    const p = BEAST_PRICES[beast];
    const have = w[BEAST_FIELD[beast]];
    if (kind.startsWith('buy')) return have >= p.max ? 'NO ROOM' : w.pence >= p.buy ? null : 'TOO POOR';
    return have >= 1 ? null : 'NONE TO SELL';
  }
  switch (kind) {
    case 'mendTools': return w.tools >= 100 - TOOL_MEND.restore / 2 ? 'TOOLS ARE SOUND' : w.pence >= TOOL_MEND.pence ? null : 'TOO POOR';
    case 'sellGrain': return w.grain >= 1 ? null : 'NO GRAIN';
    case 'buyGrain': return w.pence >= grainBuyPrice(month) ? null : 'TOO POOR';
    case 'sellEggs': return w.eggs >= PRICES.eggsPerPenny ? null : 'TOO FEW EGGS';
    case 'buyFirewood': return w.pence >= PRICES.firewoodBuy ? null : 'TOO POOR';
    case 'sellAle': return w.ale >= PRICES.alePerPenny ? null : 'NO ALE';
    default: return 'NOT SOLD HERE';
  }
}

/** null if the action can start now, else a short reason. */
export function availability(s: SimState, id: ActionId, info: DayInfo, bod: number, param: string | null = null): string | null {
  if (s.dead) return 'DEAD';
  const def = ACTIONS[id];
  if (!def.blocks.includes(bod)) return 'NOT NOW';
  if (def.days === 'sunday' && !info.isSunday) return 'SUNDAYS ONLY';
  if (def.days === 'weekWork' && !(isWeekWorkDay(info) || isBoonDay(info))) return 'NOT OWED TODAY';
  if (id === 'weekWork' && !owesLabour(s)) return 'NOT OWED';
  return stationShort(s, id) ?? resourceShort(s, id, info, param);
}

/** null if the household has what the action consumes, else a short reason. */
export function resourceShort(s: SimState, id: ActionId, info: DayInfo, param: string | null): string | null {
  const w = s.wealth;
  switch (id) {
    case 'eat': {
      if (s.ateThisBlock) return 'ALREADY ATE';
      if (param) return servings(s, param as Food) >= 1 ? null : 'NONE LEFT';
      return bestFood(s, info) ? null : 'NO FOOD';
    }
    case 'stokeFire': return w.firewood < 1 ? 'NO WOOD IN THE STOCK' : null;
    case 'cook': return w.grain < COOK_GRAIN ? 'NO GRAIN' : w.firewood < 1 ? 'NO FIREWOOD' : null;
    case 'brew': return w.grain < BREW_GRAIN ? 'NO GRAIN' : w.firewood < 1 ? 'NO FIREWOOD' : null;
    case 'workStrips': return s.obligations.evicted ? 'NO LAND' : null;
    case 'weekWork': return s.obligations.evicted ? 'NO LAND' : null;
    case 'tavern': return w.pence < 1 ? 'NO PENNY' : null;
    case 'trade': return param ? tradeAvailable(s, param as TradeKind, info.month) : null;
    case 'court': return courtShort(s, param);
    case 'marry': return marryShort(s, param);
    case 'helpNeighbour':
    case 'accuse': {
      const v = villager(s, param);
      return !v ? 'CHOOSE WHO' : present(v) ? null : 'GONE';
    }
    case 'askFavour': return favourShort(s, param);
    case 'offering': return offeringShort(s);
    default: return null;
  }
}

/** Feeds every living household member one serving of `food` (or the best on hand). Returns the food eaten. */
export function eat(s: SimState, info: DayInfo, food: Food | null = null): Food | null {
  const f = food ?? bestFood(s, info);
  if (!f) return null;
  const day = info.dayIndex;
  for (const m of living(s)) {
    // The chosen food first; if it runs out, whatever else is on hand.
    const g = servings(s, f) >= 1 ? f : bestFood(s, info);
    if (!g) break;
    s.wealth[g] = Math.max(0, s.wealth[g] - SERVING_COST[g] * servingShare(m, day));
    m.body.hunger = clamp(m.body.hunger - MEAL_VALUE[g]);
  }
  s.ateThisBlock = true;
  if (f === 'meat' && info.isFastDay && rand(s) < MEAT_SEEN_CHANCE) {
    s.standing.priest = clamp(s.standing.priest + MEAT_SEEN.priest);
    s.soul.publicPiety = clamp(s.soul.publicPiety + MEAT_SEEN.publicPiety);
    addTag(s, 'heathen', info.dayIndex + TAG_DAYS.heathen);
    deed(s, DEED.heathen, `${peasant(s).name} ${s.familyName} was seen eating meat on a fast day.`);
    log(s, 'church', `Seen eating meat on a ${info.isLent ? 'Lenten' : 'Friday'} fast. Tongues wag.`);
  }
  return f;
}

function trade(s: SimState, kind: TradeKind, month: number): string {
  const w = s.wealth;
  const beast = beastOf(kind);
  if (beast) {
    const p = BEAST_PRICES[beast];
    const f = BEAST_FIELD[beast];
    if (kind.startsWith('buy')) {
      if (w[f] >= p.max || w.pence < p.buy) return 'haggles but buys nothing';
      w.pence -= p.buy;
      w[f] += 1;
      return `buys ${beast === 'ox' ? 'an ox' : `a ${beast}`} for ${p.buy}d`;
    }
    if (w[f] < 1) return 'has nothing to sell';
    w[f] -= 1;
    w.pence += p.sell;
    return `sells ${beast === 'ox' ? 'an ox' : `a ${beast}`} for ${p.sell}d`;
  }
  switch (kind) {
    case 'mendTools':
      if (w.pence < TOOL_MEND.pence) return 'cannot pay the smith';
      w.pence -= TOOL_MEND.pence;
      w.tools = Math.min(100, w.tools + TOOL_MEND.restore);
      return `has the smith mend the tools for ${TOOL_MEND.pence}d`;
    case 'sellGrain': {
      const n = Math.min(2, Math.floor(w.grain));
      w.grain -= n;
      w.pence += n * PRICES.grainSell;
      return `sells ${n} bu of grain for ${n * PRICES.grainSell}d`;
    }
    case 'buyGrain': {
      const price = grainBuyPrice(month);
      const n = Math.min(2, Math.floor(w.pence / price));
      w.pence -= n * price;
      w.grain += n;
      return `buys ${n} bu of grain for ${n * price}d`;
    }
    case 'sellEggs': {
      const d = Math.floor(w.eggs / PRICES.eggsPerPenny);
      w.eggs -= d * PRICES.eggsPerPenny;
      w.pence += d;
      return `sells eggs for ${d}d`;
    }
    case 'buyFirewood':
      w.pence -= PRICES.firewoodBuy;
      w.firewood += 3;
      return 'buys a bundle of firewood';
    case 'sellAle': {
      const d = Math.min(4, Math.floor(w.ale / PRICES.alePerPenny));
      w.ale -= d * PRICES.alePerPenny;
      w.pence += d;
      s.counters.aleSold += d;
      return `sells ale for ${d}d`;
    }
    default:
      return 'haggles but buys nothing';
  }
}

function applyEffects(s: SimState, e: Effects): void {
  const b = peasant(s).body;
  if (e.fatigue) b.fatigue = clamp(b.fatigue + e.fatigue);
  if (e.filth) b.filth = clamp(b.filth + e.filth);
  if (e.warmth) b.warmth = clamp(b.warmth + e.warmth);
  if (e.hunger) b.hunger = clamp(b.hunger + e.hunger);
  if (e.morale) s.soul.morale = clamp(s.soul.morale + e.morale);
  if (e.privatePiety) s.soul.privatePiety = clamp(s.soul.privatePiety + e.privatePiety);
  if (e.publicPiety) s.soul.publicPiety = clamp(s.soul.publicPiety + e.publicPiety);
  if (e.lord) s.standing.lord = clamp(s.standing.lord + e.lord);
  if (e.priest) s.standing.priest = clamp(s.standing.priest + e.priest);
  if (e.village) s.standing.village = clamp(s.standing.village + e.village);
  if (e.pence) s.wealth.pence = Math.max(0, s.wealth.pence + e.pence);
  if (e.firewood) s.wealth.firewood = Math.max(0, s.wealth.firewood + e.firewood);
  if (e.ale) s.wealth.ale = Math.max(0, s.wealth.ale + e.ale);
}

/**
 * One block of an action. `first` is true on the block the action began.
 * Returns a phrase describing what was done (for the log).
 */
export function runActionBlock(s: SimState, id: ActionId, param: string | null, info: DayInfo, bod: number, first: boolean): string {
  const def = ACTIONS[id];
  s.location = placeFor(s, id, def.location);
  // Re-check resources each block: a multi-block plan can run dry.
  if (resourceShort(s, id, info, param) !== null) return 'finds nothing to do';
  applyEffects(s, def.effects);
  const w = s.wealth;
  switch (id) {
    case 'cook':
      w.grain -= COOK_GRAIN;
      w.bread += COOK_YIELD.bread;
      w.pottage += COOK_YIELD.pottage;
      s.hearth = (s.hearth ?? 0) + 1; // the log goes on the fire under the pot
      return 'bakes bread and boils pottage';
    case 'brew':
      w.grain -= BREW_GRAIN;
      w.ale += BREW_YIELD;
      s.hearth = (s.hearth ?? 0) + 1;
      return 'brews ale';
    case 'sleep': return 'sleeps';
    case 'rest': return 'rests by the hearth';
    case 'workStrips': return workStrips(s, info);
    case 'weekWork':
      if (first && bod > 1) {
        s.standing.lord = clamp(s.standing.lord + LORD_HIT.late);
        log(s, 'manor', 'Late to the demesne. The reeve notes it.');
      }
      creditWeekWork(s, info);
      return isBoonDay(info) ? 'does boon work for the lord' : 'labours on the demesne';
    case 'attendMass':
      recordMass(s);
      return 'hears mass';
    case 'pray': return 'prays in the church';
    case 'prayHome': return 'kneels by the bed and prays';
    case 'confess': {
      const t = s.tags.find((x) => x.id === 'heathen');
      if (t) t.untilDay -= CONFESS_HEATHEN_DAYS;
      return 'confesses to the priest';
    }
    case 'tavern': {
      s.counters.tavernThisWeek += 1;
      if (s.counters.tavernThisWeek >= DRUNKARD_TAVERN_PER_WEEK && !hasTag(s, 'drunkard')) {
        addTag(s, 'drunkard', info.dayIndex + TAG_DAYS.drunkard);
        s.standing.village = clamp(s.standing.village + DRUNKARD_HIT.village);
        s.standing.priest = clamp(s.standing.priest + DRUNKARD_HIT.priest);
        deed(s, DEED.drunkard, `${peasant(s).name} ${s.familyName} is at the alehouse every night now.`);
        log(s, 'event', 'Known now as a drunkard at the alehouse.');
      }
      if (rand(s) < BRAWL_CHANCE * (s.soul.morale < VICE_MORALE ? 2 : 1) * (hasTag(s, 'drunkard') ? 2 : 1)) {
        s.counters.brawls += 1;
        addTag(s, 'brawler', info.dayIndex + TAG_DAYS.brawler);
        peasant(s).body.health = clamp(peasant(s).body.health - 4);
        deed(s, DEED.quarrel, `${peasant(s).name} ${s.familyName} started a fight in the alehouse.`);
        log(s, 'event', 'Words, then fists. A brawl in the alehouse. The reeve saw.');
      } else if (s.station.residence === 'village') hearGossip(s);
      return 'drinks at the alehouse';
    }
    case 'gatherFirewood': return 'chops wood, and carries it home to the stack';
    case 'wash': return 'washes in the stream';
    case 'socialise':
      s.counters.socialThisWeek += 1;
      if (s.counters.socialThisWeek >= GOOD_NEIGHBOUR_SOCIAL_PER_WEEK && !hasTag(s, 'goodNeighbour')) {
        addTag(s, 'goodNeighbour', info.dayIndex + TAG_DAYS.goodNeighbour);
        s.standing.village = clamp(s.standing.village + GOOD_NEIGHBOUR_GAIN);
        deed(s, DEED.goodNeighbour, `${peasant(s).name} ${s.familyName} always has time for a neighbour.`);
        log(s, 'event', 'The village calls you a good neighbour.');
      }
      hearGossip(s);
      return 'passes the time on the green';
    case 'trade': return param ? trade(s, param as TradeKind, info.month) : 'haggles but buys nothing';
    case 'eat':
    case 'stokeFire':
      return '';
    case 'court': return param ? court(s, param, info) : 'idles on the green';
    case 'marry': return param ? marry(s, param, info) : 'waits at the church door';
    case 'helpNeighbour': return param ? helpNeighbour(s, param) : 'finds nobody to help';
    case 'askFavour': return param ? askFavour(s, param, info) : 'asks nobody';
    case 'accuse': return param ? accuse(s, param) : 'mutters';
    case 'takeHolding': return takeHolding(s);
    case 'buyFreedom': return buyFreedom(s);
    case 'hire': return hire(s);
    case 'beg': return beg(s);
    case 'flee': return flee(s);
    case 'poach':
    case 'rob': {
      const r = id === 'poach' ? poach(s) : rob(s);
      if (r.hanged) s.doom = 'hanged at the crossroads';
      return r.text;
    }
    case 'offering': return offering(s);
    case 'surrender': return surrender(s);
  }
}

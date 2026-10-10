import {
  BEAST_VALUE, BEG, BEGGAR_AFTER_DAYS, DEBT, DEED, EVICTION, FLIGHT, FREEDOM, HOLDING, LORD_HIT, POACH, PRICES, RANK_ACRES, RENT_FREE_PER_ACRE,
  OUTLAW_TAKEN_DAILY, RENT_PER_ACRE, ROB, SURRENDER_FINE, TOWN_WAGE_PER_BLOCK, WAGE_PER_BLOCK, type ActionId, type Location,
} from './balance';
import type { DayInfo } from './calendar';
import { note } from './family';
import { log } from './log';
import { clamp, peasant, rand, today, type SimState } from './state';
import { deed } from './village';

export type Rank =
  | 'OUTLAW' | 'FUGITIVE' | 'BEGGAR' | 'LABOURER' | 'COTTAR' | 'VILLEIN' | 'VIRGATER' | 'REEVE' | 'FREE TENANT' | 'YEOMAN' | 'CRAFTSMAN';

/** Where the family stands, from the gallows' shadow to a yeoman's hall. */
export function rankOf(s: SimState): Rank {
  const st = s.station;
  const acres = s.wealth.acres;
  if (st.outlaw) return 'OUTLAW';
  if (st.fledDay !== null) return 'FUGITIVE';
  if (st.beggar) return 'BEGGAR';
  if (acres === 0) return st.craft ? 'CRAFTSMAN' : 'LABOURER';
  if (st.reeveUntil > today(s)) return 'REEVE';
  if (st.free) return acres >= RANK_ACRES.virgate ? 'YEOMAN' : st.craft ? 'CRAFTSMAN' : 'FREE TENANT';
  return acres >= RANK_ACRES.virgate ? 'VIRGATER' : acres >= RANK_ACRES.villein ? 'VILLEIN' : 'COTTAR';
}

export function isReeve(s: SimState): boolean {
  return s.station.reeveUntil > today(s);
}

/** Does the family owe labour to the lord right now? */
export function owesLabour(s: SimState): boolean {
  const st = s.station;
  return !s.obligations.evicted && !st.free && !st.outlaw && st.residence === 'village' && !isReeve(s);
}

/** Michaelmas rent: unfree holdings pay less money (they also owe labour); the reeve pays none. */
export function rentDue(s: SimState): number {
  if (s.obligations.evicted || s.wealth.acres === 0 || isReeve(s) || s.station.residence !== 'village') return 0;
  return Math.round(s.wealth.acres * (s.station.free ? RENT_FREE_PER_ACRE : RENT_PER_ACRE));
}

/** The actual place an action happens, given where the family lives. */
export function placeFor(s: SimState, id: ActionId, loc: Location | 'any'): Location {
  const r = s.station.residence;
  if (id === 'hire') return r === 'town' ? 'town' : 'demesne';
  if (loc === 'any') return s.location;
  if (r === 'town' && (loc === 'home' || loc === 'church' || loc === 'tavern' || loc === 'green' || loc === 'stream')) return 'town';
  if (r === 'camp' && (loc === 'home' || loc === 'stream')) return 'camp';
  return loc;
}

/** Actions open to an outlaw in the woods and to a fugitive in the town. */
const CAMP_ACTIONS: ReadonlySet<ActionId> = new Set(['eat', 'cook', 'sleep', 'rest', 'gatherFirewood', 'wash', 'poach', 'rob', 'offering', 'pray', 'surrender', 'flee']);
const TOWN_ACTIONS: ReadonlySet<ActionId> = new Set(['eat', 'cook', 'brew', 'sleep', 'rest', 'hire', 'trade', 'attendMass', 'pray', 'confess', 'tavern', 'wash']);

/** null if the family's station allows the action, else a reason. */
export function stationShort(s: SimState, id: ActionId): string | null {
  const st = s.station;
  if (st.residence === 'camp' && !CAMP_ACTIONS.has(id)) return 'OUTLAWED';
  if (st.residence === 'town' && !TOWN_ACTIONS.has(id)) return 'IN THE TOWN';
  const ev = s.obligations.evicted;
  switch (id) {
    case 'takeHolding':
      if (s.plague.vacant <= 0) return 'NO LAND VACANT';
      if (s.standing.lord < HOLDING.minLord) return 'LORD UNWILLING';
      return s.wealth.pence < entryFine() ? `ENTRY FINE ${entryFine()}D` : null;
    case 'buyFreedom':
      if (st.free) return 'ALREADY FREE';
      if (s.standing.lord < FREEDOM.minLord) return 'LORD UNWILLING';
      return s.wealth.pence < freedomPrice(s) ? `COSTS ${freedomPrice(s)}D` : null;
    case 'beg': return ev || st.beggar ? null : 'NOT SO LOW';
    case 'flee': return st.free ? 'ALREADY FREE' : null;
    case 'rob': return st.outlaw || ev ? null : 'NOT SO DESPERATE';
    case 'surrender': return st.outlaw ? null : 'NOT OUTLAWED';
    case 'hire': return null;
    default: return null;
  }
}

export const entryFine = (): number => Math.round(HOLDING.entryPerAcre * HOLDING.acres);
export const freedomPrice = (s: SimState): number =>
  Math.round(FREEDOM.pence * (s.plague.phase === 'aftermath' || s.plague.phase === 'over' ? FREEDOM.plagueDiscount : 1));

export function wage(s: SimState): number {
  const base = s.station.residence === 'town' ? TOWN_WAGE_PER_BLOCK * (s.station.craft ? 2 : 1) : WAGE_PER_BLOCK;
  return base * s.wageMult;
}

/* ───────────── land ───────────── */

/** Loses the holding: fields cleared, the land goes back to the lord (debts on it are settled with it). */
export function loseLand(s: SimState, text: string): void {
  const o = s.obligations;
  o.evicted = true;
  o.manorCourtDay = null;
  o.debt = 0;
  s.wealth.acres = 0;
  s.station.reeveUntil = 0;
  for (const f of s.fields) Object.assign(f, { acres: 0, crop: null, stage: 'fallow', sownShare: 0, expectedYield: 0, harvested: 0 });
  s.plague.vacant += 1;
  log(s, 'rank', text);
  note(s, `Lost the holding, ${Math.floor(today(s) / 365) + 1345}.`);
}

export function evict(s: SimState): void {
  s.soul.morale = clamp(s.soul.morale + EVICTION.morale);
  s.standing.lord = clamp(s.standing.lord + EVICTION.lord);
  loseLand(s, 'EVICTED. The steward takes back the holding. The strips are given to another.');
}

/** New acres go to the fallow field: they come into the rotation at the next Michaelmas. */
export function takeHolding(s: SimState): string {
  s.wealth.pence -= entryFine();
  s.plague.vacant -= 1;
  const fallow = s.fields.find((f) => f.kind === 'fallow') ?? s.fields[2]!;
  fallow.acres += HOLDING.acres;
  s.wealth.acres += HOLDING.acres;
  if (s.obligations.evicted) {
    s.obligations.evicted = false;
    s.station.beggar = false;
    s.station.hungryDays = 0;
  }
  s.standing.lord = clamp(s.standing.lord + LORD_HIT.rentPaid);
  log(s, 'rank', `Fealty sworn for ${HOLDING.acres} more acres. Now ${s.wealth.acres} acres: ${rankOf(s)}.`);
  note(s, `Took up ${HOLDING.acres} acres, ${Math.floor(today(s) / 365) + 1345}.`);
  return `takes up ${HOLDING.acres} acres of vacant land`;
}

export function buyFreedom(s: SimState): string {
  const price = freedomPrice(s);
  s.wealth.pence -= price;
  s.station.free = true;
  log(s, 'rank', `Manumission: for ${price}d the lord seals a charter. The ${s.familyName}s are free.`);
  note(s, `Bought the family's freedom for ${price}d.`);
  return 'buys a charter of freedom';
}

/* ───────────── labour, begging, crime ───────────── */

export function hire(s: SimState): string {
  const w = wage(s);
  s.wealth.pence += w;
  return s.station.residence === 'town' ? `works for wages in the town (${w}d)` : `labours for hire (${w}d)`;
}

export function beg(s: SimState): string {
  const r = rand(s);
  if (r < BEG.pennyChance) {
    s.wealth.pence += 1;
    deed(s, DEED.beggar, `${peasant(s).name} ${s.familyName} begs at the church door.`);
    return 'begs at the church door: a penny';
  }
  if (r < BEG.breadChance) {
    s.wealth.bread += BEG.bread;
    return 'begs at the church door: a crust or two';
  }
  return 'begs at the church door: nothing';
}

function outlawed(s: SimState, why: string): void {
  s.station.outlaw = true;
  s.station.residence = 'camp';
  s.station.beggar = false;
  if (!s.obligations.evicted) loseLand(s, 'The holding is forfeit.');
  s.location = 'camp';
  log(s, 'rank', `OUTLAWED for ${why}. Any man may take you. The family goes with you into the greenwood.`);
  note(s, `Outlawed for ${why}.`);
}

/** Returns true if the doer was taken (an outlaw taken is hanged: the caller buries them). */
function caught(s: SimState, why: string): 'free' | 'fined' | 'outlawed' | 'hanged' {
  if (s.station.outlaw) return 'hanged';
  if (!s.obligations.evicted) {
    s.obligations.debt += 12;
    deed(s, DEED.poacher, `${peasant(s).name} ${s.familyName} was taken ${why}.`);
    log(s, 'court', `Taken ${why} by the lord's forester. 12d amercement.`);
    return 'fined';
  }
  outlawed(s, why);
  return 'outlawed';
}

export interface CrimeResult {
  text: string;
  hanged: boolean;
}

export function poach(s: SimState): CrimeResult {
  if (rand(s) < POACH.caughtChance * s.lordGrip) {
    const c = caught(s, 'poaching the lord\'s deer');
    return { text: 'is taken poaching', hanged: c === 'hanged' };
  }
  s.wealth.meat += POACH.meat;
  return { text: 'snares a deer in the lord\'s chase', hanged: false };
}

export function rob(s: SimState): CrimeResult {
  if (rand(s) < ROB.caughtChance * s.lordGrip) {
    const c = caught(s, 'robbing on the highway');
    return { text: 'is taken on the highway', hanged: c === 'hanged' };
  }
  const d = ROB.minPence + Math.floor(rand(s) * (ROB.maxPence - ROB.minPence + 1));
  s.wealth.pence += d;
  deed(s, DEED.robber, 'A carter was robbed on the Ashby road.', []);
  return { text: `robs a traveller of ${d}d`, hanged: false };
}

export function surrender(s: SimState): string {
  s.station.outlaw = false;
  s.station.residence = 'village';
  s.obligations.debt += SURRENDER_FINE;
  log(s, 'rank', `You kneel before the steward. Inlawed again, at a price of ${SURRENDER_FINE}d, owed.`);
  return 'gives up the greenwood';
}

/** Flight to the chartered town: the holding is abandoned. A year and a day uncaught makes you free. */
export function flee(s: SimState): string {
  if (!s.obligations.evicted) loseLand(s, 'The holding is abandoned. The lord will want you back.');
  s.station.fledDay = today(s);
  s.station.residence = 'town';
  s.station.outlaw = false;
  s.station.beggar = false;
  s.standing.lord = clamp(s.standing.lord - 30);
  note(s, `Fled to the town, ${Math.floor(today(s) / 365) + 1345}.`);
  return 'flees by night to the town';
}

/* ───────────── daily ───────────── */

/** Daily: debt seizures, eviction for unpayable debt, the labourer's slide into beggary, flight and capture. */
export function dailyStation(s: SimState, info: DayInfo): void {
  const o = s.obligations;
  const st = s.station;
  const w = s.wealth;
  const day = info.dayIndex;
  if (o.debt > DEBT.seizeAt && !o.evicted) {
    const beast = (['ox', 'cow', 'pig'] as const).find((b) => w[b] > 0) ?? (w.hens > 0 ? 'hens' : null);
    if (beast) {
      const n = beast === 'hens' ? w.hens : 1;
      w[beast] -= n;
      o.debt = Math.max(0, o.debt - BEAST_VALUE[beast] * n);
      log(s, 'rank', `For the debt, the steward's men take ${beast === 'hens' ? 'the hens' : `the ${beast}`}.`);
    } else if (o.debt > DEBT.evictAt) {
      evict(s);
    }
  }
  if (o.evicted && !st.outlaw && st.fledDay === null) {
    const foodless = w.grain < 0.5 && w.bread < 1 && w.pottage < 1 && w.meat < 1 && w.eggs < 2;
    st.hungryDays = foodless && w.pence < PRICES.grainBuy ? st.hungryDays + 1 : 0;
    if (!st.beggar && st.hungryDays >= BEGGAR_AFTER_DAYS) {
      st.beggar = true;
      log(s, 'rank', 'No work, no bread, no roof of your own. You go to the church door with your hand out.');
      note(s, 'Fell to begging.');
    } else if (st.beggar && w.pence >= PRICES.grainBuy * 2) {
      st.beggar = false;
      log(s, 'rank', 'A little silver in hand. You are a labourer again, not a beggar.');
    }
  }
  if (st.fledDay !== null) {
    if (day - st.fledDay >= FLIGHT.daysToFree) {
      st.fledDay = null;
      st.free = true;
      st.craft = true;
      log(s, 'rank', 'A year and a day in the town, uncaught. Town air makes free. You are your own master now: a craftsman.');
      note(s, 'Free by a year and a day in the town; took up a craft.');
    } else if (rand(s) < FLIGHT.captureDaily * s.lordGrip) {
      st.fledDay = null;
      st.residence = 'village';
      s.location = 'home';
      o.debt += FLIGHT.capturedFine;
      s.standing.lord = clamp(s.standing.lord + FLIGHT.capturedLord);
      log(s, 'rank', 'The lord\'s men find you in the town and drag the family home in a cart. Landless now, and watched.');
      note(s, 'Taken in the town and brought back.');
    }
  }
  if (st.outlaw && rand(s) < OUTLAW_TAKEN_DAILY * s.lordGrip) {
    log(s, 'rank', 'The sheriff\'s men come through the greenwood with dogs.');
    s.doom = 'hanged at the crossroads';
  }
}

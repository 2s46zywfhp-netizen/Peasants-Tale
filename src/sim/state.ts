import {
  BODY_START, DAYS_PER_YEAR, SOUL_START, STANDING_START, START_AGES, WEALTH_START, type ActionId, type Crop, type IllnessKind, type Location,
  type TagId,
} from './balance';
import type { BlockName } from './calendar';
import { mulberry32Next } from './rng';

export interface Illness {
  kind: IllnessKind;
  daysLeft: number;
}

export interface Body {
  hunger: number;
  reserve: number;
  fatigue: number;
  warmth: number;
  filth: number;
  health: number;
  illness: Illness | null;
  /** Days left until an injury heals; 0 = not injured. */
  injuredDays: number;
}

export type Sex = 'm' | 'f';
export type MemberRole = 'peasant' | 'spouse' | 'child' | 'parent';

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  sex: Sex;
  /** Day index of birth (negative: before Lady Day 1345). */
  bornDay: number;
  alive: boolean;
  body: Body;
}

export type VillagerRole = 'priest' | 'reeve' | 'steward' | 'miller' | 'brewster' | 'smith' | 'neighbour' | 'shepherd' | 'beggar';

export interface Memory {
  day: number;
  text: string;
  delta: number;
}

export interface Villager {
  id: string;
  name: string;
  role: VillagerRole;
  sex: Sex;
  bornDay: number;
  alive: boolean;
  /** Left the village (married into the household, driven out, fled). */
  gone: boolean;
  married: boolean;
  /** Opinion of the player's family, -100..100. */
  opinion: number;
  /** Opinion of every other villager by index (own index unused). */
  ties: number[];
  memory: Memory[];
  /** Favours: > 0 they owe the family, < 0 the family owes them. */
  owes: number;
  /** Courtship points with the head of the household. */
  courtship: number;
}

export interface Rumour {
  /** -1 = the player's family, else a villager index. */
  about: number;
  delta: number;
  text: string;
  day: number;
  /** Bitmask of villager indices who have heard it. */
  knownBy: number;
  /** The player has heard it (rumours about villagers). */
  heard: boolean;
}

export interface Station {
  free: boolean;
  craft: boolean;
  /** Day the reeve's term ends; 0 = not reeve. */
  reeveUntil: number;
  outlaw: boolean;
  beggar: boolean;
  /** Consecutive days a landless labourer has gone without food or pence. */
  hungryDays: number;
  /** Day the family fled to the town; null = not in flight. */
  fledDay: number | null;
  residence: 'village' | 'town' | 'camp';
}

export interface ChronicleEntry {
  generation: number;
  name: string;
  bornYear: number;
  diedYear: number | null;
  cause: string;
  rank: string;
  notes: string[];
}

export type PlaguePhase = 'none' | 'omens' | 'outbreak' | 'aftermath' | 'over';

export interface Soul {
  morale: number;
  privatePiety: number;
  publicPiety: number;
}

export interface Standing {
  lord: number;
  priest: number;
  village: number;
}

export interface Tag {
  id: TagId;
  untilDay: number;
}

export interface Wealth {
  pence: number;
  grain: number;
  bread: number;
  pottage: number;
  meat: number;
  eggs: number;
  ale: number;
  firewood: number;
  hens: number;
  pig: number;
  cow: number;
  ox: number;
  /** Tool condition 0-100. */
  tools: number;
  acres: number;
}

export type FieldKind = 'winter' | 'spring' | 'fallow';
export type FieldStage = 'fallow' | 'unsown' | 'growing' | 'ripe' | 'harvested';

export interface Field {
  id: string;
  kind: FieldKind;
  crop: Crop | null;
  acres: number;
  stage: FieldStage;
  sowLabour: number;
  /** Share of the field actually seeded (short of seed grain = partly sown). */
  sownShare: number;
  careLabour: number;
  harvestLabour: number;
  /** Sum of daily weather quality while growing, and days counted. */
  weatherSum: number;
  weatherDays: number;
  /** Bushels expected at harvest, rolled when the crop ripens. */
  expectedYield: number;
  harvested: number;
}

export interface Obligations {
  strikes: number;
  lastStrikeDay: number;
  manorCourtDay: number | null;
  manorCourtHeld: boolean;
  evicted: boolean;
  /** Pence owed to the lord (unpaid rent or fines). */
  debt: number;
  /** Week-work blocks credited today. */
  weekWorkToday: number;
  boonMealToday: boolean;
  massToday: boolean;
  missedMasses: number[];
  churchCourtDay: number | null;
  penanceSundaysLeft: number;
}

export type LogType =
  | 'auto' | 'action' | 'meal' | 'body' | 'illness' | 'death' | 'farm' | 'manor' | 'church' | 'feast'
  | 'event' | 'trade' | 'neglect' | 'weather' | 'debug' | 'village' | 'family' | 'court' | 'dark' | 'plague' | 'rank';

export interface LogEntry {
  day: number;
  date: string;
  block: BlockName;
  type: LogType;
  actors: string[];
  text: string;
  /** For meals and actions (the player's or the autopilot's): which action. */
  action?: ActionId;
}

export interface Plan {
  action: ActionId;
  param: string | null;
  /** First block of the plan and first block after it. */
  from: number;
  until: number;
  byPlayer: boolean;
}

export interface Counters {
  tavernThisWeek: number;
  socialThisWeek: number;
  /** Last block the player chose an action. */
  lastPlayerBlock: number;
  /** Presentments gathered for the next hallmote. */
  brawls: number;
  aleSold: number;
  strikesSince: number;
}

export interface SimState {
  version: 3;
  seed: number;
  rng: number;
  /** Real ms at which block 0 began (shifted forward when catch-up is capped). */
  anchorMs: number;
  /** Real ms of the last advance that simulated anything. Time before this is never re-simulated. */
  lastSimMs: number;
  /** Blocks resolved so far = index of the current, unresolved block. */
  block: number;
  /**
   * How much the player may still hasten chosen tasks (real ms the life may jump ahead), and when that was
   * last worked out. It refills with real time, so the life runs at most HASTE_REFILL x faster than the clock
   * over any long stretch. Missing in older saves: full.
   */
  haste?: { budgetMs: number; atMs: number };
  location: Location;
  members: Member[];
  soul: Soul;
  standing: Standing;
  tags: Tag[];
  wealth: Wealth;
  fields: Field[];
  obligations: Obligations;
  /** Habit weights per slot (weekday*6 + blockOfDay) and action; meal habit weights per slot. */
  habits: { actions: Partial<Record<ActionId, number>>[]; meals: number[] };
  plan: Plan | null;
  /** Instant meals already taken in the current block. */
  ateThisBlock: boolean;
  counters: Counters;
  neglect: boolean;
  /** The line has ended: no heir. */
  dead: boolean;
  log: LogEntry[];
  familyName: string;
  generation: number;
  village: Villager[];
  rumours: Rumour[];
  station: Station;
  family: { pregnantSince: number | null; nextId: number };
  dark: { faeFavour: number; faeDebt: number };
  /** The pestilence, and vacant holdings in the village (one lies empty from the start). */
  plague: { phase: PlaguePhase; dead: number; vacant: number };
  /** Lord tightening control after the pestilence (multiplies fines and capture odds). */
  lordGrip: number;
  /** Wages multiplier: labour is dear after the pestilence. */
  wageMult: number;
  /** Harvest got / expected for the last finished harvest (1 = as hoped). */
  lastHarvest: number;
  hallmote: { nextDay: number; reeve: string; electedYear: number };
  chronicle: ChronicleEntry[];
  /** A violent death decided mid-block (the gallows), carried out when the block ends. */
  doom: string | null;
}

export const MALE_NAMES = ['WAT', 'HOB', 'JACK', 'WILL', 'ROB', 'TOM', 'GIB', 'HUW', 'RAFE', 'NED', 'DICK', 'HAL'];
export const FEMALE_NAMES = ['AGNES', 'MAUD', 'ALICE', 'JOAN', 'EMMA', 'CIS', 'NELL', 'MARGERY', 'ROSE', 'KATE', 'BEATRICE', 'AMICE'];
export const FAMILY_NAMES = ['ATTE WOOD', 'BROOK', 'FIELDER', 'CROFT', 'HAYNE', 'MILLWARD', 'STOCKER', 'ASHBY'];

export interface LifeOptions {
  name?: string;
  familyName?: string;
}

export function newBody(): Body {
  return { ...BODY_START, illness: null, injuredDays: 0 };
}

function field(id: string, kind: FieldKind, crop: Crop | null, acres: number, stage: FieldStage): Field {
  return {
    id, kind, crop, acres, stage, sowLabour: 0, sownShare: stage === 'growing' ? 1 : 0, careLabour: 0, harvestLabour: 0, weatherSum: 0, weatherDays: 0, expectedYield: 0, harvested: 0,
  };
}

const pick = <T>(xs: readonly T[], r: number): T => xs[Math.floor(r * xs.length)]!;

export function member(id: string, name: string, role: MemberRole, sex: Sex, bornDay: number): Member {
  return { id, name, role, sex, bornDay, alive: true, body: newBody() };
}

/** A fresh life beginning at dawn on Lady Day 1345. The village is filled in by createLife. */
export function createState(seed: number, nowMs: number, opts: LifeOptions = {}): SimState {
  seed >>>= 0;
  const r1 = mulberry32Next(seed);
  const r2 = mulberry32Next(r1.state);
  const r3 = mulberry32Next(r2.state);
  const r4 = mulberry32Next(r3.state);
  const third = Math.floor(WEALTH_START.acres / 3);
  const Y = DAYS_PER_YEAR;
  return {
    version: 3,
    seed,
    rng: r4.state,
    anchorMs: nowMs,
    lastSimMs: nowMs,
    block: 0,
    location: 'home',
    members: [
      member('peasant', opts.name || pick(MALE_NAMES, r1.value), 'peasant', 'm', -START_AGES.peasant * Y - 100),
      member('spouse', pick(FEMALE_NAMES, r2.value), 'spouse', 'f', -START_AGES.spouse * Y - 40),
      member('child1', pick(MALE_NAMES, r3.value), 'child', 'm', -START_AGES.child * Y - 200),
    ],
    soul: { ...SOUL_START },
    standing: { ...STANDING_START },
    tags: [],
    wealth: { ...WEALTH_START },
    fields: [
      // The winter field was sown last autumn; the spring field awaits its seed; the third lies fallow.
      field('north', 'winter', 'wheat', third, 'growing'),
      field('east', 'spring', 'barley', third, 'unsown'),
      field('south', 'fallow', null, WEALTH_START.acres - 2 * third, 'fallow'),
    ],
    obligations: {
      strikes: 0, lastStrikeDay: 0, manorCourtDay: null, manorCourtHeld: false, evicted: false, debt: 0,
      weekWorkToday: 0, boonMealToday: false, massToday: false, missedMasses: [], churchCourtDay: null, penanceSundaysLeft: 0,
    },
    habits: { actions: Array.from({ length: 42 }, () => ({})), meals: Array.from({ length: 42 }, () => 0) },
    plan: null,
    ateThisBlock: false,
    counters: { tavernThisWeek: 0, socialThisWeek: 0, lastPlayerBlock: -1, brawls: 0, aleSold: 0, strikesSince: 0 },
    neglect: false,
    dead: false,
    log: [],
    familyName: opts.familyName || pick(FAMILY_NAMES, r4.value),
    generation: 1,
    village: [],
    rumours: [],
    station: { free: false, craft: false, reeveUntil: 0, outlaw: false, beggar: false, hungryDays: 0, fledDay: null, residence: 'village' },
    family: { pregnantSince: null, nextId: 2 },
    dark: { faeFavour: 0, faeDebt: 0 },
    plague: { phase: 'none', dead: 0, vacant: 1 },
    lordGrip: 1,
    wageMult: 1,
    lastHarvest: 1,
    hallmote: { nextDay: 14, reeve: 'reeve', electedYear: 1344 },
    chronicle: [],
    doom: null,
  };
}

export function peasant(s: SimState): Member {
  return s.members[0]!;
}

/** Age in whole years on day `day`. */
export function ageOf(bornDay: number, day: number): number {
  return Math.floor((day - bornDay) / DAYS_PER_YEAR);
}

export const today = (s: SimState): number => Math.floor(s.block / 6);

/** Draw from the state's own PRNG stream (mutates s.rng). */
export function rand(s: SimState): number {
  const r = mulberry32Next(s.rng);
  s.rng = r.state;
  return r.value;
}

export const clamp = (v: number, lo = 0, hi = 100): number => (v < lo ? lo : v > hi ? hi : v);

export function hasTag(s: SimState, id: TagId): boolean {
  return s.tags.some((t) => t.id === id);
}

export function addTag(s: SimState, id: TagId, untilDay: number): void {
  const t = s.tags.find((x) => x.id === id);
  if (t) t.untilDay = Math.max(t.untilDay, untilDay);
  else s.tags.push({ id, untilDay });
}

export function removeTag(s: SimState, id: TagId): void {
  s.tags = s.tags.filter((t) => t.id !== id);
}

/** Stable JSON (sorted keys) for hashing. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** cyrb53 over the stable serialisation; 53-bit hex. */
export function stateHash(s: SimState): string {
  const str = stable(s);
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

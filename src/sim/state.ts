import {
  BODY_START, SOUL_START, STANDING_START, WEALTH_START, type ActionId, type Crop, type IllnessKind, type Location, type TagId,
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

export interface Member {
  id: string;
  name: string;
  role: 'peasant' | 'spouse';
  alive: boolean;
  body: Body;
}

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
  | 'event' | 'trade' | 'neglect' | 'weather' | 'debug';

export interface LogEntry {
  day: number;
  date: string;
  block: BlockName;
  type: LogType;
  actors: string[];
  text: string;
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
}

export interface SimState {
  version: 2;
  seed: number;
  rng: number;
  /** Real ms at which block 0 began (shifted forward when catch-up is capped). */
  anchorMs: number;
  /** Real ms of the last advance that simulated anything. Time before this is never re-simulated. */
  lastSimMs: number;
  /** Blocks resolved so far = index of the current, unresolved block. */
  block: number;
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
  dead: boolean;
  log: LogEntry[];
}

const PEASANT_NAMES = ['WAT', 'HOB', 'JACK', 'WILL', 'ROB', 'TOM', 'GIB', 'HUW'];
const SPOUSE_NAMES = ['AGNES', 'MAUD', 'ALICE', 'JOAN', 'EMMA', 'CIS', 'NELL', 'MARGERY'];

export function newBody(): Body {
  return { ...BODY_START, illness: null, injuredDays: 0 };
}

function field(id: string, kind: FieldKind, crop: Crop | null, acres: number, stage: FieldStage): Field {
  return {
    id, kind, crop, acres, stage, sowLabour: 0, sownShare: stage === 'growing' ? 1 : 0, careLabour: 0, harvestLabour: 0, weatherSum: 0, weatherDays: 0, expectedYield: 0, harvested: 0,
  };
}

/** A fresh life beginning at dawn on Lady Day 1345. */
export function createState(seed: number, nowMs: number): SimState {
  seed >>>= 0;
  const r1 = mulberry32Next(seed);
  const r2 = mulberry32Next(r1.state);
  const third = Math.floor(WEALTH_START.acres / 3);
  return {
    version: 2,
    seed,
    rng: r2.state,
    anchorMs: nowMs,
    lastSimMs: nowMs,
    block: 0,
    location: 'home',
    members: [
      { id: 'peasant', name: PEASANT_NAMES[Math.floor(r1.value * PEASANT_NAMES.length)]!, role: 'peasant', alive: true, body: newBody() },
      { id: 'spouse', name: SPOUSE_NAMES[Math.floor(r2.value * SPOUSE_NAMES.length)]!, role: 'spouse', alive: true, body: newBody() },
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
    counters: { tavernThisWeek: 0, socialThisWeek: 0, lastPlayerBlock: -1 },
    neglect: false,
    dead: false,
    log: [],
  };
}

export function peasant(s: SimState): Member {
  return s.members[0]!;
}

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

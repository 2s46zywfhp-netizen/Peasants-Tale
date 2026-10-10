// Every tunable number in the game lives here.

/* ───────────────────────── Time ───────────────────────── */

export const REAL_DAY_MS = 86_400_000;
/** 1 real day = 1 game week. */
export const GAME_DAYS_PER_REAL_DAY = 7;
/** dawn, morning, midday, afternoon, dusk, night. */
export const BLOCKS_PER_DAY = 6;
export const BLOCKS_PER_REAL_DAY = GAME_DAYS_PER_REAL_DAY * BLOCKS_PER_DAY; // 42
/** ≈ 34m17s real. */
export const BLOCK_MS = REAL_DAY_MS / BLOCKS_PER_REAL_DAY;
/** Catch-up cap: 30 real days of blocks. Anything beyond is dropped and the peasant is marked neglected. */
export const CATCHUP_CAP_REAL_DAYS = 30;
export const CATCHUP_CAP_BLOCKS = CATCHUP_CAP_REAL_DAYS * BLOCKS_PER_REAL_DAY;

/** Calendar origin: Lady Day 1345 (Julian), at dawn. */
export const START_YEAR = 1345;
export const START_MONTH = 3;
export const START_DAY = 25;

/** Mean synodic month and a reference new moon (JDN of 6 Jan 2000 18:14 UT). */
export const SYNODIC_MONTH_DAYS = 29.530588853;
export const NEW_MOON_REF_JDN = 2451550.26;

export const LOG_MAX_ENTRIES = 3000;

/** Years of the pestilence in England (the Black Death and its returns): the world takes on a sickly tint. */
export const PLAGUE_YEARS: readonly number[] = [1348, 1349, 1361, 1362, 1369];

/* ───────────────────────── Body ───────────────────────── */

export type Activity = 'sleep' | 'rest' | 'light' | 'work' | 'heavy';

export const BODY_START = { hunger: 10, reserve: 62, fatigue: 20, warmth: 60, filth: 20, health: 100 } as const;

/** Hunger gained per block by activity; cold adds HUNGER_COLD_EXTRA. */
export const HUNGER_RISE: Readonly<Record<Activity, number>> = { sleep: 3, rest: 6, light: 8, work: 13, heavy: 15 };
export const HUNGER_COLD_EXTRA = 3;

/** Hunger removed per serving. */
export const MEAL_VALUE = { pottage: 30, bread: 28, meat: 40, eggs: 14, grain: 25, boon: 45 } as const;
export type Food = 'pottage' | 'bread' | 'meat' | 'eggs' | 'grain';
/** Units of each store one serving uses (eggs per serving, bushels of raw grain per serving). */
export const SERVING_COST: Readonly<Record<Food, number>> = { pottage: 1, bread: 1, meat: 1, eggs: 2, grain: 0.05 };

/** Reserve: burns at or above STARVING, rebuilds below SATED. */
export const HUNGER_STARVING = 40;
export const HUNGER_SATED = 30;
export const RESERVE_BURN_BASE = 0.1;
export const RESERVE_BURN_PER_POINT = 0.02;
export const RESERVE_REBUILD = 0.004;
/** Below PIVOT an emaciated body rebuilds faster: rate * (1 + (PIVOT - reserve) / 4). From 60 it slows to nothing at CEILING. */
export const RESERVE_REBUILD_PIVOT = 40;
export const RESERVE_REBUILD_CEILING = 85;
/** Lower bounds of the visible tiers. */
export const RESERVE_TIERS = { stout: 80, healthy: 55, thin: 35, gaunt: 15 } as const;

export const FATIGUE_DELTA: Readonly<Record<Activity, number>> = { sleep: -20, rest: -12, light: 5, work: 12, heavy: 15 };
/** Extra fatigue recovery when sleeping in the night block. */
export const NIGHT_SLEEP_BONUS = -20;
export const OVERWORK_FATIGUE = 75;
export const INJURY_BASE_CHANCE = 0.02;
export const INJURY_CHANCE_PER_POINT = 0.006;
export const INJURY_HEALTH_HIT = 8;
export const INJURY_DAYS = 6;

/** Warmth target = temp*PER_C + clothing (+ shelter + fire at home) (+ work); moves toward target by RATE. */
export const WARMTH_PER_C = 2;
export const WARMTH_CLOTHING = 20;
export const WARMTH_SHELTER = 15;
export const WARMTH_FIRE = 25;
export const WARMTH_WORKING = 5;
export const WARMTH_RATE = 0.5;
export const WARMTH_COLD = 30;
export const FIRE_BELOW_C = 12;
export const FIREWOOD_PER_HOME_BLOCK = 0.25;

export const FILTH_PER_BLOCK = 1.5;
export const FILTH_WORK_EXTRA = 1;

export const HEALTH_REGEN_WELL = 4;
export const HEALTH_REGEN_POOR = 0.5;
export const STARVATION_HEALTH_LOSS = 3;

/** Daily illness chance = BASE * (1 + risk factors). */
export const ILLNESS_BASE_CHANCE = 0.003;
export const ILLNESS = {
  ague: { drain: 2, minDays: 6, maxDays: 12 },
  flux: { drain: 4, minDays: 4, maxDays: 8 },
  fever: { drain: 5, minDays: 3, maxDays: 7 },
  infectedInjury: { drain: 3, minDays: 7, maxDays: 14 },
} as const;
export type IllnessKind = keyof typeof ILLNESS;
export const INFECTION_BASE_CHANCE = 0.05;

/* ───────────────────────── Soul & standing ───────────────────────── */

export const SOUL_START = { morale: 55, privatePiety: 40, publicPiety: 40 } as const;
export const STANDING_START = { lord: 50, priest: 50, village: 50 } as const;
export const MORALE_DRIFT = 0.02;
/** Daily pull of lord/priest/village standing back toward 50. */
export const STANDING_DRIFT = 0.01;
export const MORALE_HUNGRY_BLOCK = -1;
export const MORALE_ILL_BLOCK = -0.5;
export const MORALE_COLD_BLOCK = -0.5;
export const PIETY_DAILY_DECAY = { privatePiety: 0.3, publicPiety: 0.45 } as const;
export const VICE_MORALE = 30;

export const TAG_DAYS = { heathen: 56, drunkard: 28, goodNeighbour: 28, debtor: 84, suspect: 28, penitent: 28 } as const;
export type TagId = keyof typeof TAG_DAYS;
export const DRUNKARD_TAVERN_PER_WEEK = 4;
export const GOOD_NEIGHBOUR_SOCIAL_PER_WEEK = 3;

/* ───────────────────────── Wealth & farm ───────────────────────── */

export const WEALTH_START = {
  pence: 24, grain: 50, bread: 6, pottage: 6, meat: 4, eggs: 0, ale: 4, firewood: 6,
  hens: 4, pig: 1, cow: 0, ox: 0, tools: 70, acres: 15,
} as const;

export type Crop = 'wheat' | 'rye' | 'barley' | 'oats' | 'peas';
/** Gross bushels per acre before weather/labour/manure. */
export const YIELD_PER_ACRE: Readonly<Record<Crop, number>> = { wheat: 10, rye: 11, barley: 13, oats: 11, peas: 9 };
export const SEED_PER_ACRE = 2;
export const SOW_LABOUR_PER_ACRE = 1.2;
export const CARE_LABOUR_PER_ACRE = 0.6;
export const HARVEST_LABOUR_PER_ACRE = 2;
export const TOOL_WEAR_PER_BLOCK = 0.05;
export const OX_LABOUR_BONUS = 1.3;
export const MANURE_PER_ANIMAL = { hens: 0.03, pig: 0.08, cow: 0.12, ox: 0.12 } as const;
export const YIELD_NOISE = 0.15;
/** Share of an unharvested crop lost when its window closes. */
export const UNHARVESTED_LOSS = 0.7;
/** Sowing and harvest windows as [month, day] (Julian). */
export const WINTER_SOW = { from: [10, 1], to: [11, 30] } as const;
export const SPRING_SOW = { from: [3, 1], to: [4, 30] } as const;
export const WINTER_RIPE: readonly [number, number] = [8, 1];
export const SPRING_RIPE: readonly [number, number] = [8, 15];
export const HARVEST_END: readonly [number, number] = [9, 30];
export const TITHE_RATE = 0.1;
export const TITHE_PUBLIC_PIETY = 4;
export const EGGS_PER_HEN_PER_DAY = 0.5;
export const MARTINMAS_PORK = 30;

/** Share of cooked food lost each day (pottage sours, bread goes hard and mouldy). */
export const FOOD_SPOIL_PER_DAY = { pottage: 0.05, bread: 0.015, eggs: 0.05 } as const;
/** The absent peasant won't cook while this many ready servings are in the house. */
export const ENOUGH_COOKED = 20;
/** ...and makes cooking a priority below this many. */
export const LOW_COOKED = 12;
export const COOK_GRAIN = 1;
export const COOK_YIELD = { bread: 14, pottage: 14 } as const;
export const BREW_GRAIN = 1;
export const BREW_YIELD = 8;
export const PRICES = { grainSell: 5, grainBuy: 7, eggsPerPenny: 6, firewoodBuy: 1, alePerPenny: 2 } as const;

/* ───────────────────────── Obligations ───────────────────────── */

/** Weekdays (0 = Sunday) owed to the lord. */
export const WEEK_WORK_DAYS: readonly number[] = [1, 2, 4];
export const WEEK_WORK_MIN_BLOCKS = 2;
/** Boon days: Wednesdays inside these windows. */
export const BOON_WINDOWS = [
  { name: 'harvest', from: [8, 1], to: [8, 21] },
  { name: 'ploughing', from: [10, 1], to: [10, 14] },
] as const;
export const BOON_WEEKDAY = 3;
export const RENT_PENCE = 36;
export const FINE_PENCE = 6;
export const MANOR_COURT_FINE = 12;
export const COURT_DELAY_DAYS = 7;
export const STRIKE_FORGIVE_DAYS = 56;
export const LORD_HIT = { late: -1, fine: -5, suspect: -8, court: -10, rentPaid: 2, boon: 2 } as const;

export const MASS_MISS = { priest: -5, publicPiety: -5 } as const;
export const MASS_WINDOW_DAYS = 56;
export const MASS_MISSES_FOR_COURT = 3;
export const PENANCE = { morale: -20, village: -10, priest: -5, sundays: 3, restorePriest: 6, restoreVillage: 5 } as const;
export const MEAT_SEEN_CHANCE = 0.25;
export const MEAT_SEEN = { priest: -8, publicPiety: -6 } as const;

/* ───────────────────────── Events & weather ───────────────────────── */

export const EVENT_DAILY_CHANCE = 0.04;
/** Share of the grain store spoiled by damp. */
export const DAMP_LOSS = 0.05;
export const HEATHEN_EVENT_MULT = 2;
export const NEGLECT = { morale: -20, village: -5 } as const;

/** Mean daily temperature (°C) = MEAN + AMPLITUDE*sin(2π(doy - PHASE)/365) + noise. */
export const WEATHER = { meanC: 9, amplitudeC: 8, phaseDays: 105, noiseC: 4 } as const;
/** Chance of rain per season; storms are a share of rain days. */
export const RAIN_CHANCE = { winter: 0.5, spring: 0.35, summer: 0.25, autumn: 0.45 } as const;
export const STORM_SHARE = 0.15;
export const FOG_CHANCE = 0.12;

/* ───────────────────────── Habits autopilot ───────────────────────── */

export const HABIT_SLOT_DECAY = 0.7;
export const HABIT_WEEKLY_DECAY = 0.97;
export const HABIT_WEIGHT = 2;
export const HABIT_DEFAULT_WEIGHT = 1.5;
export const AUTOPILOT_NOISE = 0.5;
export const AUTO_EAT_HUNGER = 28;
export const AUTO_EAT_HABIT_HUNGER = 18;
export const VICE_LATENESS_HUNGER = 15;
export const URGENT_HUNGER = 60;
/** The absent peasant buys grain when the store falls below this. */
export const LOW_GRAIN = 5;
/** ...and sells grain to raise the rent when the store is above this and the purse is short. */
export const SURPLUS_GRAIN = 30;

/* ───────────────────────── UI (non-sim) ───────────────────────── */

/** Held D-pad directions: delay before the first repeat, then interval between repeats (ms). */
export const INPUT_REPEAT_DELAY_MS = 280;
export const INPUT_REPEAT_INTERVAL_MS = 90;
/** navigator.vibrate pulse length for a button press (ms). */
export const HAPTIC_TICK_MS = 8;
/** Full scene transition duration (fade out + fade in), ms. */
export const FADE_MS = 400;
/** Typewriter text speeds, characters per second. */
export const TEXT_SPEED_CPS = { slow: 18, normal: 40, fast: 120 } as const;
export const TITLE_BLINK_MS = 530;
export const CANDLE_FLICKER_MS = 70;
/** Placeholder village: peasant walk step in screen pixels. */
export const WALK_STEP_PX = 2;
/** Hold SELECT + START this long to open the debug panel. */
export const DEBUG_HOLD_MS = 2000;

/* ───────────────────────── Actions ───────────────────────── */

export type Location = 'home' | 'strips' | 'demesne' | 'church' | 'tavern' | 'woods' | 'stream' | 'green';
export type ActionId =
  | 'eat' | 'cook' | 'brew' | 'sleep' | 'workStrips' | 'weekWork' | 'attendMass' | 'pray' | 'confess'
  | 'tavern' | 'gatherFirewood' | 'wash' | 'socialise' | 'trade' | 'rest';

/** Plain numeric effects applied once per block the action runs (household stores, soul, standing, actor body). */
export interface Effects {
  fatigue?: number; filth?: number; warmth?: number; hunger?: number;
  morale?: number; privatePiety?: number; publicPiety?: number;
  lord?: number; priest?: number; village?: number;
  pence?: number; firewood?: number; ale?: number;
}

export interface ActionDef {
  label: string;
  /** Blocks the action occupies; 0 = instant. */
  duration: number;
  location: Location | 'any';
  /** Block-of-day indices at which the action may be started. */
  blocks: readonly number[];
  days: 'any' | 'sunday' | 'weekWork';
  activity: Activity;
  effects: Effects;
}

const ALL = [0, 1, 2, 3, 4, 5] as const;
const DAYTIME = [0, 1, 2, 3, 4] as const;

export const ACTIONS: Readonly<Record<ActionId, ActionDef>> = {
  eat: { label: 'EAT', duration: 0, location: 'any', blocks: ALL, days: 'any', activity: 'rest', effects: {} },
  cook: { label: 'COOK', duration: 1, location: 'home', blocks: DAYTIME, days: 'any', activity: 'light', effects: { firewood: -1, morale: 1 } },
  brew: { label: 'BREW', duration: 1, location: 'home', blocks: DAYTIME, days: 'any', activity: 'light', effects: { firewood: -1 } },
  sleep: { label: 'SLEEP', duration: 1, location: 'home', blocks: ALL, days: 'any', activity: 'sleep', effects: {} },
  workStrips: { label: 'WORK STRIPS', duration: 1, location: 'strips', blocks: DAYTIME, days: 'any', activity: 'work', effects: { filth: 1 } },
  weekWork: { label: 'WEEK-WORK', duration: 3, location: 'demesne', blocks: [1, 2], days: 'weekWork', activity: 'heavy', effects: { filth: 1 } },
  attendMass: { label: 'ATTEND MASS', duration: 1, location: 'church', blocks: [1], days: 'sunday', activity: 'rest', effects: { publicPiety: 3, priest: 1, morale: 2 } },
  pray: { label: 'PRAY', duration: 1, location: 'church', blocks: ALL, days: 'any', activity: 'rest', effects: { privatePiety: 2.5, morale: 1 } },
  confess: { label: 'CONFESS', duration: 1, location: 'church', blocks: [1, 2, 3], days: 'any', activity: 'rest', effects: { privatePiety: 12, priest: 2, morale: 2 } },
  tavern: { label: 'TAVERN', duration: 1, location: 'tavern', blocks: [3, 4, 5], days: 'any', activity: 'rest', effects: { pence: -1, morale: 8, village: 1, fatigue: 3, hunger: -5 } },
  gatherFirewood: { label: 'GATHER WOOD', duration: 1, location: 'woods', blocks: DAYTIME, days: 'any', activity: 'work', effects: { firewood: 3, filth: 1 } },
  wash: { label: 'WASH', duration: 1, location: 'stream', blocks: DAYTIME, days: 'any', activity: 'light', effects: { filth: -60, warmth: -10, morale: 1 } },
  socialise: { label: 'SOCIALISE', duration: 1, location: 'green', blocks: [1, 2, 3, 4, 5], days: 'any', activity: 'rest', effects: { village: 1, morale: 3 } },
  trade: { label: 'TRADE', duration: 1, location: 'green', blocks: [1, 2, 3], days: 'any', activity: 'light', effects: {} },
  rest: { label: 'REST', duration: 1, location: 'home', blocks: ALL, days: 'any', activity: 'rest', effects: { morale: 0.5 } },
};

export type TradeKind = 'sellGrain' | 'buyGrain' | 'sellEggs' | 'buyFirewood' | 'sellAle';

/** The routine a fresh peasant starts with, per block of day (weekday overrides below). */
export const DEFAULT_ROUTINE: readonly ActionId[] = ['rest', 'workStrips', 'workStrips', 'workStrips', 'rest', 'sleep'];
export const DEFAULT_SUNDAY: readonly ActionId[] = ['pray', 'attendMass', 'rest', 'socialise', 'rest', 'sleep'];
export const DEFAULT_WEEK_WORK_DAY: readonly ActionId[] = ['rest', 'weekWork', 'weekWork', 'weekWork', 'rest', 'sleep'];
/** Habitual meal blocks for a fresh peasant: dinner at midday, supper at dusk. */
export const DEFAULT_MEAL_BLOCKS: readonly number[] = [2, 4];

/** Morale on feast days (applied at dawn). */
export const FEAST_MORALE = {
  ladyDay: 1, ashWednesday: -2, lent: 0, goodFriday: -3, easter: 6, ploughMonday: 3, mayDay: 4, midsummer: 4,
  lammas: 2, michaelmas: 0, martinmas: 3, christmas: 8, twelveDays: 2, epiphany: 3,
} as const;
export const BOON_MORALE = 3;
export const EVICTION = { morale: -40, lord: -20 } as const;
export const DRUNKARD_HIT = { village: -2, priest: -2 } as const;
export const GOOD_NEIGHBOUR_GAIN = 3;
export const CONFESS_HEATHEN_DAYS = 14;

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
  /** The great pestilence: buboes, black fever. Death is rolled daily while it lasts (PLAGUE.deathDaily). */
  pestilence: { drain: 6, minDays: 5, maxDays: 9 },
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

export const TAG_DAYS = { heathen: 56, drunkard: 28, goodNeighbour: 28, debtor: 84, suspect: 28, penitent: 28, witch: 365, omen: 21, brawler: 21 } as const;
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
export const COOK_YIELD = { bread: 18, pottage: 18 } as const;
/** The croft garden (peas, beans, leeks, worts) adds pottage each day from May to October while there is land. */
export const GARDEN_POTTAGE_PER_DAY = 1.5;
export const GARDEN_MONTHS: readonly number[] = [5, 6, 7, 8, 9, 10];
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
/** Rent per acre for an unfree holding (36d for the starting 15 acres), and for a free tenant who owes no labour. */
export const RENT_PER_ACRE = 2.4;
export const RENT_FREE_PER_ACRE = 4;
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
/** A chosen task plays out on screen for this long, then its time passes at once. */
export const WORK_SHOW_MS = 2400;
/**
 * Hastening is capped: the life may run ahead of the wall clock by at most this much in one go (half a real
 * day = three and a half game days), and the allowance refills at HASTE_REFILL real ms per real ms. Over
 * any long stretch the life lives at most (1 + HASTE_REFILL) times as fast as the clock.
 */
export const HASTE_BUDGET_MS = 12 * 60 * 60 * 1000;
export const HASTE_REFILL = 1;
/** Tasks that can wait in the queue (R). */
export const QUEUE_MAX = 3;
/** Days a life must last before the old four-shade screen (DMG mode) is earned. */
export const DMG_UNLOCK_DAYS = 28;
/** Hold SELECT + START this long to open the debug panel. */
export const DEBUG_HOLD_MS = 2000;

/* ───────────────────────── Actions ───────────────────────── */

export type Location = 'home' | 'strips' | 'demesne' | 'church' | 'tavern' | 'woods' | 'stream' | 'green' | 'manor' | 'barrow' | 'town' | 'camp';
export type ActionId =
  | 'eat' | 'cook' | 'brew' | 'sleep' | 'workStrips' | 'weekWork' | 'attendMass' | 'pray' | 'confess'
  | 'tavern' | 'gatherFirewood' | 'wash' | 'socialise' | 'trade' | 'rest'
  | 'court' | 'marry' | 'helpNeighbour' | 'askFavour' | 'accuse' | 'takeHolding' | 'buyFreedom' | 'hire' | 'beg'
  | 'flee' | 'poach' | 'rob' | 'offering' | 'surrender' | 'prayHome';

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
  trade: { label: 'TRADE', duration: 1, location: 'green', blocks: [1, 2, 3, 4], days: 'any', activity: 'light', effects: {} },
  rest: { label: 'REST', duration: 1, location: 'home', blocks: ALL, days: 'any', activity: 'rest', effects: { morale: 0.5 } },
  court: { label: 'COURT', duration: 1, location: 'green', blocks: [2, 3, 4], days: 'any', activity: 'rest', effects: { morale: 3 } },
  marry: { label: 'MARRY', duration: 1, location: 'church', blocks: [1, 2], days: 'any', activity: 'rest', effects: { morale: 15 } },
  helpNeighbour: { label: 'HELP NEIGHBOUR', duration: 1, location: 'green', blocks: [1, 2, 3], days: 'any', activity: 'work', effects: { filth: 1 } },
  askFavour: { label: 'ASK A FAVOUR', duration: 1, location: 'green', blocks: [1, 2, 3, 4], days: 'any', activity: 'rest', effects: {} },
  accuse: { label: 'ACCUSE', duration: 1, location: 'church', blocks: [1, 2, 3], days: 'any', activity: 'rest', effects: {} },
  takeHolding: { label: 'TAKE A HOLDING', duration: 1, location: 'manor', blocks: [1, 2, 3], days: 'any', activity: 'rest', effects: {} },
  buyFreedom: { label: 'BUY FREEDOM', duration: 1, location: 'manor', blocks: [1, 2, 3], days: 'any', activity: 'rest', effects: {} },
  hire: { label: 'WORK FOR HIRE', duration: 3, location: 'any', blocks: [1, 2], days: 'any', activity: 'work', effects: { filth: 1 } },
  beg: { label: 'BEG', duration: 1, location: 'church', blocks: [1, 2, 3, 4], days: 'any', activity: 'rest', effects: { morale: -2 } },
  flee: { label: 'FLEE TO TOWN', duration: 1, location: 'woods', blocks: [0, 1], days: 'any', activity: 'heavy', effects: {} },
  poach: { label: 'POACH', duration: 1, location: 'woods', blocks: [0, 4, 5], days: 'any', activity: 'work', effects: { filth: 2 } },
  rob: { label: 'ROB TRAVELLERS', duration: 1, location: 'woods', blocks: [3, 4], days: 'any', activity: 'heavy', effects: { filth: 2, privatePiety: -6 } },
  offering: { label: 'LEAVE OFFERING', duration: 1, location: 'barrow', blocks: [4, 5], days: 'any', activity: 'light', effects: { privatePiety: -3 } },
  /** Prayers at home, kneeling by the bed: quieter than the church, but every day. */
  prayHome: { label: 'PRAY', duration: 1, location: 'home', blocks: ALL, days: 'any', activity: 'rest', effects: { privatePiety: 1.5, morale: 1 } },
  surrender: { label: 'GIVE UP THE WOODS', duration: 1, location: 'manor', blocks: [1, 2], days: 'any', activity: 'rest', effects: {} },
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

/* ───────────────────────── Phase 4: village ───────────────────────── */

/** Opinions run -100..100. */
export const OPINION_START = { min: -10, max: 25 } as const;
export const TIE_START = { min: -30, max: 45 } as const;
/** Daily pull of every opinion toward 0 (memory fades). */
export const OPINION_DECAY = 0.004;
/** standing.village is pulled daily toward 50 + mean opinion / 2 by this share. */
export const VILLAGE_FROM_OPINION = 0.05;
export const MEMORY_MAX = 6;
/** Rumours: chance per day that a knower tells each friend (tie > FRIEND_TIE); rumours die after LIFE days. */
export const GOSSIP = { tellChance: 0.35, friendTie: 0, lifeDays: 21, maxRumours: 24, playerHearsChance: 0.5, villagerDeedChance: 0.15 } as const;
/** Opinion change in the person who did the deed's direct witness, and a share of it in each who hears it. */
export const RUMOUR_HEARD_SHARE = 0.6;
export const DEED = {
  drunkard: -6, fined: -5, penance: -8, goodNeighbour: 4, helped: 8, quarrel: -8, missedMass: -2, beggar: -3,
  accuseWin: 6, accuseFail: -15, accused: -20, poacher: -6, robber: -25, reeveDues: -1, generous: 5, heathen: -4,
} as const;
/** Favours ledger: help given -> owed; capped per villager; asking for help without credit puts you in their debt. */
export const FAVOUR = { cap: 3, askOpinionMin: 20, grudgeOwed: -2, callInChance: 0.1, callInGrain: 1, calledInOpinion: -6, breadGift: 3, labourBlocks: 1 } as const;
/** Witch accusations: below this village standing after a harvest worse than BAD_HARVEST of expected. */
export const WITCH = { standing: 30, badHarvest: 0.75, dailyChance: 0.004, oathHelpers: 4, helperOpinion: 15, convictMorale: -30, convictVillage: -20, convictFine: 24 } as const;
/** Accusing a rival succeeds if the village's mean tie toward them is below this (and the harvest was bad: easier). */
export const ACCUSE = { meanTieBelow: 0, badHarvestBonus: 15, priestGain: 3, grudge: -60 } as const;

/* ───────────────────────── Phase 4: family ───────────────────────── */

export const DAYS_PER_YEAR = 365;
export const START_AGES = { peasant: 28, spouse: 25, child: 6 } as const;
export const CHILD_WORK_AGE = 7;
export const ADULT_AGE = 14;
/** Children under this age eat half a serving. */
export const SMALL_CHILD_AGE = 7;
export const CHILD_LABOUR_SHARE = 0.25;
/** Daily conception chance for a married woman in [min,max] years with no baby under a year. */
export const CONCEPTION = { daily: 0.004, minAge: 16, maxAge: 40, pregnancyDays: 270, childbedDeath: 0.04, maxChildren: 6 } as const;
/** Illness chance multiplier for small children (under SMALL_CHILD_AGE) and the old (over OLD_AGE). */
export const CHILD_FRAILTY = 2.5;
export const OLD_AGE = 50;
export const OLD_FRAILTY_PER_YEAR = 0.15;
/** Daily chance a grown child (not the heir) leaves for service or marriage. */
export const LEAVE_HOME_DAILY = 0.0015;
/** Courtship points: per block of courting on a feast day / ordinary day; needed to propose. */
export const COURTSHIP = { feast: 12, ordinary: 4, needed: 30, opinionGain: 4 } as const;
export const MERCHET_PENCE = 12;
export const MARRY_MIN_AGE = 14;

/* ───────────────────────── Phase 4: hallmote ───────────────────────── */

export const HALLMOTE_EVERY_DAYS = 21;
export const HALLMOTE_FINES = { brawling: 6, badAle: 3, strayBeast: 2, missedWork: 4 } as const;
export const HALLMOTE_STANDING_HIT = -4;
export const BAD_ALE_CHANCE = 0.3;
export const STRAY_CHANCE_PER_BEAST = 0.08;
/** A brawl in the alehouse: chance per tavern visit while drunk (low morale doubles it). */
export const BRAWL_CHANCE = 0.06;
export const REEVE = { minVillage: 55, minLord: 45, termDays: 365, wagePerWeek: 2, lord: 5 } as const;

/* ───────────────────────── Phase 4: advancement and decline ───────────────────────── */

export const RANK_ACRES = { villein: 10, virgate: 30 } as const;
/** Entry fine (gersum) per acre to take up a vacant holding, and acres per holding. */
export const HOLDING = { entryPerAcre: 1.5, acres: 5, minLord: 35 } as const;
export const FREEDOM = { pence: 240, minLord: 55, plagueDiscount: 0.5 } as const;
/** Debt: seizure of a beast above this; eviction above EVICT_AT when nothing is left to take. */
export const DEBT = { seizeAt: 24, evictAt: 60 } as const;
export const BEAST_VALUE = { ox: 60, cow: 40, pig: 12, hens: 1 } as const;
/**
 * Wages per block of hired labour (about a penny a day for three blocks); ×PLAGUE.wageMult in the aftermath.
 * The rest of the household works too: each other adult adds HOUSEHOLD_EARNER, each working child half that.
 */
export const WAGE_PER_BLOCK = 0.35;
export const TOWN_WAGE_PER_BLOCK = 0.5;
export const HOUSEHOLD_EARNER = 0.5;
/** Pence a day for a roof when you hold no land: a cot in the village, a garret in the town. Unpaid: sleep rough. */
export const LODGING_PER_DAY = { village: 0.25, town: 0.75 } as const;
export const SLEEP_ROUGH_MORALE = -3;
/** A labourer with nothing becomes a beggar after this many hungry days. */
export const BEGGAR_AFTER_DAYS = 10;
export const BEG = { breadChance: 0.5, bread: 2, pennyChance: 0.2 } as const;
/** Chance per poach/rob of being taken; taken means the hallmote outlaws a landless man, and the sheriff hangs an outlaw. */
export const POACH = { meat: 6, caughtChance: 0.08 } as const;
export const ROB = { minPence: 2, maxPence: 12, caughtChance: 0.12 } as const;
/** Flight: daily chance the lord's men find you in town (×lordGrip). A year and a day makes you free. */
export const FLIGHT = { daysToFree: 366, captureDaily: 0.002, capturedFine: 24, capturedLord: -25 } as const;
/** Daily chance the sheriff takes an outlaw in the woods (×lordGrip). */
export const OUTLAW_TAKEN_DAILY = 0.003;
/** An outlaw who surrenders is fined and becomes a labourer. */
export const SURRENDER_FINE = 40;

/* ───────────────────────── Phase 4: dark layer ───────────────────────── */

/** The black dog: chance per night block spent abroad (new moon triples it). */
export const BLACK_DOG_CHANCE = 0.02;
export const BLACK_DOG_MORALE = -8;
export const FAE = { offeringBread: 2, saveFloor: 0.9, takeDaily: 0.02, morale: -10 } as const;
/** Nightmares and visitors at night: base chance plus hunger, sickness, low piety. */
/** Hunger counts above 40, piety below 40. */
export const NIGHT_TERROR = { base: 0.004, hunger: 0.001, ill: 0.03, piety: 0.001, morale: -6, visitorShare: 0.35 } as const;

/* ───────────────────────── Phase 4: the Black Death ───────────────────────── */

/** Omens from 1 June 1348; outbreak 1 Oct 1348 to 31 May 1349; aftermath to Lady Day 1350. */
export const PLAGUE = {
  omenFrom: [1348, 6, 1], outbreakFrom: [1348, 10, 1], outbreakTo: [1349, 5, 31], resolveOn: [1350, 3, 25],
  omenChance: 0.08, infectDaily: 0.004, deathDaily: 0.1, villagerDeathDaily: 0.0018,
  wageMult: 3, lordGrip: 1.6, morale: -1,
} as const;

/* ───────────────────────── Phase 4: death and bloodline ───────────────────────── */

export const HEIR_MIN_AGE = 14;
/** Share of standing (distance from 50) and of villager opinions the heir inherits. */
export const INHERIT_STANDING = 0.5;
export const INHERIT_OPINION = 0.7;
export const GRIEF_MORALE = -25;
export const CONFESS_HEATHEN_DAYS = 14;

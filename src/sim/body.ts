import {
  FATIGUE_DELTA, FILTH_PER_BLOCK, FILTH_WORK_EXTRA, HEALTH_REGEN_POOR, HEALTH_REGEN_WELL, HUNGER_COLD_EXTRA, HUNGER_RISE,
  HUNGER_SATED, HUNGER_STARVING, ILLNESS, ILLNESS_BASE_CHANCE, INFECTION_BASE_CHANCE, INJURY_BASE_CHANCE, INJURY_CHANCE_PER_POINT,
  INJURY_DAYS, INJURY_HEALTH_HIT, NIGHT_SLEEP_BONUS, OVERWORK_FATIGUE, RESERVE_BURN_BASE, RESERVE_BURN_PER_POINT, RESERVE_REBUILD,
  RESERVE_REBUILD_CEILING, RESERVE_REBUILD_PIVOT, RESERVE_TIERS, STARVATION_HEALTH_LOSS, WARMTH_CLOTHING, WARMTH_COLD, WARMTH_FIRE, WARMTH_PER_C, WARMTH_RATE, WARMTH_SHELTER,
  WARMTH_WORKING, type Activity, type IllnessKind,
} from './balance';
import type { Season } from './calendar';
import { clamp, type Body } from './state';

export type ReserveTier = 'stout' | 'healthy' | 'thin' | 'gaunt' | 'skeletal';

export function reserveTier(reserve: number): ReserveTier {
  if (reserve >= RESERVE_TIERS.stout) return 'stout';
  if (reserve >= RESERVE_TIERS.healthy) return 'healthy';
  if (reserve >= RESERVE_TIERS.thin) return 'thin';
  if (reserve >= RESERVE_TIERS.gaunt) return 'gaunt';
  return 'skeletal';
}

export interface Surroundings {
  activity: Activity;
  tempC: number;
  atHome: boolean;
  fireLit: boolean;
  night: boolean;
}

export function warmthTarget(env: Surroundings): number {
  let t = env.tempC * WARMTH_PER_C + WARMTH_CLOTHING;
  if (env.atHome) t += WARMTH_SHELTER + (env.fireLit ? WARMTH_FIRE : 0);
  if (env.activity === 'work' || env.activity === 'heavy') t += WARMTH_WORKING;
  return clamp(t);
}

/** One block of bodily change. Mutates the body. */
export function tickBody(b: Body, env: Surroundings): void {
  b.warmth = clamp(b.warmth + (warmthTarget(env) - b.warmth) * WARMTH_RATE);
  const cold = b.warmth < WARMTH_COLD;
  b.hunger = clamp(b.hunger + HUNGER_RISE[env.activity] + (cold ? HUNGER_COLD_EXTRA : 0));
  if (b.hunger >= HUNGER_STARVING) b.reserve = clamp(b.reserve - RESERVE_BURN_BASE - (b.hunger - HUNGER_STARVING) * RESERVE_BURN_PER_POINT);
  else if (b.hunger < HUNGER_SATED) {
    const r = b.reserve;
    const rate =
      r < RESERVE_REBUILD_PIVOT
        ? 1 + (RESERVE_REBUILD_PIVOT - r) / 4
        : Math.min(1, Math.max(0, (RESERVE_REBUILD_CEILING - r) / (RESERVE_REBUILD_CEILING - 60)));
    b.reserve = clamp(r + RESERVE_REBUILD * rate);
  }
  b.fatigue = clamp(b.fatigue + FATIGUE_DELTA[env.activity] + (env.activity === 'sleep' && env.night ? NIGHT_SLEEP_BONUS : 0));
  const working = env.activity === 'work' || env.activity === 'heavy';
  b.filth = clamp(b.filth + FILTH_PER_BLOCK + (working ? FILTH_WORK_EXTRA : 0));
}

/** Chance of an injury during a block of labour; zero unless overworked. */
export function injuryChance(b: Body, activity: Activity): number {
  if ((activity !== 'work' && activity !== 'heavy') || b.fatigue <= OVERWORK_FATIGUE) return 0;
  return INJURY_BASE_CHANCE + (b.fatigue - OVERWORK_FATIGUE) * INJURY_CHANCE_PER_POINT;
}

export function injure(b: Body): void {
  b.injuredDays = INJURY_DAYS;
  b.health = clamp(b.health - INJURY_HEALTH_HIT);
}

/** Daily illness chance, weighted by reserve, fatigue, warmth and filth. */
export function illnessChance(b: Body): number {
  const risk =
    Math.max(0, (40 - b.reserve) / 10) + Math.max(0, (b.fatigue - 60) / 20) + Math.max(0, (WARMTH_COLD - b.warmth) / 10) + b.filth / 40;
  return ILLNESS_BASE_CHANCE * (1 + risk);
}

/** Which illness strikes: ague in the cold and wet, flux with filth and summer, fever anywhere. */
export function pickIllness(b: Body, season: Season, wet: boolean, roll: number): IllnessKind {
  const w = {
    ague: 1 + (season === 'winter' || season === 'autumn' ? 1 : 0) + (wet ? 1 : 0) + (b.warmth < WARMTH_COLD ? 1 : 0),
    flux: 1 + (season === 'summer' ? 1.5 : 0) + b.filth / 40,
    fever: 1.5,
  };
  const total = w.ague + w.flux + w.fever;
  let r = roll * total;
  for (const k of ['ague', 'flux', 'fever'] as const) {
    r -= w[k];
    if (r < 0) return k;
  }
  return 'fever';
}

export function sicken(b: Body, kind: IllnessKind, roll: number): void {
  const spec = ILLNESS[kind];
  b.illness = { kind, daysLeft: spec.minDays + Math.floor(roll * (spec.maxDays - spec.minDays + 1)) };
}

export interface DailyRolls {
  illness: number;
  kind: number;
  severity: number;
  infection: number;
}

export interface DailyOutcome {
  fellIll: IllnessKind | null;
  recovered: IllnessKind | null;
  healed: boolean;
  died: boolean;
}

/** Once a day at dawn: illness progresses or strikes, injuries heal or fester, health drains or mends. */
export function dailyHealth(b: Body, season: Season, wet: boolean, rolls: DailyRolls): DailyOutcome {
  const out: DailyOutcome = { fellIll: null, recovered: null, healed: false, died: false };
  const frailty = 1 + Math.max(0, (RESERVE_TIERS.thin - b.reserve) / 20);
  if (b.illness) {
    b.health = clamp(b.health - ILLNESS[b.illness.kind].drain * frailty);
    b.illness.daysLeft -= 1;
    if (b.illness.daysLeft <= 0) {
      out.recovered = b.illness.kind;
      b.illness = null;
    }
  } else {
    if (b.injuredDays > 0 && rolls.infection < INFECTION_BASE_CHANCE * (1 + b.filth / 30)) {
      sicken(b, 'infectedInjury', rolls.severity);
      out.fellIll = 'infectedInjury';
    } else if (rolls.illness < illnessChance(b)) {
      const kind = pickIllness(b, season, wet, rolls.kind);
      sicken(b, kind, rolls.severity);
      out.fellIll = kind;
    } else {
      b.health = clamp(b.health + (b.reserve >= RESERVE_TIERS.thin ? HEALTH_REGEN_WELL : HEALTH_REGEN_POOR));
    }
  }
  if (b.injuredDays > 0) {
    b.injuredDays -= 1;
    out.healed = b.injuredDays === 0;
  }
  // Wasted and still starving: the body eats itself.
  if (b.reserve < RESERVE_TIERS.gaunt && b.hunger >= HUNGER_STARVING) b.health = clamp(b.health - STARVATION_HEALTH_LOSS);
  out.died = b.health <= 0;
  return out;
}

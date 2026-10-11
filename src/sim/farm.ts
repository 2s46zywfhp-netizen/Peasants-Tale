import {
  CARE_LABOUR_PER_ACRE, HARVEST_END, HARVEST_LABOUR_PER_ACRE, MANURE_PER_ANIMAL, OX_LABOUR_BONUS, SEED_PER_ACRE, SOW_LABOUR_PER_ACRE,
  SPRING_RIPE, SPRING_SOW, TITHE_PUBLIC_PIETY, TITHE_RATE, TOOL_WEAR_PER_BLOCK, UNHARVESTED_LOSS, WINTER_RIPE, WINTER_SOW,
  YIELD_NOISE, YIELD_PER_ACRE, type Crop, UNWATCHED, BLOCKS_PER_DAY
} from './balance';
import { inWindow, type DayInfo } from './calendar';
import { faeSpare } from './dark';
import { childLabour } from './family';
import { log } from './log';
import { clamp, rand, type Field, type SimState } from './state';
import type { Weather } from './weather';

const WINTER_CROPS: readonly Crop[] = ['wheat', 'rye'];
const SPRING_CROPS: readonly Crop[] = ['barley', 'oats', 'peas'];
const same = (i: DayInfo, md: readonly number[]) => i.month === md[0] && i.day === md[1];

export function manureFactor(s: SimState): number {
  const w = s.wealth;
  return 1 + w.hens * MANURE_PER_ANIMAL.hens + w.pig * MANURE_PER_ANIMAL.pig + w.cow * MANURE_PER_ANIMAL.cow + w.ox * MANURE_PER_ANIMAL.ox;
}

export function labourPerBlock(s: SimState): number {
  return (0.5 + s.wealth.tools / 200) * (s.wealth.ox > 0 ? OX_LABOUR_BONUS : 1) * (1 + childLabour(s));
}

/** Yield roll when a crop ripens: weather over its growth, the care it got, manure, and luck. */
export function rollYield(s: SimState, f: Field): number {
  if (!f.crop) return 0;
  const weather = faeSpare(s, clamp(1 + (f.weatherDays ? f.weatherSum / f.weatherDays : 0) * 0.5, 0.4, 1.4), f.id);
  const care = 0.7 + 0.3 * Math.min(1, f.careLabour / (f.acres * CARE_LABOUR_PER_ACRE));
  const noise = 1 + (rand(s) * 2 - 1) * YIELD_NOISE;
  return Math.round(f.acres * YIELD_PER_ACRE[f.crop] * f.sownShare * weather * care * manureFactor(s) * noise * 10) / 10;
}

function bringIn(s: SimState, f: Field, bushels: number): void {
  const tithe = bushels * TITHE_RATE;
  f.harvested += bushels;
  s.wealth.grain += bushels - tithe;
}

function finishHarvest(s: SimState, f: Field, note: string): void {
  f.stage = 'harvested';
  const tithe = Math.round(f.harvested * TITHE_RATE * 10) / 10;
  s.soul.publicPiety = clamp(s.soul.publicPiety + TITHE_PUBLIC_PIETY);
  if (f.crop && f.acres > 0) s.lastHarvest = f.harvested / (f.acres * YIELD_PER_ACRE[f.crop]);
  log(s, 'farm', `${note} ${Math.round(f.harvested)} bu of ${f.crop}. Tithe: ${tithe} bu.`);
}

/** Calendar-driven field changes, once a day at dawn. */
export function dailyFarm(s: SimState, info: DayInfo, w: Weather): void {
  if (s.obligations.evicted) return;
  const yearIdx = info.year;
  for (const f of s.fields) {
    if (f.stage === 'growing') {
      f.weatherSum += w.cropQuality;
      f.weatherDays += 1;
      const ripe = f.kind === 'winter' ? WINTER_RIPE : SPRING_RIPE;
      if (same(info, ripe)) {
        f.stage = 'ripe';
        f.expectedYield = rollYield(s, f);
        log(s, 'farm', `The ${f.crop} on the ${f.id} field is ripe.`);
      }
    }
    if (f.stage === 'ripe' && info.month === HARVEST_END[0] + 1 && info.day === 1) {
      const left = Math.max(0, f.expectedYield - f.harvested);
      bringIn(s, f, left * (1 - UNHARVESTED_LOSS));
      finishHarvest(s, f, 'Late and rotting, the gleaners brought in');
    }
    if (f.kind === 'spring' && f.stage === 'unsown' && info.month === SPRING_SOW.to[0] + 1 && info.day === 1) {
      f.stage = 'harvested';
      log(s, 'farm', `The ${f.id} field was never sown. It lies idle.`);
    }
    if (f.kind === 'winter' && f.stage === 'unsown' && info.month === WINTER_SOW.to[0] + 1 && info.day === 1) {
      f.stage = 'harvested';
      log(s, 'farm', `The ${f.id} field was never sown. It lies idle.`);
    }
    if (f.kind === 'spring' && f.stage === 'harvested' && same(info, SPRING_SOW.from)) {
      f.stage = 'unsown';
      log(s, 'farm', `Spring sowing: the ${f.id} field wants ${f.crop}.`);
    }
  }
  // Three-field rotation when the winter sowing opens: winter -> spring -> fallow -> winter.
  if (same(info, WINTER_SOW.from)) {
    for (const f of s.fields) {
      const next = f.kind === 'winter' ? 'spring' : f.kind === 'spring' ? 'fallow' : 'winter';
      Object.assign(f, {
        kind: next,
        crop: next === 'winter' ? WINTER_CROPS[yearIdx % 2]! : next === 'spring' ? SPRING_CROPS[(yearIdx + 1) % 3]! : null,
        stage: next === 'winter' ? 'unsown' : next === 'spring' ? 'harvested' : 'fallow',
        sowLabour: 0, sownShare: 0, careLabour: 0, harvestLabour: 0, weatherSum: 0, weatherDays: 0, expectedYield: 0, harvested: 0,
      } satisfies Partial<Field>);
    }
    log(s, 'farm', 'Michaelmas past: the fields turn. Time to plough and sow the winter corn.');
  }
}

function sowingOpen(f: Field, info: DayInfo): boolean {
  const win = f.kind === 'winter' ? WINTER_SOW : SPRING_SOW;
  return f.stage === 'unsown' && inWindow(info.month, info.day, win.from, win.to);
}

/** The most pressing field task right now. */
export function fieldTask(s: SimState, info: DayInfo): { field: Field; task: 'harvest' | 'sow' | 'care' } | null {
  if (s.obligations.evicted) return null;
  const ripe = s.fields.find((f) => f.stage === 'ripe');
  if (ripe) return { field: ripe, task: 'harvest' };
  const sow = s.fields.find((f) => sowingOpen(f, info));
  if (sow) return { field: sow, task: 'sow' };
  const care = s.fields.find((f) => f.stage === 'growing' && f.careLabour < f.acres * CARE_LABOUR_PER_ACRE);
  if (care) return { field: care, task: 'care' };
  return null;
}

/** One block of work on the strips. Returns what was done, for the log. */
export function workStrips(s: SimState, info: DayInfo): string {
  s.wealth.tools = clamp(s.wealth.tools - TOOL_WEAR_PER_BLOCK);
  const t = fieldTask(s, info);
  if (!t) return 'mends hedges and ditches';
  const f = t.field;
  // Work done by habit alone, in a household nobody tends, is sloppier.
  const sloppy = !s.plan?.byPlayer && s.block - (s.counters.lastPlayerBlock ?? 0) > UNWATCHED.afterDays * BLOCKS_PER_DAY;
  const amount = labourPerBlock(s) * (sloppy ? UNWATCHED.labour : 1);
  if (t.task === 'harvest') {
    const need = f.acres * HARVEST_LABOUR_PER_ACRE;
    const share = Math.min(amount, need - f.harvestLabour) / need;
    f.harvestLabour += amount;
    bringIn(s, f, Math.min(f.expectedYield * share, f.expectedYield - f.harvested));
    if (f.harvestLabour >= need) finishHarvest(s, f, 'Harvest home:');
    return `reaps the ${f.crop}`;
  }
  if (t.task === 'sow') {
    f.sowLabour += amount;
    if (f.sowLabour >= f.acres * SOW_LABOUR_PER_ACRE) {
      const need = f.acres * SEED_PER_ACRE;
      const used = Math.min(need, s.wealth.grain);
      s.wealth.grain -= used;
      f.sownShare = need > 0 ? used / need : 0;
      f.stage = 'growing';
      log(s, 'farm', `The ${f.id} field is sown with ${f.crop}${f.sownShare < 1 ? ', but seed ran short' : ''}.`);
    }
    return `ploughs and sows the ${f.id} field`;
  }
  f.careLabour += amount;
  return `weeds and manures the ${f.crop}`;
}

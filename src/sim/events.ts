import { DAMP_LOSS, EVENT_DAILY_CHANCE, HEATHEN_EVENT_MULT, type IllnessKind, GIFT_BREAD } from './balance';
import { injure, sicken } from './body';
import type { DayInfo } from './calendar';
import { bury } from './bloodline';
import { log } from './log';
import { summonToChurchCourt, summonToManorCourt } from './obligations';
import { clamp, hasTag, peasant, rand, type SimState } from './state';

export interface GameEvent {
  id: string;
  negative: boolean;
  /** Relative odds when a random event fires; 0 = debug/trigger only. */
  weight: (s: SimState, i: DayInfo) => number;
  apply: (s: SimState, i: DayInfo) => void;
}

const illness = (kind: IllnessKind, text: string): GameEvent => ({
  id: `illness:${kind}`,
  negative: true,
  weight: (s) => (peasant(s).body.illness ? 0 : 0.5),
  apply: (s) => {
    const b = peasant(s).body;
    if (b.illness) return;
    sicken(b, kind, rand(s));
    log(s, 'illness', text);
  },
});

export const EVENTS: readonly GameEvent[] = [
  {
    id: 'foxTakesHen', negative: true,
    weight: (s) => (s.wealth.hens > 0 ? 1 : 0),
    apply: (s) => { s.wealth.hens = Math.max(0, s.wealth.hens - 1); log(s, 'event', 'A fox in the night. One hen fewer, feathers on the dew.'); },
  },
  {
    id: 'dampGrain', negative: true,
    weight: (s) => (s.wealth.grain > 5 ? 0.5 : 0),
    apply: (s) => { const lost = Math.round(s.wealth.grain * DAMP_LOSS * 10) / 10; s.wealth.grain -= lost; log(s, 'event', `Damp got into the grain store. ${lost} bu spoiled.`); },
  },
  {
    id: 'thief', negative: true,
    weight: (s) => (s.wealth.pence > 0 ? 0.6 : 0),
    apply: (s) => { const n = Math.min(3, s.wealth.pence); s.wealth.pence -= n; log(s, 'event', `A thief. ${n}d gone from under the bed.`); },
  },
  {
    id: 'fallInjury', negative: true,
    weight: (s) => (peasant(s).body.injuredDays ? 0 : 0.5),
    apply: (s) => { injure(peasant(s).body); log(s, 'body', 'A bad fall on the wet path. The leg will not take weight.'); },
  },
  {
    id: 'quarrel', negative: true,
    weight: () => 0.8,
    apply: (s) => { s.standing.village = clamp(s.standing.village - 4); s.soul.morale = clamp(s.soul.morale - 5); log(s, 'event', 'A quarrel over a boundary stone. Hard words at the well.'); },
  },
  {
    id: 'blackDog', negative: true,
    weight: (_s, i) => (i.moon === 0 ? 1.5 : 0.3),
    apply: (s) => { s.soul.morale = clamp(s.soul.morale - 8); log(s, 'event', 'A black dog with eyes like coals watched from the lych-gate.'); },
  },
  illness('ague', 'The ague: shaking, then burning. To bed.'),
  illness('flux', 'The bloody flux. Weak as water.'),
  illness('fever', 'A fever comes on with the evening.'),
  {
    id: 'windfall', negative: false,
    weight: () => 0.6,
    apply: (s) => { s.wealth.pence += 2; log(s, 'event', 'Two pennies glinting in the furrow. God is good.'); },
  },
  {
    id: 'kindNeighbour', negative: false,
    weight: () => 0.6,
    apply: (s) => { s.wealth.bread += GIFT_BREAD; s.soul.morale = clamp(s.soul.morale + 4); log(s, 'event', 'A neighbour leaves three loaves at the door.'); },
  },
  { id: 'manorSummons', negative: true, weight: () => 0, apply: (s, i) => summonToManorCourt(s, i.dayIndex) },
  // Debug-only (weight 0): reach the Phase 4 systems on demand.
  { id: 'headDies', negative: true, weight: () => 0, apply: (s) => bury(s, peasant(s), 'struck down') },
  { id: 'childDue', negative: false, weight: () => 0, apply: (s, i) => { s.family.pregnantSince = i.dayIndex - 270; } },
  { id: 'pestilence', negative: true, weight: () => 0, apply: (s, i) => { for (const m of s.members) if (m.alive) sicken(m.body, 'pestilence', 0.5); log(s, 'plague', `The tokens on every skin in the house. (${i.year})`); } },
  { id: 'deepDebt', negative: true, weight: () => 0, apply: (s) => { s.obligations.debt += 80; log(s, 'manor', 'The steward writes 80d against your name.'); } },
  { id: 'vacantLand', negative: false, weight: () => 0, apply: (s) => { s.plague.vacant += 1; s.wealth.pence += 10; log(s, 'manor', 'A holding falls vacant. 10d found in the thatch.'); } },
  { id: 'churchSummons', negative: true, weight: () => 0, apply: (s, i) => summonToChurchCourt(s, i.dayIndex) },
];

export const EVENT_IDS = EVENTS.map((e) => e.id);

/** The heathen tag doubles the odds of something going wrong. */
export function negativeShare(s: SimState): number {
  return hasTag(s, 'heathen') ? HEATHEN_EVENT_MULT : 1;
}

/** Once a day at dawn: perhaps something happens. Negative events are weighted up for heathens. */
export function dailyEvents(s: SimState, i: DayInfo): GameEvent | null {
  const mult = negativeShare(s);
  if (rand(s) >= EVENT_DAILY_CHANCE * mult) return null;
  const pool = EVENTS.map((e) => ({ e, w: e.weight(s, i) * (e.negative ? mult : 1) })).filter((x) => x.w > 0);
  const total = pool.reduce((n, x) => n + x.w, 0);
  let r = rand(s) * total;
  for (const x of pool) {
    r -= x.w;
    if (r < 0) {
      x.e.apply(s, i);
      return x.e;
    }
  }
  return null;
}

export function triggerEvent(s: SimState, id: string, i: DayInfo): boolean {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) return false;
  e.apply(s, i);
  return true;
}

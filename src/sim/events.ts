import { DAMP_LOSS, EVENT_DAILY_CHANCE, HEATHEN_EVENT_MULT, type IllnessKind } from './balance';
import { injure, sicken } from './body';
import type { DayInfo } from './calendar';
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
    apply: (s) => { s.wealth.bread += 3; s.soul.morale = clamp(s.soul.morale + 4); log(s, 'event', 'A neighbour leaves three loaves at the door.'); },
  },
  { id: 'manorSummons', negative: true, weight: () => 0, apply: (s, i) => summonToManorCourt(s, i.dayIndex) },
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

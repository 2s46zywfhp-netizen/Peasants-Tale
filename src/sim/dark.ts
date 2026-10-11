import { BLACK_DOG_CHANCE, BLACK_DOG_MORALE, FAE, NIGHT_TERROR, TAG_DAYS } from './balance';
import { sicken } from './body';
import type { DayInfo } from './calendar';
import { log } from './log';
import { addTag, clamp, peasant, rand, type SimState } from './state';

// Everything here is told as the family would tell it: never confirmed, always explicable.

const pickText = (s: SimState, xs: readonly string[]): string => xs[Math.floor(rand(s) * xs.length)]!;

const DOG = [
  'On the road home, a black dog keeps pace beyond the hedge. When you stop, it stops.',
  'A great black dog sits at the crossroads, eyes like coals. When you look again, only a stump.',
  'Something padded behind you all the way from the woods. No dog in Ashby is that big.',
] as const;

/** A night block spent abroad (not at home, church or in the town) may bring the black dog. */
export function roadAtNight(s: SimState, info: DayInfo): void {
  const loc = s.location;
  if (loc === 'home' || loc === 'church' || loc === 'town' || loc === 'tavern') return;
  const chance = BLACK_DOG_CHANCE * (info.moon === 0 ? 3 : 1);
  if (rand(s) >= chance) return;
  s.soul.morale = clamp(s.soul.morale + BLACK_DOG_MORALE);
  addTag(s, 'omen', info.dayIndex + TAG_DAYS.omen);
  log(s, 'dark', pickText(s, DOG));
}

const NIGHTMARES = [
  'A dream of the fields rotting black from the edges in. You wake with mud under your nails.',
  'All night, the sense of something sitting on your chest. Morning comes grey and late.',
  'You dream the church bell rings by itself, and count the strokes, and wake before the last.',
] as const;
const VISITORS = [
  'A knock at the door after curfew. Three knocks. Nobody there, and no tracks in the frost.',
  'A woman in grey stood by the well at midnight. The well has been dry since Candlemas.',
  'In the small hours, a smell of wet earth and a shape at the foot of the bed. Then nothing.',
] as const;

/** Nightmares and visitors come to the hungry, the sick and the faithless. */
export function nightTerrors(s: SimState): void {
  const b = peasant(s).body;
  const t = NIGHT_TERROR;
  const chance = t.base + Math.max(0, b.hunger - 40) * t.hunger + (b.illness ? t.ill : 0) + Math.max(0, 40 - s.soul.privatePiety) * t.piety;
  if (rand(s) >= chance) return;
  s.soul.morale = clamp(s.soul.morale + t.morale);
  b.fatigue = clamp(b.fatigue + 15);
  const ancestor = s.chronicle.length > 1 ? s.chronicle[s.chronicle.length - 2]! : null;
  if (rand(s) < t.visitorShare) {
    log(s, 'dark', ancestor && rand(s) < 0.4
      ? `${ancestor.name} stood at the foot of the bed, as in life, and said nothing. The cold stayed after.`
      : pickText(s, VISITORS));
  } else log(s, 'dark', pickText(s, NIGHTMARES));
}

/* ───────────── the barrow ───────────── */

export function offeringShort(s: SimState): string | null {
  return s.wealth.bread >= FAE.offeringBread || s.wealth.ale >= FAE.offeringAle ? null : 'NOTHING TO LEAVE';
}

export function offering(s: SimState): string {
  if (s.wealth.bread >= FAE.offeringBread) s.wealth.bread -= FAE.offeringBread;
  else s.wealth.ale -= FAE.offeringAle;
  s.dark.faeFavour = Math.min(3, s.dark.faeFavour + 1);
  return s.dark.faeFavour > 1 ? 'leaves bread on the barrow again. In the morning it is gone' : 'leaves bread on the old barrow, and does not look back';
}

/**
 * A crop rolled in bad weather is spared if the barrow has been fed. Returns the weather factor to use.
 * The debt is remembered.
 */
export function faeSpare(s: SimState, weather: number, fieldId: string): number {
  if (weather >= FAE.saveFloor || s.dark.faeFavour <= 0) return weather;
  s.dark.faeFavour -= 1;
  s.dark.faeDebt += 1;
  log(s, 'dark', `The blight took every strip on the ${fieldId} side but yours. People notice.`);
  return 1;
}

const TAKINGS = ['hen', 'child', 'milk', 'time'] as const;

/** Something is taken back, in time. */
export function dailyDark(s: SimState): void {
  if (s.dark.faeDebt <= 0 || rand(s) >= FAE.takeDaily) return;
  s.dark.faeDebt -= 1;
  s.soul.morale = clamp(s.soul.morale + FAE.morale);
  const kind = TAKINGS[Math.floor(rand(s) * TAKINGS.length)]!;
  const youngest = s.members.filter((m) => m.alive && m.role === 'child').reduce<null | (typeof s.members)[number]>((a, m) => (!a || m.bornDay > a.bornDay ? m : a), null);
  if (kind === 'child' && youngest && !youngest.body.illness) {
    sicken(youngest.body, 'fever', rand(s));
    log(s, 'dark', `${youngest.name} wakes changed: cold to the touch, watching the fire. They do not know your name for a day.`, [youngest.name]);
  } else if (kind === 'hen' && s.wealth.hens > 0) {
    s.wealth.hens -= 1;
    log(s, 'dark', 'A hen gone from a shut coop. A ring of pale mushrooms by the door in the morning.');
  } else if (kind === 'milk' && s.wealth.cow > 0) {
    s.wealth.cow -= 1;
    log(s, 'dark', 'The cow is found at dawn on the barrow, stiff and dry. No mark on her.');
  } else {
    peasant(s).body.fatigue = 100;
    log(s, 'dark', 'You wake in the barrow-field at noon with no memory of the night, and dancing-tired.');
  }
}

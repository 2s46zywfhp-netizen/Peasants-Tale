import {
  ADULT_AGE, CHILD_FRAILTY, CHILD_LABOUR_SHARE, CHILD_WORK_AGE, CONCEPTION, COURTSHIP, DAYS_PER_YEAR, LEAVE_HOME_DAILY, MARRY_MIN_AGE,
  MERCHET_PENCE, OLD_AGE, OLD_FRAILTY_PER_YEAR, SMALL_CHILD_AGE,
} from './balance';
import type { DayInfo } from './calendar';
import { log } from './log';
import { present, remember, villager } from './village';
import { ageOf, clamp, FEMALE_NAMES, MALE_NAMES, member, peasant, rand, today, type Member, type SimState } from './state';

export const living = (s: SimState): Member[] => s.members.filter((m) => m.alive);

export function spouse(s: SimState): Member | null {
  return s.members.find((m) => m.role === 'spouse' && m.alive) ?? null;
}

/** Share of a serving a member eats: small children half. */
export function servingShare(m: Member, day: number): number {
  return ageOf(m.bornDay, day) < SMALL_CHILD_AGE ? 0.5 : 1;
}

/** Extra labour from children of working age (and grown children still at home). */
export function childLabour(s: SimState): number {
  const day = today(s);
  let n = 0;
  for (const m of s.members) {
    if (!m.alive || m.role !== 'child') continue;
    const a = ageOf(m.bornDay, day);
    if (a >= ADULT_AGE) n += CHILD_LABOUR_SHARE * 2;
    else if (a >= CHILD_WORK_AGE) n += CHILD_LABOUR_SHARE;
  }
  return n;
}

/** Multiplier on the daily illness chance: small children and the old sicken more easily. */
export function frailty(m: Member, day: number): number {
  const a = ageOf(m.bornDay, day);
  if (a < SMALL_CHILD_AGE) return CHILD_FRAILTY;
  if (a > OLD_AGE) return 1 + (a - OLD_AGE) * OLD_FRAILTY_PER_YEAR;
  return 1;
}

/* ───────────── courtship and marriage ───────────── */

/** Why the head of the house cannot court villager `id` (null = can). */
export function courtShort(s: SimState, id: string | null): string | null {
  const day = today(s);
  const p = peasant(s);
  if (spouse(s)) return 'ALREADY WED';
  if (ageOf(p.bornDay, day) < MARRY_MIN_AGE) return 'TOO YOUNG';
  const v = villager(s, id);
  if (!v) return 'CHOOSE WHO';
  if (!present(v) || v.married || v.sex === p.sex) return 'NOT FREE TO WED';
  const a = ageOf(v.bornDay, day);
  if (a < MARRY_MIN_AGE || a > 45) return 'NOT FREE TO WED';
  return null;
}

export function court(s: SimState, id: string, info: DayInfo): string {
  const v = villager(s, id)!;
  const feast = info.feasts.length > 0 || info.isSunday;
  v.courtship += feast ? COURTSHIP.feast : COURTSHIP.ordinary;
  remember(v, info.dayIndex, `Walked out with ${peasant(s).name}${feast ? ' on the feast day' : ''}.`, COURTSHIP.opinionGain);
  if (v.courtship >= COURTSHIP.needed && v.opinion > 0) log(s, 'family', `${v.name} would say yes, if asked. The merchet must be paid.`, [v.name]);
  return feast ? `dances with ${v.name} at the feast` : `walks out with ${v.name}`;
}

export function merchet(s: SimState): number {
  return s.station.free ? 0 : MERCHET_PENCE;
}

export function marryShort(s: SimState, id: string | null): string | null {
  const why = courtShort(s, id);
  if (why) return why;
  const v = villager(s, id)!;
  if (v.courtship < COURTSHIP.needed || v.opinion <= 0) return 'NOT WON YET';
  if (s.wealth.pence < merchet(s)) return `MERCHET ${merchet(s)}D`;
  return null;
}

export function marry(s: SimState, id: string, info: DayInfo): string {
  const v = villager(s, id)!;
  const fee = merchet(s);
  s.wealth.pence -= fee;
  v.gone = true;
  v.married = true;
  const first = v.name.split(' ')[0]!;
  s.members.push(member(`m${s.family.nextId++}`, first, 'spouse', v.sex, v.bornDay));
  s.standing.village = clamp(s.standing.village + 4);
  note(s, `Married ${first} at the church door, ${info.year}.`);
  log(s, 'family', `${peasant(s).name} weds ${first} at the church door.${fee ? ` Merchet of ${fee}d paid to the lord.` : ''}`);
  return `marries ${first}`;
}

/** Adds a line to the current generation's chronicle. */
export function note(s: SimState, text: string): void {
  s.chronicle[s.chronicle.length - 1]?.notes.push(text);
}

/* ───────────── births, growing up, leaving ───────────── */

function mother(s: SimState): Member | null {
  const p = peasant(s);
  const sp = spouse(s);
  if (!sp || !p.alive) return null;
  return p.sex === 'f' ? p : sp.sex === 'f' ? sp : null;
}

/** Once a day: conception, birth (with its dangers), and grown children leaving home. */
export function dailyFamily(s: SimState, info: DayInfo): Member[] {
  const day = info.dayIndex;
  const died: Member[] = [];
  const mum = mother(s);
  const kids = s.members.filter((m) => m.alive && m.role === 'child');
  if (s.family.pregnantSince !== null) {
    if (!mum) s.family.pregnantSince = null;
    else if (day - s.family.pregnantSince >= CONCEPTION.pregnancyDays) {
      s.family.pregnantSince = null;
      const sex = rand(s) < 0.5 ? 'm' : 'f';
      const names = sex === 'm' ? MALE_NAMES : FEMALE_NAMES;
      const name = names[Math.floor(rand(s) * names.length)]!;
      const child = member(`m${s.family.nextId++}`, name, 'child', sex, day);
      child.body.reserve = 50;
      s.members.push(child);
      log(s, 'family', `A ${sex === 'm' ? 'son' : 'daughter'} is born: ${name}. Baptised the same day, in case.`, [name]);
      note(s, `${name} born, ${info.year}.`);
      if (rand(s) < CONCEPTION.childbedDeath) {
        mum.body.health = 0;
        died.push(mum);
      }
    }
  } else if (mum && kids.length < CONCEPTION.maxChildren) {
    const a = ageOf(mum.bornDay, day);
    const baby = kids.some((k) => day - k.bornDay < DAYS_PER_YEAR);
    if (a >= CONCEPTION.minAge && a <= CONCEPTION.maxAge && !baby && rand(s) < CONCEPTION.daily) {
      s.family.pregnantSince = day;
      log(s, 'family', `${mum.name} is with child.`, [mum.name]);
    }
  }
  // A grown child who is not the heir may go into service or marry out.
  const heirKid = eldestChild(s);
  for (const k of kids) {
    if (k === heirKid || ageOf(k.bornDay, day) < ADULT_AGE + 2) continue;
    if (rand(s) < LEAVE_HOME_DAILY) {
      s.members.splice(s.members.indexOf(k), 1);
      const where = rand(s) < 0.5 ? 'into service at the manor' : 'to marry in the next parish';
      log(s, 'family', `${k.name} leaves home, ${where}.`, [k.name]);
      note(s, `${k.name} went ${where}, ${info.year}.`);
    }
  }
  return died;
}

export function eldestChild(s: SimState): Member | null {
  return s.members.filter((m) => m.alive && m.role === 'child').reduce<Member | null>((a, m) => (!a || m.bornDay < a.bornDay ? m : a), null);
}

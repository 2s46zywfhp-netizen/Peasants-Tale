import { NEW_MOON_REF_JDN, START_DAY, START_MONTH, START_YEAR, SYNODIC_MONTH_DAYS } from './balance';

export const BLOCK_NAMES = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'] as const;
export type BlockName = (typeof BLOCK_NAMES)[number];
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
export const MOON_PHASES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'] as const;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Feast =
  | 'ladyDay' | 'ashWednesday' | 'lent' | 'goodFriday' | 'easter' | 'ploughMonday' | 'mayDay' | 'midsummer'
  | 'lammas' | 'michaelmas' | 'martinmas' | 'christmas' | 'twelveDays' | 'epiphany';

/** Julian calendar date -> Julian Day Number. */
export function julianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
}

/** Julian Day Number -> Julian calendar date (civil year, beginning 1 January). */
export function jdnToJulian(jdn: number): { year: number; month: number; day: number } {
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

/** 0 = Sunday. */
export function weekdayOf(jdn: number): number {
  return (jdn + 1) % 7;
}

/** Easter Sunday in the Julian calendar (Meeus' Julian computus). */
export function easterJulian(year: number): { month: number; day: number } {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const f = d + e + 114;
  return { month: Math.floor(f / 31), day: (f % 31) + 1 };
}

/** The year number as reckoned in England: it increments on Lady Day, 25 March. */
export function ladyDayYear(year: number, month: number, day: number): number {
  return month < 3 || (month === 3 && day < 25) ? year - 1 : year;
}

export function seasonOf(month: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

/** Moon phase index 0..7 (0 = new, 4 = full) for the given day. */
export function moonPhaseOf(jdn: number): number {
  const age = (((jdn - NEW_MOON_REF_JDN) % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  return Math.floor((age / SYNODIC_MONTH_DAYS) * 8 + 0.5) % 8;
}

export const START_JDN = julianToJdn(START_YEAR, START_MONTH, START_DAY);

export interface DayInfo {
  /** Days since Lady Day 1345 (day 0). */
  dayIndex: number;
  jdn: number;
  year: number;
  month: number;
  day: number;
  /** Year number in Lady Day reckoning. */
  ladyYear: number;
  weekday: number;
  /** Days since 1 January of the civil year (0-based). */
  dayOfYear: number;
  season: Season;
  moon: number;
  feasts: readonly Feast[];
  isSunday: boolean;
  isFriday: boolean;
  isLent: boolean;
  /** Meat forbidden: Fridays and Lent. */
  isFastDay: boolean;
  /** No labour owed to the lord. */
  isHolyDay: boolean;
}

const easterJdnCache = new Map<number, number>();
function easterJdn(year: number): number {
  let v = easterJdnCache.get(year);
  if (v === undefined) {
    const e = easterJulian(year);
    v = julianToJdn(year, e.month, e.day);
    easterJdnCache.set(year, v);
  }
  return v;
}

/** First Monday after Twelfth Day (6 January). */
function ploughMondayJdn(year: number): number {
  const epiphany = julianToJdn(year, 1, 6);
  const wd = weekdayOf(epiphany);
  return epiphany + (wd === 1 ? 7 : (8 - wd) % 7);
}

export function feastsOn(jdn: number): Feast[] {
  const { year, month, day } = jdnToJulian(jdn);
  const out: Feast[] = [];
  const easter = easterJdn(year);
  if (month === 3 && day === 25) out.push('ladyDay');
  if (jdn === easter - 46) out.push('ashWednesday');
  if (jdn >= easter - 46 && jdn < easter) out.push('lent');
  if (jdn === easter - 2) out.push('goodFriday');
  if (jdn === easter) out.push('easter');
  if (jdn === ploughMondayJdn(year)) out.push('ploughMonday');
  if (month === 5 && day === 1) out.push('mayDay');
  if (month === 6 && day === 24) out.push('midsummer');
  if (month === 8 && day === 1) out.push('lammas');
  if (month === 9 && day === 29) out.push('michaelmas');
  if (month === 11 && day === 11) out.push('martinmas');
  if (month === 12 && day === 25) out.push('christmas');
  if ((month === 12 && day >= 25) || (month === 1 && day <= 5)) out.push('twelveDays');
  if (month === 1 && day === 6) out.push('epiphany');
  return out;
}

const NO_WORK: ReadonlySet<Feast> = new Set(['easter', 'goodFriday', 'christmas', 'twelveDays', 'epiphany', 'mayDay', 'midsummer']);

const dayCache = new Map<number, DayInfo>();

export function dayInfo(dayIndex: number): DayInfo {
  const cached = dayCache.get(dayIndex);
  if (cached) return cached;
  const jdn = START_JDN + dayIndex;
  const { year, month, day } = jdnToJulian(jdn);
  const weekday = weekdayOf(jdn);
  const feasts = feastsOn(jdn);
  const isLent = feasts.includes('lent');
  const info: DayInfo = {
    dayIndex,
    jdn,
    year,
    month,
    day,
    ladyYear: ladyDayYear(year, month, day),
    weekday,
    dayOfYear: jdn - julianToJdn(year, 1, 1),
    season: seasonOf(month),
    moon: moonPhaseOf(jdn),
    feasts,
    isSunday: weekday === 0,
    isFriday: weekday === 5,
    isLent,
    isFastDay: weekday === 5 || isLent,
    isHolyDay: weekday === 0 || feasts.some((f) => NO_WORK.has(f)),
  };
  if (dayCache.size > 4096) dayCache.clear();
  dayCache.set(dayIndex, info);
  return info;
}

/** Day index (since Lady Day 1345) of a Julian date. */
export function dayIndexOf(year: number, month: number, day: number): number {
  return julianToJdn(year, month, day) - START_JDN;
}

/** "MON 25 MAR 1345", with the year in Lady Day reckoning. */
export function formatDate(d: DayInfo, withWeekday = true): string {
  const date = `${String(d.day).padStart(2, '0')} ${MONTHS[d.month - 1]} ${d.ladyYear}`;
  return withWeekday ? `${WEEKDAYS[d.weekday]} ${date}` : date;
}

/** Is (month, day) inside the inclusive window [from, to]? Windows do not wrap the year. */
export function inWindow(month: number, day: number, from: readonly number[], to: readonly number[]): boolean {
  const v = month * 100 + day;
  return v >= from[0]! * 100 + from[1]! && v <= to[0]! * 100 + to[1]!;
}

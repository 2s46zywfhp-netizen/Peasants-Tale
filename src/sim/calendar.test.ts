import { describe, expect, it } from 'vitest';
import {
  dayIndexOf, dayInfo, easterJulian, feastsOn, formatDate, jdnToJulian, julianToJdn, ladyDayYear, moonPhaseOf, seasonOf, weekdayOf,
} from './calendar';

/**
 * Julian Easter 1345–1400, built from the classical (published) Julian paschal-full-moon table by golden number
 * (as printed in e.g. the Book of Common Prayer "Tables and Rules" and Wikipedia "Date of Easter"): Easter is the
 * first Sunday after the tabular full moon. Weekdays were taken independently via JS Date (proleptic Gregorian,
 * +8 days for the 14th century, +9 from March 1400). The same construction reproduces Cheney's Handbook of Dates (1288 → 28 March)
 * and Meeus' published Julian dates for 2008–2027. Julian Easter repeats on a 532-year cycle, so these are also
 * the dates of Bede's cycle for 813–868.
 */
const PUBLISHED_EASTER: Record<number, [number, number]> = {
  1345: [3, 27], 1346: [4, 16], 1347: [4, 1], 1348: [4, 20], 1349: [4, 12], 1350: [3, 28], 1351: [4, 17], 1352: [4, 8],
  1353: [3, 24], 1354: [4, 13], 1355: [4, 5], 1356: [4, 24], 1357: [4, 9], 1358: [4, 1], 1359: [4, 21], 1360: [4, 5],
  1361: [3, 28], 1362: [4, 17], 1363: [4, 2], 1364: [3, 24], 1365: [4, 13], 1366: [4, 5], 1367: [4, 18], 1368: [4, 9],
  1369: [4, 1], 1370: [4, 14], 1371: [4, 6], 1372: [3, 28], 1373: [4, 17], 1374: [4, 2], 1375: [4, 22], 1376: [4, 13],
  1377: [3, 29], 1378: [4, 18], 1379: [4, 10], 1380: [3, 25], 1381: [4, 14], 1382: [4, 6], 1383: [3, 22], 1384: [4, 10],
  1385: [4, 2], 1386: [4, 22], 1387: [4, 7], 1388: [3, 29], 1389: [4, 18], 1390: [4, 3], 1391: [3, 26], 1392: [4, 14],
  1393: [4, 6], 1394: [4, 19], 1395: [4, 11], 1396: [4, 2], 1397: [4, 22], 1398: [4, 7], 1399: [3, 30], 1400: [4, 18],
};

describe('Julian calendar', () => {
  it('round-trips JDN conversion across centuries', () => {
    for (let jdn = 2_150_000; jdn < 2_250_000; jdn += 37) {
      const d = jdnToJulian(jdn);
      expect(julianToJdn(d.year, d.month, d.day)).toBe(jdn);
    }
  });
  it('knows 29 February only in Julian leap years (every 4th year, incl. 1400)', () => {
    expect(jdnToJulian(julianToJdn(1348, 2, 29))).toEqual({ year: 1348, month: 2, day: 29 });
    expect(jdnToJulian(julianToJdn(1400, 2, 29))).toEqual({ year: 1400, month: 2, day: 29 });
    expect(jdnToJulian(julianToJdn(1345, 2, 29))).toEqual({ year: 1345, month: 3, day: 1 });
  });
  it('computes weekdays (Easter is always a Sunday; known anchor: 25 Mar 1345 was a Friday)', () => {
    expect(weekdayOf(julianToJdn(1345, 3, 25))).toBe(5);
    for (let y = 1345; y <= 1400; y++) {
      const e = easterJulian(y);
      expect(weekdayOf(julianToJdn(y, e.month, e.day))).toBe(0);
    }
  });
  it('increments the year number on Lady Day', () => {
    expect(ladyDayYear(1346, 3, 24)).toBe(1345);
    expect(ladyDayYear(1346, 3, 25)).toBe(1346);
    expect(ladyDayYear(1346, 1, 1)).toBe(1345);
    expect(dayInfo(dayIndexOf(1346, 2, 1)).ladyYear).toBe(1345);
    expect(formatDate(dayInfo(0))).toBe('FRI 25 MAR 1345');
  });
  it('maps seasons and moon phases', () => {
    expect([1, 4, 7, 10, 12].map(seasonOf)).toEqual(['winter', 'spring', 'summer', 'autumn', 'winter']);
    // Full moon of 21 Jan 2000 (JDN 2451565) and new moon of 6 Jan 2000.
    expect(moonPhaseOf(2451565)).toBe(4);
    expect(moonPhaseOf(2451550)).toBe(0);
    const phases = new Set(Array.from({ length: 30 }, (_, i) => dayInfo(i).moon));
    expect(phases.size).toBe(8);
  });
});

describe('Easter (acceptance 5)', () => {
  it('matches the published Julian Easter table for 1345–1400', () => {
    for (let y = 1345; y <= 1400; y++) {
      const e = easterJulian(y);
      expect([y, e.month, e.day]).toEqual([y, ...PUBLISHED_EASTER[y]!]);
    }
  });
  it('matches independent anchors (Cheney 1288; Meeus 2008, 2026)', () => {
    expect(easterJulian(1288)).toEqual({ month: 3, day: 28 });
    expect(easterJulian(2008)).toEqual({ month: 4, day: 14 });
    expect(easterJulian(2026)).toEqual({ month: 3, day: 30 });
  });
});

describe('liturgical calendar', () => {
  const on = (y: number, m: number, d: number) => feastsOn(julianToJdn(y, m, d));
  it('places fixed feasts', () => {
    expect(on(1345, 5, 1)).toContain('mayDay');
    expect(on(1345, 6, 24)).toContain('midsummer');
    expect(on(1345, 8, 1)).toContain('lammas');
    expect(on(1345, 9, 29)).toContain('michaelmas');
    expect(on(1345, 11, 11)).toContain('martinmas');
    expect(on(1345, 12, 25)).toEqual(expect.arrayContaining(['christmas', 'twelveDays']));
    expect(on(1346, 1, 5)).toContain('twelveDays');
    expect(on(1346, 1, 6)).toEqual(['epiphany']);
  });
  it('derives Lent, Ash Wednesday and Good Friday from Easter', () => {
    // Easter 1346 = 16 April -> Ash Wednesday 1 March, Good Friday 14 April.
    expect(on(1346, 3, 1)).toEqual(expect.arrayContaining(['ashWednesday', 'lent']));
    expect(on(1346, 2, 28)).not.toContain('lent');
    expect(on(1346, 4, 14)).toEqual(expect.arrayContaining(['goodFriday', 'lent']));
    expect(on(1346, 4, 15)).toContain('lent');
    expect(on(1346, 4, 16)).toEqual(['easter']);
  });
  it('puts Plough Monday on the first Monday after Twelfth Day', () => {
    for (const y of [1346, 1347, 1348, 1349, 1350, 1351, 1352]) {
      const days = Array.from({ length: 10 }, (_, i) => julianToJdn(y, 1, 7 + i)).filter((j) => feastsOn(j).includes('ploughMonday'));
      expect(days).toHaveLength(1);
      expect(weekdayOf(days[0]!)).toBe(1);
      expect(jdnToJulian(days[0]!).day).toBeLessThanOrEqual(13);
    }
  });
  it('flags Sundays, Fridays, fast days and holy days', () => {
    const i = dayInfo(0); // Friday 25 Mar 1345, in Lent (Easter 27 Mar)
    expect(i.isFriday && i.isFastDay && i.isLent).toBe(true);
    expect(i.feasts).toContain('ladyDay');
    const sunday = dayInfo(2);
    expect(sunday.isSunday && sunday.isHolyDay && sunday.feasts.includes('easter')).toBe(true);
  });
});

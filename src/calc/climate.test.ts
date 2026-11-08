import { describe, expect, it } from 'vitest';
import stationsFile from '../../data/ontario-climate.json';
import townsFile from '../../data/reference-towns.json';
import {
  buildProfile, deriveFromDaily, doyToMmDd, effectiveClimate, haversineKm, mmDdToDoy, normalizePostal,
  parseEcccNormals, townForPostal, zoneValue, type RefTown, type Station,
} from './climate';

const stations = stationsFile.records as Station[];
const towns = townsFile.records as RefTown[];

describe('climate helpers', () => {
  it('converts day-of-year both ways', () => {
    expect(doyToMmDd(137)).toBe('05-17');
    expect(doyToMmDd(274)).toBe('10-01');
    expect(mmDdToDoy('05-17')).toBe(137);
    for (let d = 1; d <= 365; d += 17) expect(mmDdToDoy(doyToMmDd(d))).toBe(d);
  });

  it('measures distance (Sudbury to North Bay ~ 125 km)', () => {
    expect(haversineKm(46.49, -80.99, 46.31, -79.46)).toBeGreaterThan(110);
    expect(haversineKm(46.49, -80.99, 46.31, -79.46)).toBeLessThan(130);
  });

  it('parses zones', () => {
    expect(zoneValue('3a')).toBe(3);
    expect(zoneValue('3b')).toBe(3.5);
    expect(zoneValue('0a')).toBe(0);
    expect(zoneValue('x')).toBeNaN();
  });

  it('normalizes postal codes', () => {
    expect(normalizePostal('p3e 2c6')).toBe('P3E2C6');
    expect(normalizePostal('P3E')).toBe('P3E');
    expect(normalizePostal('12345')).toBeNull();
  });

  it('maps postal codes to towns', () => {
    expect(townForPostal('P3E 2C6', towns)?.town.name).toBe('Sudbury');
    expect(townForPostal('P7B 5E1', towns)?.town.name).toBe('Thunder Bay');
    expect(townForPostal('M5V 3L9', towns)).toEqual({ town: expect.objectContaining({ name: 'Toronto' }), exact: false });
    expect(townForPostal('Z9Z', towns)).toBeNull();
  });
});

describe('bundled Ontario data', () => {
  it('has northern stations with sane values', () => {
    const north = stations.filter((s) => s.lat > 46);
    expect(north.length).toBeGreaterThan(15);
    for (const s of stations) {
      expect(s.frostFreeDays!).toBeGreaterThan(30);
      expect(s.frostFreeDays!).toBeLessThan(220);
      expect(s.lastFrostDoy!).toBeLessThan(s.firstFrostDoy!);
    }
  });

  it('every town has a valid zone and a design low below 0', () => {
    for (const t of towns) {
      expect(zoneValue(t.zone)).not.toBeNaN();
      expect(t.designLowC).toBeLessThan(0);
    }
  });

  it('builds a Sudbury profile from coordinates', () => {
    const p = buildProfile(46.49, -80.99, { kind: 'latlon', value: '' }, stations, towns);
    expect(p.townName).toBe('Sudbury');
    expect(p.stationName).toMatch(/Sudbury/);
    const c = effectiveClimate(p);
    expect(c.zone).toBe('4a');
    expect(c.designLowC).toBe(-28);
    expect(c.frostFreeDays).toBeGreaterThan(100);
    expect(c.snowMonths).toContain(1);
  });

  it('northern locations get shorter seasons than southern ones', () => {
    const kap = effectiveClimate(buildProfile(49.41, -82.43, { kind: 'latlon', value: '' }, stations, towns));
    const tor = effectiveClimate(buildProfile(43.65, -79.38, { kind: 'latlon', value: '' }, stations, towns));
    expect(kap.frostFreeDays).toBeLessThan(tor.frostFreeDays);
    expect(kap.hdd).toBeGreaterThan(tor.hdd);
  });

  it('user overrides win over derived values', () => {
    const p = buildProfile(46.49, -80.99, { kind: 'latlon', value: '' }, stations, towns);
    p.overrides = { frostFreeDays: 90, zone: '3b' };
    expect(effectiveClimate(p).frostFreeDays).toBe(90);
    expect(effectiveClimate(p).zone).toBe('3b');
  });
});

describe('ECCC normals parsing', () => {
  it('extracts frost dates, precip, HDD and snow months', () => {
    const rows = [
      { NORMAL_ID: 13, MONTH: 13, VALUE: 137 },
      { NORMAL_ID: 14, MONTH: 13, VALUE: 274 },
      { NORMAL_ID: 21, MONTH: 13, VALUE: 136 },
      { NORMAL_ID: 56, MONTH: 13, VALUE: 903.27 },
      { NORMAL_ID: 32, MONTH: 13, VALUE: 5194.6 },
      { NORMAL_ID: 1, MONTH: 1, VALUE: -12.84 },
      { NORMAL_ID: 76, MONTH: 1, VALUE: 31 },
      { NORMAL_ID: 76, MONTH: 4, VALUE: 10 },
      { NORMAL_ID: 76, MONTH: 12, VALUE: 27.6 },
    ];
    expect(parseEcccNormals(rows)).toMatchObject({
      lastFrostDoy: 137, firstFrostDoy: 274, frostFreeDays: 136, annualPrecipMm: 903, hdd: 5195, janMeanC: -12.8, snowMonths: [1, 12],
    });
  });
});

describe('Open-Meteo daily derivation', () => {
  function year(y: number, lastFrostDoy: number, firstFrostDoy: number) {
    const time: string[] = [], tmin: number[] = [], tmean: number[] = [], precip: number[] = [], snow: number[] = [];
    for (let d = 1; d <= 365; d++) {
      time.push(`${y}-${doyToMmDd(d)}`);
      const frost = d <= lastFrostDoy || d >= firstFrostDoy;
      tmin.push(d <= 31 ? -30 + (d % 10) : frost ? -2 : 8);
      tmean.push(frost ? -8 : 15);
      precip.push(2);
      snow.push(d <= 90 || d >= 330 ? 0.3 : 0);
    }
    return { time, tmin, tmean, precip, snow };
  }
  it('averages frost dates over full years', () => {
    const a = year(2021, 140, 260), b = year(2022, 150, 270);
    const r = deriveFromDaily({
      time: [...a.time, ...b.time], tmin: [...a.tmin, ...b.tmin], tmean: [...a.tmean, ...b.tmean],
      precip: [...a.precip, ...b.precip], snowDepthM: [...a.snow, ...b.snow],
    });
    expect(r.years).toBe(2);
    expect(r.lastFrost).toBe(doyToMmDd(145));
    expect(r.firstFrost).toBe(doyToMmDd(265));
    expect(r.frostFreeDays).toBe(119);
    expect(r.annualPrecipMm).toBe(730);
    expect(r.designLowC).toBeLessThanOrEqual(-29);
    expect(r.snowMonths).toEqual([1, 2, 3, 12]);
  });
  it('ignores partial years', () => {
    expect(deriveFromDaily({ time: ['2020-01-01'], tmin: [-5], tmean: [-5], precip: [0], snowDepthM: [0] }).years).toBe(0);
  });
});

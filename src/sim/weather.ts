import { FOG_CHANCE, RAIN_CHANCE, STORM_SHARE, WEATHER } from './balance';
import { dayInfo, type Season } from './calendar';
import { Rng } from './rng';

export type Sky = 'fair' | 'cloud' | 'fog' | 'rain' | 'storm' | 'snow';

export interface Weather {
  tempC: number;
  sky: Sky;
  /** Effect on growing crops this day, roughly -1..1. */
  cropQuality: number;
  /** Morale change applied once at dawn. */
  morale: number;
}

const CROP: Record<Season, Partial<Record<Sky, number>>> = {
  spring: { fair: 0.3, cloud: 0.1, rain: 0.4, storm: -0.6, snow: -0.4, fog: 0 },
  summer: { fair: 0.4, cloud: 0.1, rain: 0.1, storm: -0.8, fog: 0 },
  autumn: { fair: 0.2, cloud: 0, rain: -0.1, storm: -0.6, snow: -0.2, fog: 0 },
  winter: { fair: 0.1, cloud: 0, rain: 0, storm: -0.3, snow: 0.1, fog: 0 },
};
const MORALE: Record<Sky, number> = { fair: 2, cloud: 0, fog: -1, rain: -1, storm: -4, snow: -2 };

/**
 * Daily weather. Seeded by (seed, day) alone, so it never consumes the main PRNG stream:
 * the same life always has the same weather whatever the player does.
 */
export function weatherFor(seed: number, dayIndex: number): Weather {
  const rng = new Rng((seed ^ Math.imul(dayIndex + 1, 0x9e3779b1)) >>> 0);
  rng.next();
  const info = dayInfo(dayIndex);
  const base = WEATHER.meanC + WEATHER.amplitudeC * Math.sin((2 * Math.PI * (info.dayOfYear - WEATHER.phaseDays)) / 365);
  const tempC = Math.round((base + (rng.next() * 2 - 1) * WEATHER.noiseC) * 10) / 10;
  const wet = rng.next() < RAIN_CHANCE[info.season];
  let sky: Sky;
  if (wet) sky = tempC < 1 ? 'snow' : rng.next() < STORM_SHARE ? 'storm' : 'rain';
  else sky = rng.next() < FOG_CHANCE ? 'fog' : rng.next() < 0.5 ? 'fair' : 'cloud';
  return { tempC, sky, cropQuality: CROP[info.season][sky] ?? 0, morale: MORALE[sky] };
}

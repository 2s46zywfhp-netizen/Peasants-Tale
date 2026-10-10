import { describe, expect, it } from 'vitest';
import { dayIndexOf, dayInfo } from '../sim/calendar';
import { ATLAS, atlasRgba } from './atlas';
import { PALETTE, hexToRgb, worldRemap, type Remap } from './palette';
import { particleCount, setWeather } from './weather';
import { isPlagueYear } from './world';

/** Mean luminance and share of reddish pixels over every opaque pixel of the atlas. */
function stats(r: Remap): { luma: number; red: number; px: Uint8ClampedArray } {
  const px = atlasRgba(ATLAS, r);
  let l = 0;
  let red = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    n++;
    l += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    if (px[i]! > px[i + 1]! + 40 && px[i]! > px[i + 2]! + 40) red++;
  }
  return { luma: l / n, red: red / n, px };
}

function differing(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let d = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    n++;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) d++;
  }
  return d / n;
}

const MIDDAY = 2;

describe('acceptance 4: seasons, day/night, weather and moon visibly change', () => {
  it('each season repaints a large share of the art', () => {
    const seasons = (['spring', 'summer', 'autumn', 'winter'] as const).map((s) => stats(worldRemap(s, false, MIDDAY, false)).px);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(differing(seasons[i]!, seasons[j]!)).toBeGreaterThan(0.1);
  });
  it('night is much darker than midday, dusk is redder, dawn sits between', () => {
    const day = stats(worldRemap('spring', false, MIDDAY, false));
    const night = stats(worldRemap('spring', false, 5, false));
    const dusk = stats(worldRemap('spring', false, 4, false));
    const dawn = stats(worldRemap('spring', false, 0, false));
    expect(night.luma).toBeLessThan(day.luma * 0.6);
    expect(dusk.red).toBeGreaterThan(day.red * 2);
    expect(dawn.luma).toBeLessThan(day.luma);
    expect(dawn.luma).toBeGreaterThan(night.luma);
    // Hearth and candle light ignore the night.
    expect(stats(worldRemap('spring', false, 5, false, true)).luma).toBeCloseTo(day.luma, 5);
  });
  it('plague years tint the world', () => {
    expect(isPlagueYear(1349) && !isPlagueYear(1346)).toBe(true);
    const clean = stats(worldRemap('summer', false, MIDDAY, false)).px;
    const plague = stats(worldRemap('summer', true, MIDDAY, false)).px;
    expect(differing(clean, plague)).toBeGreaterThan(0.1);
  });
  it('DMG mode collapses everything to four shades', () => {
    const { px } = stats(worldRemap('autumn', false, MIDDAY, true));
    const colours = new Set<string>();
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]) colours.add(`${px[i]},${px[i + 1]},${px[i + 2]}`);
    expect(colours.size).toBeLessThanOrEqual(4);
    const pal = new Set(PALETTE.map((h) => hexToRgb(h).join(',')));
    for (const c of colours) expect(pal.has(c)).toBe(true);
  });
  it('weather particles follow the sim weather', () => {
    setWeather('rain', 'spring', true);
    const rain = particleCount();
    setWeather('storm', 'spring', true);
    const storm = particleCount();
    setWeather('snow', 'winter', true);
    const snow = particleCount();
    setWeather('fair', 'autumn', true);
    const leaves = particleCount();
    setWeather('fair', 'spring', true);
    const clear = particleCount();
    setWeather('rain', 'spring', false);
    const indoors = particleCount();
    expect(rain).toBeGreaterThan(0);
    expect(storm).toBeGreaterThan(rain);
    expect(snow).toBeGreaterThan(0);
    expect(leaves).toBeGreaterThan(0);
    expect(clear).toBe(0);
    expect(indoors).toBe(0);
  });
  it('the moon follows the calendar through all eight phases in a month', () => {
    const start = dayIndexOf(1345, 4, 1);
    const phases = Array.from({ length: 30 }, (_, i) => dayInfo(start + i).moon);
    expect(new Set(phases).size).toBe(8);
    // Phases advance in order (allowing for wrap-around).
    for (let i = 1; i < phases.length; i++) expect((phases[i]! - phases[i - 1]! + 8) % 8).toBeLessThanOrEqual(1);
  });
});

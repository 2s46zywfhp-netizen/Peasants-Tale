import { describe, expect, it } from 'vitest';
import { dayIndexOf } from './calendar';
import { weatherFor } from './weather';

describe('weather', () => {
  it('is deterministic per seed and day, and varies by seed', () => {
    expect(weatherFor(5, 100)).toEqual(weatherFor(5, 100));
    const a = Array.from({ length: 30 }, (_, d) => weatherFor(5, d).tempC);
    const b = Array.from({ length: 30 }, (_, d) => weatherFor(6, d).tempC);
    expect(a).not.toEqual(b);
  });
  it('is season-driven: July is warmer than January, and snow only falls in the cold', () => {
    const avg = (m: number) => {
      let t = 0;
      for (let y = 1346; y < 1356; y++) for (let d = 1; d <= 28; d++) t += weatherFor(1, dayIndexOf(y, m, d)).tempC;
      return t / 280;
    };
    expect(avg(7) - avg(1)).toBeGreaterThan(10);
    for (let d = 0; d < 3650; d++) {
      const w = weatherFor(9, d);
      if (w.sky === 'snow') expect(w.tempC).toBeLessThan(1);
    }
  });
  it('affects crops and morale (storms are bad)', () => {
    let storm = null;
    for (let d = 0; d < 3650 && !storm; d++) if (weatherFor(3, d).sky === 'storm') storm = weatherFor(3, d);
    expect(storm!.cropQuality).toBeLessThan(0);
    expect(storm!.morale).toBeLessThan(0);
  });
});

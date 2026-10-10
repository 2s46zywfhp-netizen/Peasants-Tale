import { describe, expect, it } from 'vitest';
import { Rng, mulberry32Next } from './rng';

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('matches the reference first value for seed 1', () => {
    expect(mulberry32Next(1).value).toBeCloseTo(0.6270739405881613, 12);
  });
});

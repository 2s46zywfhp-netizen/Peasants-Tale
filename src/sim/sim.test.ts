import { describe, expect, it } from 'vitest';
import { MAX_CATCHUP_BLOCKS, SIM_BLOCK_MS } from './balance';
import { Rng, mulberry32Next } from './rng';
import { advance, createSim, gameClock } from './sim';

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

describe('advance', () => {
  const t0 = 1_700_000_000_000;
  it('runs whole blocks only', () => {
    const s = createSim(7, t0);
    expect(advance(s, t0 + SIM_BLOCK_MS - 1).blocksRun).toBe(0);
    const r = advance(s, t0 + SIM_BLOCK_MS * 3 + 5);
    expect(r.blocksRun).toBe(3);
    expect(r.state.processedTo).toBe(t0 + SIM_BLOCK_MS * 3);
    expect(s.blocks).toBe(0); // input not mutated
  });
  it('is the same whether advanced in one go or many', () => {
    const s = createSim(99, t0);
    let step = s;
    for (let i = 1; i <= 50; i++) step = advance(step, t0 + i * SIM_BLOCK_MS).state;
    expect(advance(s, t0 + 50 * SIM_BLOCK_MS).state).toEqual(step);
  });
  it('caps catch-up work but keeps the block count honest', () => {
    const s = createSim(1, t0);
    const r = advance(s, t0 + (MAX_CATCHUP_BLOCKS + 500) * SIM_BLOCK_MS);
    expect(r.blocksRun).toBe(MAX_CATCHUP_BLOCKS);
    expect(r.state.blocks).toBe(MAX_CATCHUP_BLOCKS + 500);
  });
  it('ignores time going backwards', () => {
    const s = createSim(1, t0);
    expect(advance(s, t0 - 10_000)).toEqual({ state: s, blocksRun: 0 });
  });
});

describe('gameClock', () => {
  it('starts on Lady Day 1345 at dawn and follows real time', () => {
    const s = createSim(1, 0);
    expect(gameClock(s, 0)).toMatchObject({ year: 1345, month: 3, day: 25, hour: 6, minute: 0, dayOfLife: 1 });
    const later = gameClock(s, (18 * 60 + 30) * 60_000);
    expect(later).toMatchObject({ month: 3, day: 26, hour: 0, minute: 30, dayOfLife: 2 });
  });
});

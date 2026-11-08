import { describe, expect, it } from 'vitest';
import { calcSeeds, evaluateAnnual, evaluatePerennial } from './seeds';
import { seedsAnnual, seedsPerennial } from './ref';
import type { Climate } from './climate';

const base: Climate = { zone: '4a', lastFrost: '05-17', firstFrost: '10-01', frostFreeDays: 136, designLowC: -28, annualPrecipMm: 900, snowMonths: [12, 1, 2, 3], hdd: 5200, janMeanC: -13 };
const kap: Climate = { ...base, zone: '2b', lastFrost: '06-05', firstFrost: '09-15', frostFreeDays: 101, designLowC: -34 };
const seed = (id: string) => seedsAnnual.find((s) => s.id === id)!;
const per = (id: string) => seedsPerennial.find((s) => s.id === id)!;

describe('annual seed filter', () => {
  it('fast crops are good everywhere', () => {
    expect(evaluateAnnual(seed('radish-cherry-belle'), kap).status).toBe('good');
    expect(evaluateAnnual(seed('bean-provider'), kap).status).toBe('good');
  });
  it('tender crops: plant after last frost, harvest before first frost', () => {
    const r = evaluateAnnual(seed('bean-provider'), base);
    expect(r.plantOut).toBe('05-24');
    expect(r.harvest).toBe('07-13');
    expect(r.sowing).toBe('direct');
  });
  it('transplants get an indoor start date', () => {
    const r = evaluateAnnual(seed('tomato-glacier'), base);
    expect(r.sowing).toBe('indoors');
    expect(r.indoorStart).toBe('04-05'); // 7 weeks before May 24
  });
  it('long-season crops are skipped in short seasons', () => {
    expect(evaluateAnnual(seed('sweet-potato'), kap).status).toBe('skip');
    expect(evaluateAnnual(seed('squash-butternut'), kap).status).not.toBe('good');
  });
  it('heat-loving crops are skipped when frost-free days are short', () => {
    const r = evaluateAnnual(seed('okra-clemson'), kap);
    expect(r.status).toBe('skip');
    expect(r.reason).toMatch(/hot season/);
  });
  it('borderline crops are marginal and flagged for row cover', () => {
    const r = evaluateAnnual(seed('corn-painted-mountain'), kap);
    expect(r.status).toBe('marginal');
    expect(r.needsCover).toBe(true);
  });
  it('hardy crops use the extended fall season', () => {
    const r = evaluateAnnual(seed('parsnip-hollow-crown'), kap);
    expect(r.status).not.toBe('skip');
  });
  it('a longer season never makes a crop worse', () => {
    const order = { good: 0, marginal: 1, skip: 2 };
    for (const s of seedsAnnual) expect(order[evaluateAnnual(s, base).status]).toBeLessThanOrEqual(order[evaluateAnnual(s, kap).status]);
  });
  it('reports calorie yield', () => {
    const r = evaluateAnnual(seed('potato-yukon'), base);
    expect(r.kcalPer10m2).toBe(30 * 10 * 77);
  });
  it('garlic is fall planted', () => {
    expect(evaluateAnnual(seed('garlic-music'), kap).sowing).toBe('fall');
  });
});

describe('perennials by zone', () => {
  it('good, marginal and skip by zone', () => {
    expect(evaluatePerennial(per('haskap'), kap).status).toBe('good');
    expect(evaluatePerennial(per('apple-norland'), kap).status).toBe('marginal');
    expect(evaluatePerennial(per('apple-honeycrisp'), kap).status).toBe('skip');
    expect(evaluatePerennial(per('apple-honeycrisp'), base).status).toBe('marginal');
    expect(evaluatePerennial(per('peach-reliance'), base).status).toBe('skip');
  });
  it('every perennial has pollination info and fruit trees name a rootstock', () => {
    for (const p of seedsPerennial) {
      expect(p.pollination).toBeTruthy();
      if (p.pollination === 'needs partner') expect(p.pollinatorPartner).toBeTruthy();
      if (p.type === 'fruit tree' && !['crabapple-dolgo', 'mulberry', 'cherry-stella'].includes(p.id)) expect(p.rootstock).toBeTruthy();
    }
  });
});

describe('seed plan', () => {
  it('is open-pollinated only by default', () => {
    expect(calcSeeds(base).annuals.every((r) => r.seed.openPollinated)).toBe(true);
  });
  it('builds a skip list and row cover advice for the north', () => {
    const r = calcSeeds(kap);
    expect(r.skip.some((s) => /Sweet potato/.test(s.name))).toBe(true);
    expect(r.skip.some((s) => /Peach/.test(s.name))).toBe(true);
    expect(r.coverRecommendations.some((t) => /row cover/i.test(t))).toBe(true);
    expect(r.coverRecommendations.some((t) => /low tunnels/.test(t))).toBe(true);
  });
  it('a southern climate has fewer skips', () => {
    const tor: Climate = { ...base, zone: '6a', lastFrost: '05-05', firstFrost: '10-15', frostFreeDays: 163 };
    expect(calcSeeds(tor).skip.length).toBeLessThan(calcSeeds(kap).skip.length);
  });
});

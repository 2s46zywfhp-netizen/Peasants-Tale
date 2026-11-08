import { describe, expect, it } from 'vitest';
import { calcAmmo, filterByRole, rankItems } from './hunting';
import { huntingItems, sources } from './ref';
import { defaultPlan } from './plan';

describe('hunting ranking', () => {
  it('lists prohibited items and never hides them', () => {
    expect(rankItems(huntingItems, false).length).toBe(huntingItems.length);
    expect(rankItems(huntingItems, true).length).toBe(huntingItems.length);
    expect(huntingItems.some((i) => i.legal.status === 'prohibited')).toBe(true);
  });
  it('normal mode puts legally acquirable items first', () => {
    const r = rankItems(huntingItems, false);
    const firstBlocked = r.findIndex((i) => !i.legal.acquirableNow);
    expect(r.slice(firstBlocked).every((i) => !i.legal.acquirableNow)).toBe(true);
  });
  it('collapse mode ranks by utility only', () => {
    const r = rankItems(huntingItems, true);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].utility).toBeGreaterThanOrEqual(r[i].utility);
    const net = r.findIndex((i) => i.id === 'fish-gillnet');
    const handline = r.findIndex((i) => i.id === 'fish-handline');
    expect(net).toBeLessThan(handline);
    expect(rankItems(huntingItems, false).findIndex((i) => i.id === 'fish-gillnet')).toBeGreaterThan(rankItems(huntingItems, false).findIndex((i) => i.id === 'fish-handline'));
  });
  it('filters by role', () => {
    expect(filterByRole(huntingItems, 'trapline').every((i) => i.roles.includes('trapline'))).toBe(true);
  });
  it('every item has a full legal label and known sources', () => {
    const ids = new Set(sources.map((s) => s.id));
    for (const i of huntingItems) {
      expect(['legal', 'pal', 'rpal', 'prohibited', 'licence-to-use']).toContain(i.legal.status);
      expect(i.legal.consequence.length).toBeGreaterThan(5);
      for (const s of i.legal.sources) expect(ids.has(s)).toBe(true);
    }
  });
  it('flags the short/one-hand crossbow as prohibited', () => {
    expect(huntingItems.find((i) => i.id === 'crossbow-prohibited')!.legal.status).toBe('prohibited');
  });
  it('firearms carry role, range, cartridge, ammo availability, weight and cold rating', () => {
    for (const f of huntingItems.filter((i) => i.category === 'firearm')) {
      expect(f.cartridge && f.effectiveRangeM && f.ammoAvailability && f.weightKg && f.coldReliability).toBeTruthy();
    }
  });
});

describe('ammo planning', () => {
  it('scales by role and duration', () => {
    const one = calcAmmo({ ...defaultPlan(), durationPreset: '1y', huntingRoles: ['small-game'] });
    const three = calcAmmo({ ...defaultPlan(), durationPreset: '3y', huntingRoles: ['small-game'] });
    expect(one[0].rounds).toBe(2000);
    expect(three[0].rounds).toBe(4000);
    expect(one[0].packs).toBe(4);
  });
  it('only plans selected roles', () => {
    expect(calcAmmo({ ...defaultPlan(), huntingRoles: [] })).toEqual([]);
  });
});

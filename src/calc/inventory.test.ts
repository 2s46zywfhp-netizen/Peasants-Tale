import { describe, expect, it } from 'vitest';
import { addMonths, alerts, daysBetween, effectiveExpiry, fifoGroups, progress, rotationDue, useThisMonth } from './inventory';
import { buildTargets, type Target } from './targets';
import { defaultPlan } from './plan';
import type { InventoryItem } from '../db/types';

const T: Target[] = [
  { id: 'food:rice', group: 'Food', category: 'Grains', name: 'White rice', qty: 100, unit: 'kg', shelfLifeYears: 25, rotationMonths: 0 },
  { id: 'food:oil', group: 'Food', category: 'Fats', name: 'Canola oil', qty: 10, unit: '3 L jug', shelfLifeYears: 1.5, rotationMonths: 12 },
  { id: 'water:stored', group: 'Water', category: 'Stored', name: 'Stored water', qty: 100, unit: 'L', shelfLifeYears: 0.5, rotationMonths: 6 },
];
const lot = (o: Partial<InventoryItem>): InventoryItem => ({ name: 'x', category: 'Food', quantity: 1, unit: 'kg', createdAt: '', updatedAt: '', ...o });
const today = '2026-11-08';

describe('dates', () => {
  it('adds months safely at month ends', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-08', 18)).toBe('2028-05-08');
    expect(daysBetween('2026-11-08', '2026-12-08')).toBe(30);
  });
  it('printed expiry wins over estimate', () => {
    expect(effectiveExpiry(lot({ expiresOn: '2027-01-01', acquiredOn: '2026-01-01' }), T[1])).toEqual({ date: '2027-01-01', estimated: false });
    expect(effectiveExpiry(lot({ acquiredOn: '2026-01-01' }), T[1])).toEqual({ date: '2027-07-01', estimated: true });
    expect(effectiveExpiry(lot({}), T[1])).toBeNull();
  });
  it('rotation due from acquired date', () => {
    expect(rotationDue(lot({ acquiredOn: '2026-01-15' }), T[1])).toBe('2027-01-15');
    expect(rotationDue(lot({ acquiredOn: '2026-01-15' }), T[0])).toBeNull();
  });
});

describe('progress', () => {
  it('sums lots per target, caps at 100 %, averages per group', () => {
    const items = [lot({ targetId: 'food:rice', quantity: 40 }), lot({ targetId: 'food:rice', quantity: 30 }), lot({ targetId: 'food:oil', quantity: 20 })];
    const g = progress(T, items);
    const food = g.find((x) => x.group === 'Food')!;
    expect(food.targets.find((t) => t.target.id === 'food:rice')!.onHand).toBe(70);
    expect(food.targets.find((t) => t.target.id === 'food:oil')!.pct).toBe(1);
    expect(food.pct).toBeCloseTo((0.7 + 1) / 2);
    expect(food.complete).toBe(1);
    expect(g.find((x) => x.group === 'Water')!.pct).toBe(0);
  });
  it('ignores unlinked items', () => {
    expect(progress(T, [lot({ quantity: 999 })])[0].pct).toBe(0);
  });
});

describe('alerts', () => {
  const items = [
    lot({ id: 1, name: 'old oil', targetId: 'food:oil', expiresOn: '2026-10-01' }),
    lot({ id: 2, name: 'oil soon', targetId: 'food:oil', expiresOn: '2026-11-20' }),
    lot({ id: 3, name: 'oil later', targetId: 'food:oil', expiresOn: '2027-06-01' }),
    lot({ id: 4, name: 'water', targetId: 'water:stored', acquiredOn: '2026-05-01', quantity: 40 }),
    lot({ id: 5, name: 'rice', targetId: 'food:rice', acquiredOn: '2026-01-01' }),
    lot({ id: 6, name: 'used up', targetId: 'food:oil', expiresOn: '2026-10-01', quantity: 0 }),
  ];
  it('finds expired, expiring and rotation-due lots, soonest first', () => {
    const a = alerts(items, T, today);
    expect(a.map((x) => [x.item.id, x.kind])).toEqual([[1, 'expired'], [4, 'expired'], [2, 'expiring']]);
  });
  it('rotation alerts when there is no expiry in the window', () => {
    const a = alerts([lot({ id: 9, targetId: 'food:oil', acquiredOn: '2025-11-20', expiresOn: '2027-12-01' })], T, today);
    expect(a[0].kind).toBe('rotate');
  });
  it('use-this-month is the 30-day window', () => {
    expect(useThisMonth(items, T, today).length).toBe(3);
  });
  it('skips empty lots', () => {
    expect(alerts(items, T, today).some((x) => x.item.id === 6)).toBe(false);
  });
});

describe('FIFO', () => {
  it('orders lots by expiry so the oldest is used first', () => {
    const items = [
      lot({ id: 1, targetId: 'food:oil', expiresOn: '2027-06-01' }),
      lot({ id: 2, targetId: 'food:oil', expiresOn: '2026-12-01' }),
      lot({ id: 3, targetId: 'food:rice', acquiredOn: '2026-01-01' }),
    ];
    const g = fifoGroups(items, T);
    expect(g).toHaveLength(1);
    expect(g[0].lots.map((l) => l.item.id)).toEqual([2, 1]);
  });
  it('groups unlinked items by name', () => {
    expect(fifoGroups([lot({ name: 'Matches' }), lot({ name: 'matches ' })], T)).toHaveLength(1);
  });
});

describe('targets from the plan', () => {
  it('builds food, water and supplies targets; ammo only with hunting on', () => {
    const t = buildTargets({ ...defaultPlan(), durationPreset: '1y' }, null);
    expect(t.some((x) => x.id === 'food:white-rice' && x.unit === 'kg')).toBe(true);
    expect(t.some((x) => x.id === 'water:stored')).toBe(true);
    expect(t.some((x) => x.group === 'Ammo')).toBe(false);
    expect(buildTargets({ ...defaultPlan(), huntingEnabled: true }, null).some((x) => x.group === 'Ammo')).toBe(true);
    expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
  });
});

/** Turns the generated prep lists into stock targets that inventory lots can count toward. */
import type { Climate } from './climate';
import { calcFood } from './food';
import { calcWater } from './water';
import { calcSupplies } from './supplies';
import { calcAmmo } from './hunting';
import type { Plan } from './plan';

export type TargetGroup = 'Food' | 'Water' | 'Supplies' | 'Ammo';
export const GROUPS: TargetGroup[] = ['Food', 'Water', 'Supplies', 'Ammo'];

export interface Target {
  id: string;
  group: TargetGroup;
  category: string;
  name: string;
  qty: number;
  unit: string;
  shelfLifeYears: number;
  rotationMonths: number;
}

export function buildTargets(plan: Plan, climate: Climate | null): Target[] {
  const out: Target[] = [];
  const food = calcFood(plan, climate);
  for (const c of food.categories) {
    for (const l of c.lines) {
      const byKg = l.unitLabel === 'kg';
      out.push({ id: `food:${l.id}`, group: 'Food', category: c.label, name: l.name, qty: byKg ? l.kg : l.units, unit: byKg ? 'kg' : l.unitLabel, shelfLifeYears: l.shelfLifeYears, rotationMonths: l.rotationMonths });
    }
  }
  const water = calcWater(plan, climate);
  out.push({ id: 'water:stored', group: 'Water', category: 'Stored water', name: 'Stored drinking water', qty: water.storedL, unit: 'L', shelfLifeYears: 0.5, rotationMonths: 6 });
  for (const l of water.lines) out.push({ id: `water:${l.id}`, group: 'Water', category: 'Purification', name: l.name, qty: l.qty, unit: l.unit, shelfLifeYears: l.shelfLifeYears ?? 0, rotationMonths: l.rotationMonths ?? 0 });
  const sup = calcSupplies(plan, climate);
  for (const g of sup.categories) for (const l of g.lines) out.push({ id: `supplies:${l.id}`, group: 'Supplies', category: g.id, name: l.name, qty: l.qty, unit: l.unit, shelfLifeYears: l.shelfLifeYears, rotationMonths: l.rotationMonths });
  if (plan.huntingEnabled) {
    for (const a of calcAmmo(plan)) out.push({ id: `ammo:${a.role}`, group: 'Ammo', category: a.label, name: `${a.cartridge}`, qty: a.rounds, unit: 'rounds', shelfLifeYears: a.shelfLifeYears, rotationMonths: 0 });
  }
  return out;
}

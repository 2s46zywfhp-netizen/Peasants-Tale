import { describe, expect, it } from 'vitest';
import { calcFood, personKcal, petKcalPerDay } from './food';
import { defaultPlan, type Plan } from './plan';
import { assumptions, foodShares } from './ref';
import type { Climate } from './climate';

const climate: Climate = { zone: '4a', lastFrost: '05-17', firstFrost: '10-01', frostFreeDays: 136, designLowC: -28, annualPrecipMm: 900, snowMonths: [1, 2, 3, 12], hdd: 5200, janMeanC: -13 };
const adult = (over: Partial<Plan['people'][0]> = {}) => ({ id: 'a', name: 'A', age: 'adult19-50' as const, sex: 'male' as const, activity: 'moderate' as const, ...over });
const plan = (over: Partial<Plan> = {}): Plan => ({ ...defaultPlan(), ...over });

describe('energy needs', () => {
  it('a male + female moderate adult average the 2400 kcal default', () => {
    const m = personKcal(adult(), { coldLabour: false });
    const f = personKcal(adult({ sex: 'female' }), { coldLabour: false });
    expect((m + f) / 2).toBe(2400);
  });
  it('cold-weather labour adds 25 %', () => {
    expect(personKcal(adult(), { coldLabour: true })).toBe(Math.round(2700 * 1.25));
  });
  it('activity and age change needs', () => {
    expect(personKcal(adult({ activity: 'low' }), { coldLabour: false })).toBeLessThan(2700);
    expect(personKcal(adult({ activity: 'high' }), { coldLabour: false })).toBeGreaterThan(2700);
    expect(personKcal(adult({ age: 'child4-8' }), { coldLabour: false })).toBe(1500);
  });
  it('manual override wins (and still gets the cold bump)', () => {
    expect(personKcal(adult({ kcalOverride: 3000 }), { coldLabour: false })).toBe(3000);
    expect(personKcal(adult({ kcalOverride: 3000 }), { coldLabour: true })).toBe(3750);
  });
  it('pet energy follows metabolic body weight', () => {
    expect(petKcalPerDay('dog', 30, assumptions)).toBe(Math.round(1.6 * 70 * Math.pow(30, 0.75)));
  });
});

describe('food calculator', () => {
  it('category shares add up to 100 %', () => {
    expect(foodShares.reduce((s, x) => s + x.long, 0)).toBeCloseTo(1, 5);
    expect(foodShares.reduce((s, x) => s + x.short, 0)).toBeCloseTo(1, 5);
  });

  it('1 year for 2 adults meets the calorie target without overshooting much', () => {
    const r = calcFood(plan({ durationPreset: '1y' }), climate);
    expect(r.targetKcalPerDay).toBe(4800);
    expect(r.achievedKcalPerDay).toBeGreaterThanOrEqual(4800);
    expect(r.achievedKcalPerDay).toBeLessThan(4800 * 1.12);
    expect(r.achievedKcalPerPersonDay).toBe(Math.round(r.achievedKcalPerDay / 2));
  });

  it('quantities scale linearly with duration and people', () => {
    const one = calcFood(plan({ durationPreset: '1y', people: [adult()] }), climate);
    const four = calcFood(plan({ durationPreset: '3y', people: [adult(), adult(), adult(), adult()] }), climate);
    const grains = (r: typeof one) => r.categories.find((c) => c.id === 'grains')!.lines.reduce((s, l) => s + l.kcal, 0);
    expect(grains(four) / grains(one)).toBeGreaterThan(11);
    expect(grains(four) / grains(one)).toBeLessThan(13);
  });

  it('grains are about 45 % of calories for long storage', () => {
    const r = calcFood(plan({ durationPreset: '1y' }), climate);
    const g = r.categories.find((c) => c.id === 'grains')!.lines.reduce((s, l) => s + l.kcal, 0);
    expect(g / (r.achievedKcalPerDay * r.days)).toBeGreaterThan(0.42);
    expect(g / (r.achievedKcalPerDay * r.days)).toBeLessThan(0.5);
  });

  it('macro split is plausible and sums to ~100', () => {
    const { macros } = calcFood(plan({ durationPreset: '1y' }), climate);
    expect(macros.proteinPct + macros.fatPct + macros.carbPct).toBeGreaterThanOrEqual(99);
    expect(macros.proteinPct).toBeGreaterThan(9);
    expect(macros.fatPct).toBeGreaterThan(15);
    expect(macros.carbPct).toBeGreaterThan(50);
  });

  it('counts 20 L pails and floor space', () => {
    const r = calcFood(plan({ durationPreset: '1y' }), climate);
    expect(r.totalPails).toBe(r.lines.reduce((s, l) => s + l.pails, 0));
    expect(r.totalPails).toBeGreaterThan(10);
    expect(r.floorM2).toBeGreaterThan(0);
  });

  it('flags fat as the rotation weak point', () => {
    const r = calcFood(plan({ durationPreset: '1y' }), climate);
    expect(r.warnings.some((w) => /Fats are the rotation weak point/.test(w.text))).toBe(true);
    expect(r.lines.find((l) => l.id === 'canola-oil')!.needsRotation).toBe(true);
  });

  it('warns loudly that canned goods must not freeze in unheated storage', () => {
    const cold = calcFood(plan({ storageLocation: 'unheated' }), climate);
    const w = cold.warnings.find((x) => /must not freeze/.test(x.text))!;
    expect(w.level).toBe('danger');
    expect(w.text).toMatch(/-28/);
    const warm = calcFood(plan({ storageLocation: 'heated' }), climate);
    expect(warm.warnings.find((x) => /must not freeze/.test(x.text))!.level).toBe('info');
  });

  it('warns when storage space is too small', () => {
    const r = calcFood(plan({ durationPreset: '3y', storageFloorM2: 0.5 }), climate);
    expect(r.warnings.some((w) => /floor space/.test(w.text))).toBe(true);
  });

  it('72 hours uses ready-to-eat food, no pails of wheat', () => {
    const r = calcFood(plan({ durationPreset: '72h' }), climate);
    expect(r.shortTerm).toBe(true);
    expect(r.lines.find((l) => l.id === 'wheat-berries')).toBeUndefined();
    expect(r.lines.find((l) => l.id === 'crackers')).toBeDefined();
  });

  it('budget tier changes the item mix', () => {
    const b = calcFood(plan({ budget: 'budget', durationPreset: '1y' }), climate).lines.map((l) => l.id);
    const p = calcFood(plan({ budget: 'premium', durationPreset: '1y' }), climate).lines.map((l) => l.id);
    expect(b).not.toContain('pasta');
    expect(p).toContain('pasta');
    expect(p).toContain('ghee');
  });

  it('adds vitamins, iodized salt, and preserving salt for long plans', () => {
    const r = calcFood(plan({ durationPreset: '1y' }), climate);
    const vc = r.lines.find((l) => l.id === 'vitamin-c')!;
    expect(vc.units).toBe(Math.ceil((2 * 365) / 100));
    expect(r.lines.find((l) => l.id === 'iodized-salt')).toBeDefined();
    expect(r.lines.find((l) => l.id === 'preserving-salt')).toBeDefined();
    expect(calcFood(plan({ durationPreset: '2w' }), climate).lines.find((l) => l.id === 'preserving-salt')).toBeUndefined();
  });

  it('includes pet food when there are pets', () => {
    const r = calcFood(plan({ durationPreset: '1y', pets: [{ id: 'd', name: 'Dog', species: 'dog', weightKg: 30 }] }), climate);
    const pet = r.lines.find((l) => l.id === 'pet-food')!;
    expect(pet.kg).toBeGreaterThanOrEqual((petKcalPerDay('dog', 30, assumptions) * 365) / 3600);
  });

  it('warns that electric cooking fails grid-down', () => {
    expect(calcFood(plan({ cookFuel: 'electric' }), climate).warnings.some((w) => /non-electric stove/.test(w.text))).toBe(true);
  });
});

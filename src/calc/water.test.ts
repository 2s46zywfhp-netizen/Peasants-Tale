import { describe, expect, it } from 'vitest';
import { boilFuel, calcWater, petWaterLPerDay } from './water';
import { defaultPlan, type Plan } from './plan';
import { assumptions } from './ref';
import type { Climate } from './climate';

const climate: Climate = { zone: '4a', lastFrost: '05-17', firstFrost: '10-01', frostFreeDays: 136, designLowC: -28, annualPrecipMm: 900, snowMonths: [1, 2, 3, 12], hdd: 5200, janMeanC: -13 };
const plan = (over: Partial<Plan> = {}): Plan => ({ ...defaultPlan(), ...over });

describe('water calculator', () => {
  it('uses the 4 L/person/day Government of Canada baseline', () => {
    const r = calcWater(plan({ durationPreset: '72h' }), climate);
    expect(r.peopleLPerDay).toBe(8);
    expect(r.totalL).toBe(24);
    expect(r.storedL).toBe(24);
    expect(r.containers).toBe(2);
    expect(r.purifyL).toBe(0);
  });

  it('adds pets by body weight', () => {
    expect(petWaterLPerDay('dog', 30, assumptions)).toBeCloseTo(1.8);
    const r = calcWater(plan({ durationPreset: '72h', pets: [{ id: 'd', name: 'Dog', species: 'dog', weightKg: 30 }] }), climate);
    expect(r.totalLPerDay).toBeCloseTo(9.8);
  });

  it('long plans store 14 days and purify the rest', () => {
    const r = calcWater(plan({ durationPreset: '1y' }), climate);
    expect(r.storedDays).toBe(14);
    expect(r.storedL).toBe(112);
    expect(r.purifyL).toBe(8 * 365 - 112);
    expect(r.lines.find((l) => l.id === 'filter-elements')!.qty).toBe(Math.ceil((8 * 365 - 112) / 2000));
    expect(r.lines.find((l) => l.id === 'clo2-tabs')!.qty).toBe(2 * 2 * 30);
  });

  it('computes boiling fuel by fuel type', () => {
    const propane = boilFuel(100, 'propane')!;
    expect(propane.unit).toBe('L');
    expect(propane.qty).toBeCloseTo((100 * 0.44) / 0.45 / 25.3, 1);
    expect(boilFuel(100, 'wood')!.unit).toBe('kg');
    expect(boilFuel(100, 'heating-oil')).toBeNull();
  });

  it('warns that stored water will freeze in unheated storage', () => {
    const r = calcWater(plan({ storageLocation: 'unheated' }), climate);
    expect(r.warnings.find((w) => /will freeze/.test(w.text))!.level).toBe('danger');
    const r2 = calcWater(plan({ storageLocation: 'heated' }), climate);
    expect(r2.warnings.find((w) => /can freeze/.test(w.text))!.level).toBe('warn');
  });
});

import { describe, expect, it } from 'vitest';
import { calcHeating, calcSupplies } from './supplies';
import { defaultPlan, type Plan } from './plan';
import type { Climate } from './climate';

const c: Climate = { zone: '4a', lastFrost: '05-17', firstFrost: '10-01', frostFreeDays: 136, designLowC: -28, annualPrecipMm: 900, snowMonths: [12, 1, 2, 3], hdd: 5200, janMeanC: -13 };
const plan = (over: Partial<Plan> = {}): Plan => ({ ...defaultPlan(), ...over });
const find = (r: ReturnType<typeof calcSupplies>, id: string) => r.categories.flatMap((g) => g.lines).find((l) => l.id === id);

describe('heating', () => {
  it('estimates cords per winter from degree-days', () => {
    // 1.4 W/K/m² × 100 m² × 5200 DD × 86400 s = 62,899 MJ; cord = 20,000 MJ × 70 % → 4.49 → 4.5 cords
    const h = calcHeating(plan({ durationPreset: '1y' }), c);
    expect(h.annualMJ).toBe(62899);
    expect(h.perWinter).toBe(4.5);
    expect(h.forPlan).toBe(4.5);
  });
  it('scales with insulation and area', () => {
    expect(calcHeating(plan({ insulation: 'good' }), c).perWinter).toBeLessThan(calcHeating(plan({ insulation: 'poor' }), c).perWinter);
    expect(calcHeating(plan({ heatedAreaM2: 30, durationPreset: '1y' }), c).perWinter).toBeLessThan(2);
  });
  it('multiple winters for multi-year plans', () => {
    expect(calcHeating(plan({ durationPreset: '3y' }), c).forPlan).toBe(13.5);
  });
  it('short plans use worst case January days', () => {
    const h = calcHeating(plan({ durationPreset: '2w' }), c);
    expect(h.forPlan).toBeLessThan(1);
    expect(h.basis).toMatch(/January/);
  });
  it('other fuels in litres', () => {
    const h = calcHeating(plan({ heatSource: 'propane', durationPreset: '1y' }), c);
    expect(h.unit).toBe('L');
    expect(h.perWinter).toBe(Math.ceil(62899 / (25.3 * 0.85) / 10) * 10);
  });
});

describe('supplies', () => {
  it('scales clothing per person and names the design low', () => {
    const r = calcSupplies(plan({ people: [...defaultPlan().people, ...defaultPlan().people.map((p) => ({ ...p, id: p.id + 'x' }))] }), c);
    expect(find(r, 'base-layer')!.qty).toBe(8);
    expect(find(r, 'parka')!.name).toMatch(/-28 °C/);
  });
  it('wood heat adds saws and chainsaw fuel; electric heat warns', () => {
    expect(find(calcSupplies(plan({ heatSource: 'wood' }), c), 'chainsaw')).toBeDefined();
    const e = calcSupplies(plan({ heatSource: 'electric' }), c);
    expect(find(e, 'chainsaw')).toBeUndefined();
    expect(find(e, 'backup-heater')).toBeDefined();
    expect(e.warnings[0].level).toBe('danger');
  });
  it('chainsaw fuel scales with cords', () => {
    const r = calcSupplies(plan({ durationPreset: '1y' }), c);
    expect(find(r, 'chainsaw-fuel')!.qty).toBe(18); // 4.5 cords × 4 L
  });
  it('short plans skip long-term items', () => {
    const r = calcSupplies(plan({ durationPreset: '72h' }), c);
    expect(find(r, 'grain-mill')).toBeUndefined();
    expect(find(r, 'ifak')).toBeDefined();
  });
  it('marks skills that need practice', () => {
    const r = calcSupplies(plan(), c);
    expect(find(r, 'ifak')!.practiceRequired).toBe(true);
    expect(find(r, 'ferro-rod')!.practiceRequired).toBe(true);
  });
  it('mild climates drop deep-cold gear', () => {
    const mild = { ...c, designLowC: -10, snowMonths: [1] };
    expect(find(calcSupplies(plan(), mild), 'parka')).toBeUndefined();
    expect(find(calcSupplies(plan(), mild), 'snowshoes')).toBeUndefined();
  });
});

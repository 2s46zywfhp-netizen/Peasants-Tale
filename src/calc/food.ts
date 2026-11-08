import type { Climate } from './climate';
import { isAdult, planDays, type Person, type Plan, type Warning } from './plan';
import * as R from './ref';

export interface FoodRef {
  a: R.Assumptions;
  energy: R.EnergyNeed[];
  items: R.FoodItem[];
  fixed: R.FixedFoodItem[];
  shares: R.FoodShare[];
}
export const defaultFoodRef: FoodRef = { a: R.assumptions, energy: R.energyNeeds, items: R.foodItems, fixed: R.foodFixed, shares: R.foodShares };

export function personKcal(p: Person, plan: Pick<Plan, 'coldLabour'>, ref: FoodRef = defaultFoodRef): number {
  if (p.kcalOverride && p.kcalOverride > 0) return Math.round(p.kcalOverride * (plan.coldLabour ? ref.a.coldLabourFactor : 1));
  const row = ref.energy.find((e) => e.id === p.age) ?? ref.energy.find((e) => e.id === 'adult19-50')!;
  const base = (p.sex === 'male' ? row.male : row.female) * (ref.a.baseKcalPerPersonDay / 2400);
  const act = p.activity === 'low' ? ref.a.activityLow : p.activity === 'high' ? ref.a.activityHigh : 1;
  return Math.round(base * act * (plan.coldLabour ? ref.a.coldLabourFactor : 1));
}

export interface FoodLine {
  id: string;
  category: string;
  name: string;
  kg: number;
  units: number;
  unitLabel: string;
  pails: number;
  kcal: number; // provided by the rounded quantity
  proteinG: number;
  fatG: number;
  carbG: number;
  volumeL: number;
  shelfLifeYears: number;
  rotationMonths: number;
  needsRotation: boolean; // shelf life shorter than the plan
  flags: string[];
  notes: string;
}

export interface FoodResult {
  days: number;
  peopleKcalPerDay: { id: string; name: string; kcal: number }[];
  targetKcalPerDay: number;
  achievedKcalPerDay: number;
  achievedKcalPerPersonDay: number;
  macros: { proteinPct: number; fatPct: number; carbPct: number };
  lines: FoodLine[];
  categories: { id: string; label: string; kcalShare: number; lines: FoodLine[] }[];
  totalPails: number;
  totalKg: number;
  floorM2: number;
  petKcalPerDay: number;
  warnings: Warning[];
  shortTerm: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function petKcalPerDay(species: 'dog' | 'cat' | 'other', kg: number, a: R.Assumptions): number {
  const f = species === 'dog' ? a.petKcalDogFactor : species === 'cat' ? a.petKcalCatFactor : a.petKcalOtherFactor;
  return Math.round(f * 70 * Math.pow(Math.max(kg, 0.1), 0.75));
}

function lineFromKg(item: R.FoodItem, kgNeeded: number, days: number, a: R.Assumptions): FoodLine {
  const units = Math.max(kgNeeded > 0 ? 1 : 0, Math.ceil(kgNeeded / item.unitKg - 1e-9));
  const kg = r1(units * item.unitKg);
  const pails = item.packaging === 'pail' ? Math.ceil(kg / (item.kgPerPail ?? 12) - 1e-9) : 0;
  const volumeL = item.packaging === 'pail' ? pails * a.pailL : kg * (item.litresPerKg ?? 1.2);
  const flags: string[] = [];
  if (item.isFat) flags.push('fat');
  if (item.canned) flags.push('canned');
  if (item.needsCooking) flags.push('cook');
  const needsRotation = item.shelfLifeYears * 365 < days || item.rotationMonths > 0;
  return {
    id: item.id, category: item.category, name: item.name, kg, units, unitLabel: item.unitLabel, pails,
    kcal: Math.round(kg * 10 * item.kcalPer100g),
    proteinG: kg * 10 * item.proteinG, fatG: kg * 10 * item.fatG, carbG: kg * 10 * item.carbG,
    volumeL, shelfLifeYears: item.shelfLifeYears, rotationMonths: item.rotationMonths, needsRotation, flags, notes: item.notes,
  };
}

export function calcFood(plan: Plan, climate: Climate | null, ref: FoodRef = defaultFoodRef): FoodResult {
  const { a } = ref;
  const days = planDays(plan);
  const shortTerm = days <= a.shortTermDays;
  const use = shortTerm ? 'short' : 'long';
  const peopleKcal = plan.people.map((p) => ({ id: p.id, name: p.name, kcal: personKcal(p, plan, ref) }));
  const target = peopleKcal.reduce((s, p) => s + p.kcal, 0);
  const totalKcal = target * days;
  const warnings: Warning[] = [];
  const lines: FoodLine[] = [];
  const categories: FoodResult['categories'] = [];

  for (const share of ref.shares) {
    const frac = shortTerm ? share.short : share.long;
    let items = ref.items.filter((i) => i.category === share.id && i.tiers.includes(plan.budget) && i.use.includes(use));
    if (!items.length) items = ref.items.filter((i) => i.category === share.id && i.use.includes(use));
    if (!items.length) items = ref.items.filter((i) => i.category === share.id);
    const wsum = items.reduce((s, i) => s + i.weight, 0);
    const catLines = items.map((i) => lineFromKg(i, (totalKcal * frac * (i.weight / wsum)) / (i.kcalPer100g * 10), days, a));
    lines.push(...catLines);
    categories.push({ id: share.id, label: share.label, kcalShare: frac, lines: catLines });
  }

  // Per-person items: drinks, baking, salt, vitamins.
  const adults = plan.people.filter(isAdult).length;
  const fixedByCat = new Map<string, FoodLine[]>();
  for (const f of ref.fixed) {
    if (f.minDays && days < f.minDays) continue;
    const n = f.adultsOnly ? adults : plan.people.length;
    let units = 0;
    let kg = 0;
    if (f.basis === 'gramsPerPersonDay') {
      kg = (f.amount * n * days) / 1000;
      units = Math.ceil(kg / (f.unitKg ?? 1) - 1e-9);
      kg = r1(units * (f.unitKg ?? 1));
    } else if (f.basis === 'tabletsPerPersonDay') {
      units = Math.ceil((f.amount * n * days) / (f.perBottle ?? 100));
    } else if (f.basis === 'preservingSalt') {
      if (days < a.preservingSaltMinDays) continue;
      kg = (a.preservingSaltKgPerPersonYear * n * days) / 365;
      units = Math.ceil(kg / (f.unitKg ?? 1) - 1e-9);
      kg = r1(units * (f.unitKg ?? 1));
    }
    if (units <= 0) continue;
    const line: FoodLine = {
      id: f.id, category: f.category, name: f.name, kg, units, unitLabel: f.unitLabel, pails: 0, kcal: 0, proteinG: 0, fatG: 0, carbG: 0,
      volumeL: Math.max(kg * 1.5, units * 0.3), shelfLifeYears: f.shelfLifeYears, rotationMonths: f.rotationMonths,
      needsRotation: f.shelfLifeYears * 365 < days || f.rotationMonths > 0, flags: [], notes: f.notes ?? '',
    };
    lines.push(line);
    const existing = categories.find((c) => c.id === f.category);
    if (existing) existing.lines.push(line);
    else fixedByCat.set(f.category, [...(fixedByCat.get(f.category) ?? []), line]);
  }
  const fixedLabels: Record<string, string> = { baking: 'Baking', salt: 'Salt', micronutrients: 'Micronutrients' };
  for (const [id, ls] of fixedByCat) categories.push({ id, label: fixedLabels[id] ?? id, kcalShare: 0, lines: ls });

  // Pet food.
  const petKcal = plan.pets.reduce((s, p) => s + petKcalPerDay(p.species, p.weightKg, a), 0);
  if (petKcal > 0) {
    const kg = (petKcal * days) / a.petFoodKcalPerKg;
    const units = Math.ceil(kg / 8 - 1e-9);
    const line: FoodLine = {
      id: 'pet-food', category: 'pets', name: 'Dry pet food (kibble)', kg: units * 8, units, unitLabel: '8 kg bag', pails: Math.ceil((units * 8) / 8),
      kcal: 0, proteinG: 0, fatG: 0, carbG: 0, volumeL: units * 8 * 2.4, shelfLifeYears: 1, rotationMonths: 12, needsRotation: true, flags: ['fat'],
      notes: 'Kibble fats go rancid in about a year: rotate. Re-pack into sealed pails to keep mice out.',
    };
    lines.push(line);
    categories.push({ id: 'pets', label: 'Pets', kcalShare: 0, lines: [line] });
  }

  const humanLines = lines.filter((l) => l.category !== 'pets');
  const achieved = humanLines.reduce((s, l) => s + l.kcal, 0) / days;
  const p = humanLines.reduce((s, l) => s + l.proteinG, 0) * 4;
  const f = humanLines.reduce((s, l) => s + l.fatG, 0) * 9;
  const c = humanLines.reduce((s, l) => s + l.carbG, 0) * 4;
  const mt = p + f + c || 1;
  const totalPails = lines.reduce((s, l) => s + l.pails, 0);
  const otherVolL = lines.filter((l) => l.pails === 0).reduce((s, l) => s + l.volumeL, 0);
  const floorM2 = r1(((totalPails / a.pailStack) * a.pailFootprintM2 + otherVolL / (a.shelfStackM * 1000)) * a.packingFactor);

  // Warnings.
  const fatLines = lines.filter((l) => l.flags.includes('fat'));
  if (fatLines.length) {
    warnings.push({
      level: 'warn',
      text: `Fats are the rotation weak point: ${fatLines.map((l) => l.name.toLowerCase()).join(', ')} go rancid in 1–3 years. Rotate yearly, store cool and dark, and favour coconut oil and sealed shortening for long storage.`,
    });
  }
  if (lines.some((l) => l.flags.includes('canned'))) {
    const cold = plan.storageLocation === 'unheated' || plan.storageLocation === 'cold-room';
    const low = climate?.designLowC;
    warnings.push({
      level: cold ? 'danger' : 'info',
      text: cold
        ? `Canned goods must not freeze. Your storage is ${plan.storageLocation.replace('-', ' ')}${low != null ? ` and winter lows reach ${low} °C` : ''}: frozen cans split seams and spoil. Keep cans in heated space or above 0 °C.`
        : 'Canned goods must not freeze. Keep them off exterior walls and above 0 °C if the heat goes out.',
    });
  }
  if (floorM2 > plan.storageFloorM2) {
    warnings.push({ level: 'warn', text: `Needs about ${floorM2} m² of floor space; you have ${plan.storageFloorM2} m². Stack higher, use shelving, or split storage.` });
  }
  const cookFuelOk = plan.cookFuel !== 'electric';
  if (!cookFuelOk && lines.some((l) => l.flags.includes('cook'))) {
    warnings.push({ level: 'danger', text: 'Most of this food needs cooking and your cooking fuel is electric. Grid-down you need a non-electric stove and fuel (see Water for boiling fuel).' });
  }
  const shortLife = lines.filter((l) => l.shelfLifeYears * 365 < days);
  if (shortLife.length) {
    warnings.push({ level: 'info', text: `${shortLife.length} items have a shorter shelf life than your plan; they must be rotated (eaten and replaced) during it.` });
  }
  if (shortTerm) warnings.push({ level: 'info', text: 'Short duration: list favours ready-to-eat, no-cook food.' });
  if (plan.people.length === 0) warnings.push({ level: 'warn', text: 'Add people to your household to size the lists.' });

  return {
    days,
    peopleKcalPerDay: peopleKcal,
    targetKcalPerDay: target,
    achievedKcalPerDay: Math.round(achieved),
    achievedKcalPerPersonDay: plan.people.length ? Math.round(achieved / plan.people.length) : 0,
    macros: { proteinPct: Math.round((p / mt) * 100), fatPct: Math.round((f / mt) * 100), carbPct: Math.round((c / mt) * 100) },
    lines,
    categories,
    totalPails,
    totalKg: Math.round(lines.reduce((s, l) => s + l.kg, 0)),
    floorM2,
    petKcalPerDay: petKcal,
    warnings,
    shortTerm,
  };
}

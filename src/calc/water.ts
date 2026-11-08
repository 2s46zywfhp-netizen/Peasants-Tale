import type { Climate } from './climate';
import { planDays, type Plan, type Warning } from './plan';
import * as R from './ref';

export interface WaterLine { id: string; name: string; qty: number; unit: string; notes: string; shelfLifeYears?: number; rotationMonths?: number }

export interface WaterResult {
  days: number;
  peopleLPerDay: number;
  petsLPerDay: number;
  totalLPerDay: number;
  totalL: number;
  storedL: number;
  storedDays: number;
  containers: number;
  purifyL: number;
  drinkingToPurifyL: number;
  boilFuel: { fuel: string; qty: number; unit: string } | null;
  lines: WaterLine[];
  warnings: Warning[];
}

export function petWaterLPerDay(species: 'dog' | 'cat' | 'other', kg: number, a: R.Assumptions): number {
  const ml = species === 'dog' ? a.petWaterDogMlPerKg : species === 'cat' ? a.petWaterCatMlPerKg : a.petWaterOtherMlPerKg;
  return (ml * kg) / 1000;
}

/** Fuel needed to boil `litres` with a given cooking fuel. */
export function boilFuel(litres: number, fuelId: string, a: R.Assumptions = R.assumptions, fuels: R.Fuel[] = R.fuels) {
  const f = fuels.find((x) => x.id === fuelId);
  if (!f || f.cookingEff <= 0) return null;
  const mj = (litres * a.boilMJPerL) / f.cookingEff;
  if (f.id === 'wood') return { fuel: f.name, qty: Math.round((mj / f.perKgMJ) * 10) / 10, unit: 'kg' };
  return { fuel: f.name, qty: Math.round((mj / f.energyMJ) * 10) / 10, unit: f.unit };
}

export function calcWater(plan: Plan, climate: Climate | null, a: R.Assumptions = R.assumptions, fuels: R.Fuel[] = R.fuels): WaterResult {
  const days = planDays(plan);
  const n = plan.people.length;
  const peopleL = n * a.waterPerPersonDayL;
  const petsL = plan.pets.reduce((s, p) => s + petWaterLPerDay(p.species, p.weightKg, a), 0);
  const daily = peopleL + petsL;
  const totalL = Math.ceil(daily * days);
  const storedDays = Math.min(days, a.waterStoreDaysCap);
  const storedL = Math.ceil(daily * storedDays);
  const containers = Math.ceil(storedL / a.waterContainerL);
  const purifyL = Math.max(0, totalL - storedL);
  const drinkingToPurifyL = Math.ceil(purifyL * (peopleL / (daily || 1)) * a.waterDrinkingShare);
  const lines: WaterLine[] = [];
  const warnings: Warning[] = [];

  lines.push({ id: 'water-jugs', name: `Water jugs (${a.waterContainerL} L, food-grade)`, qty: containers, unit: 'jugs', notes: `Holds ${storedL} L = ${storedDays} days of stored water.`, shelfLifeYears: 0.5, rotationMonths: 6 });
  lines.push({ id: 'personal-filter', name: 'Personal straw/squeeze filter', qty: Math.max(1, n), unit: 'filters', notes: 'For go-bags and away from home.' });
  if (purifyL > 0) {
    lines.push({ id: 'gravity-filter', name: 'Gravity filter system', qty: 1, unit: 'unit', notes: 'Ceramic or hollow-fibre. Hollow-fibre is ruined if it freezes wet: keep it above 0 °C.' });
    lines.push({ id: 'filter-elements', name: 'Spare filter elements', qty: Math.max(1, Math.ceil(purifyL / a.filterElementL)), unit: 'elements', notes: `Covers ${purifyL} L at ~${a.filterElementL} L each. Pre-filter muddy water through cloth.` });
  }
  const tabDays = Math.min(days, a.tabsCoverDays);
  const tabs = Math.ceil((n * a.waterPerPersonDayL * a.waterDrinkingShare * tabDays) / a.tabLitres);
  lines.push({ id: 'clo2-tabs', name: 'Chlorine dioxide tablets', qty: tabs, unit: 'tablets', notes: `Backup for ${tabDays} days of drinking water. Kills Giardia and Cryptosporidium (4 h wait in cold water).`, shelfLifeYears: 4, rotationMonths: 0 });
  const bleachMl = Math.ceil((purifyL || storedL) * a.bleachMlPerL);
  lines.push({ id: 'bleach', name: 'Unscented bleach (5–8 %)', qty: Math.max(1, Math.ceil(bleachMl / 1000)), unit: 'L', notes: '2 drops per litre, wait 30 min (double for cloudy or very cold water). Loses strength within a year: rotate.', shelfLifeYears: 1, rotationMonths: 12 });
  const bf = boilFuel(Math.max(drinkingToPurifyL, n * 2 * Math.min(days, 14)), plan.cookFuel, a, fuels);
  if (bf) lines.push({ id: 'boil-fuel', name: `Fuel to boil drinking water (${bf.fuel})`, qty: bf.qty, unit: bf.unit, notes: 'Rolling boil 1 minute. This is on top of cooking fuel.' });
  lines.push({ id: 'water-test', name: 'Water test strips / TDS meter', qty: 1, unit: 'kit', notes: 'Boiling and filters do not remove chemical or mine runoff contamination.' });

  const cold = plan.storageLocation === 'unheated' || plan.storageLocation === 'cold-room';
  if (climate && climate.designLowC < 0 && cold) {
    warnings.push({ level: 'danger', text: `Stored water will freeze: your storage is ${plan.storageLocation.replace('-', ' ')} and winter lows reach ${climate.designLowC} °C. Leave 10 % headspace, use jugs rated for freezing, or keep water indoors. Frozen filters can fail without showing it.` });
  } else if (climate && climate.designLowC < 0) {
    warnings.push({ level: 'warn', text: `If the heat fails, stored water can freeze (winter lows ${climate.designLowC} °C). Keep a few jugs in the warmest room and leave headspace in all of them.` });
  }
  if (!bf) warnings.push({ level: 'warn', text: 'Your cooking fuel cannot boil water without power. Add a stove that runs without electricity.' });
  if (days > a.waterStoreDaysCap) warnings.push({ level: 'info', text: `Storing ${totalL} L is impractical; plan stores ${storedDays} days and purifies the rest from a local source (lake, stream, rain, snow melt).` });
  if (climate?.snowMonths?.length) warnings.push({ level: 'info', text: `Snow melting costs a lot of fuel: about 10 L of snow makes 1 L of water. Melt ice, not snow, when you can.` });

  return { days, peopleLPerDay: peopleL, petsLPerDay: Math.round(petsL * 10) / 10, totalLPerDay: Math.round(daily * 10) / 10, totalL, storedL, storedDays, containers, purifyL, drinkingToPurifyL, boilFuel: bf, lines, warnings };
}

import type { Climate } from './climate';
import { planDays, type Plan, type Warning } from './plan';
import * as R from './ref';

export interface SupplyLine {
  id: string;
  category: string;
  name: string;
  qty: number;
  unit: string;
  priority: number;
  practiceRequired: boolean;
  shelfLifeYears: number;
  rotationMonths: number;
  notes: string;
}

export interface HeatingResult {
  annualMJ: number;
  perWinter: number; // fuel units per heating season
  forPlan: number; // fuel units for the plan duration
  unit: string;
  fuelName: string;
  basis: string;
}

/** Fuel to heat the house. Full winters for long plans; worst case (starting in January) for short ones. */
export function calcHeating(plan: Plan, c: Climate, a: R.Assumptions = R.assumptions, fuels: R.Fuel[] = R.fuels): HeatingResult {
  const loss = plan.insulation === 'poor' ? a.houseLossPoor : plan.insulation === 'good' ? a.houseLossGood : a.houseLossAverage;
  const ua = loss * plan.heatedAreaM2; // W/K
  const mjPerDegreeDay = (ua * 86400) / 1e6;
  const annualMJ = Math.round(mjPerDegreeDay * c.hdd);
  const f = fuels.find((x) => x.id === plan.heatSource)!;
  const usefulPerUnit = f.energyMJ * f.heatingEff;
  const perWinter = annualMJ / usefulPerUnit;
  const days = planDays(plan);
  let forPlan: number;
  let basis: string;
  if (days >= 365) {
    const winters = Math.ceil(days / 365);
    forPlan = perWinter * winters;
    basis = `${winters} heating season${winters > 1 ? 's' : ''} at ${c.hdd} degree-days each.`;
  } else {
    const worstDailyDD = Math.max(0, 18 - c.janMeanC);
    forPlan = Math.min(perWinter, (mjPerDegreeDay * worstDailyDD * days) / usefulPerUnit);
    basis = `Worst case: ${days} days starting in January (${worstDailyDD.toFixed(0)} degree-days per day).`;
  }
  const round = (n: number) => (f.unit === 'cord' ? Math.ceil(n * 2) / 2 : Math.ceil(n / 10) * 10);
  return { annualMJ, perWinter: round(perWinter), forPlan: round(forPlan), unit: f.unit, fuelName: f.name, basis };
}

function applies(item: R.SupplyItem, plan: Plan, c: Climate | null, days: number): boolean {
  const o = item.onlyIf;
  if (!o) return true;
  if (o.minDays && days < o.minDays) return false;
  if (o.heatSource && !o.heatSource.includes(plan.heatSource)) return false;
  if (o.cookFuel && !o.cookFuel.includes(plan.cookFuel)) return false;
  if (o.designLowAtOrBelow != null && (c?.designLowC ?? -30) > o.designLowAtOrBelow) return false;
  if (o.snowMonthsAtLeast != null && (c?.snowMonths.length ?? 5) < o.snowMonthsAtLeast) return false;
  return true;
}

export interface SuppliesResult {
  heating: HeatingResult | null;
  categories: { id: string; lines: SupplyLine[] }[];
  warnings: Warning[];
}

export function calcSupplies(plan: Plan, c: Climate | null, a: R.Assumptions = R.assumptions, items: R.SupplyItem[] = R.supplies, fuels: R.Fuel[] = R.fuels): SuppliesResult {
  const days = planDays(plan);
  const months = days / a.monthDays;
  const n = plan.people.length;
  const warnings: Warning[] = [];
  const lines: SupplyLine[] = [];
  const heating = c ? calcHeating(plan, c, a, fuels) : null;
  if (heating) {
    lines.push({
      id: 'heat-fuel', category: 'heating', name: `${heating.fuelName} for heat`, qty: heating.forPlan, unit: heating.unit + (heating.unit === 'cord' ? 's' : ''),
      priority: 1, practiceRequired: false, shelfLifeYears: plan.heatSource === 'wood' ? 0 : 5, rotationMonths: 0,
      notes: `${heating.perWinter} ${heating.unit}${heating.unit === 'cord' ? 's' : ''} per winter for ${plan.heatedAreaM2} m², ${plan.insulation} insulation. ${heating.basis}${plan.heatSource === 'wood' ? ' Firewood must dry 6–12 months: cut a year ahead.' : ''}`,
    });
  }
  for (const it of items) {
    if (!applies(it, plan, c, days)) continue;
    const cords = heating && heating.unit === 'cord' ? heating.forPlan : 0;
    const raw = it.base + it.perPerson * n + (it.perPersonMonth * n + it.perHouseholdMonth) * months + (it.perCord ?? 0) * cords;
    const qty = Math.ceil(raw - 1e-9);
    if (qty <= 0) continue;
    lines.push({
      id: it.id, category: it.category, name: it.name.replace('{designLow}', String(c?.designLowC ?? -30)), qty, unit: it.unit,
      priority: it.priority, practiceRequired: it.practiceRequired, shelfLifeYears: it.shelfLifeYears, rotationMonths: it.rotationMonths, notes: it.notes,
    });
  }
  const f = fuels.find((x) => x.id === plan.heatSource);
  if (f?.needsPower) warnings.push({ level: 'danger', text: `${f.name} heat needs electricity. In a winter grid-down event your house will freeze. Add a wood stove or vented non-electric heater.` });
  if (plan.heatSource === 'propane' && c && c.designLowC <= -35) warnings.push({ level: 'warn', text: 'Your winter lows approach −40 °C, where propane stops vaporizing. Keep cylinders sheltered or have a wood backup.' });
  if (c && c.designLowC <= -30) warnings.push({ level: 'info', text: `Clothing and sleep gear are sized for your design low of ${c.designLowC} °C. Cold injuries start at the feet and hands: dry socks and liners daily.` });

  const order = ['heating', 'clothing', 'shelter', 'fire', 'lighting', 'first aid', 'comms', 'tools', 'hygiene', 'sanitation'];
  const categories = order.map((id) => ({ id, lines: lines.filter((l) => l.category === id).sort((x, y) => x.priority - y.priority) })).filter((g) => g.lines.length);
  return { heating, categories, warnings };
}

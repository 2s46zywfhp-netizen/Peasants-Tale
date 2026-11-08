/** Typed access to the bundled reference data in /data. Calculators take these as parameters so tests can swap them. */
import assumptionsFile from '../../data/assumptions.json';
import energyFile from '../../data/energy-needs.json';
import foodItemsFile from '../../data/food-items.json';
import foodFixedFile from '../../data/food-fixed.json';
import foodSharesFile from '../../data/food-shares.json';
import fuelsFile from '../../data/fuels.json';

export type Assumptions = Record<string, number>;
export const assumptions: Assumptions = Object.fromEntries(assumptionsFile.records.map((r) => [r.id, r.value]));

export interface EnergyNeed { id: string; label: string; male: number; female: number }
export const energyNeeds = energyFile.records as EnergyNeed[];

export interface FoodItem {
  id: string;
  category: string;
  name: string;
  kcalPer100g: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  shelfLifeYears: number;
  rotationMonths: number;
  packaging: 'pail' | 'case' | 'jar' | 'bottle';
  unitKg: number;
  unitLabel: string;
  tiers: string[];
  use: string[];
  weight: number;
  needsCooking: boolean;
  canned: boolean;
  notes: string;
  kgPerPail?: number;
  litresPerKg?: number;
  isFat?: boolean;
}
export const foodItems = foodItemsFile.records as FoodItem[];

export interface FixedFoodItem {
  id: string;
  category: string;
  name: string;
  basis: 'gramsPerPersonDay' | 'tabletsPerPersonDay' | 'preservingSalt';
  amount: number;
  adultsOnly?: boolean;
  minDays?: number;
  perBottle?: number;
  shelfLifeYears: number;
  rotationMonths: number;
  unitKg?: number;
  unitLabel: string;
  notes?: string;
}
export const foodFixed = foodFixedFile.records as FixedFoodItem[];

export interface FoodShare { id: string; label: string; long: number; short: number }
export const foodShares = foodSharesFile.records as FoodShare[];

export interface Fuel {
  id: string;
  name: string;
  unit: string;
  energyMJ: number;
  perKgMJ: number;
  heatingEff: number;
  cookingEff: number;
  needsPower: boolean;
  notes: string;
}
export const fuels = fuelsFile.records as Fuel[];
export const fuelById = (id: string) => fuels.find((f) => f.id === id);

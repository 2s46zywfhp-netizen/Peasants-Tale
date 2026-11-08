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

import seedsAnnualFile from '../../data/seeds-annual.json';
import seedsPerennialFile from '../../data/seeds-perennial.json';
import suppliesFile from '../../data/supplies.json';
import huntingFile from '../../data/hunting.json';
import ammoFile from '../../data/ammo-plan.json';
import harvestFile from '../../data/harvest-sustainability.json';
import sourcesFile from '../../data/sources.json';

export interface AnnualSeed {
  id: string;
  crop: string;
  variety: string;
  family: string;
  daysToMaturity: number;
  method: 'direct' | 'transplant' | 'either' | 'tuber' | 'set' | 'fall';
  frostTolerance: 'tender' | 'half-hardy' | 'hardy';
  weeksIndoors: number;
  yieldKgPer10m2: number;
  kcalPer100g: number;
  viabilityYears: number;
  openPollinated: boolean;
  seedSaving: string;
  rowCoverHelps: boolean;
  needsHeat: boolean;
  calorieCrop: boolean;
  notes: string;
}
export const seedsAnnual = seedsAnnualFile.records as AnnualSeed[];

export interface PerennialPlant {
  id: string;
  name: string;
  type: string;
  minZone: string;
  pollination: string;
  pollinatorPartner: string;
  rootstock: string;
  yearsToBearing: number;
  yieldKgPerPlant: number;
  notes: string;
}
export const seedsPerennial = seedsPerennialFile.records as PerennialPlant[];

export interface SupplyItem {
  id: string;
  category: string;
  name: string;
  unit: string;
  base: number;
  perPerson: number;
  perPersonMonth: number;
  perHouseholdMonth: number;
  perCord?: number;
  priority: number;
  practiceRequired: boolean;
  shelfLifeYears: number;
  rotationMonths: number;
  notes: string;
  onlyIf?: { minDays?: number; designLowAtOrBelow?: number; heatSource?: string[]; cookFuel?: string[]; snowMonthsAtLeast?: number };
}
export const supplies = suppliesFile.records as SupplyItem[];

export type LegalStatus = 'legal' | 'pal' | 'rpal' | 'prohibited' | 'licence-to-use';
export interface HuntingItem {
  id: string;
  category: string;
  name: string;
  roles: string[];
  utility: number;
  description: string;
  cartridge?: string;
  effectiveRangeM?: number;
  ammoAvailability?: number;
  weightKg?: number;
  coldReliability?: number;
  coldNote?: string;
  maintenance?: string;
  sustainability?: string;
  legal: { status: LegalStatus; acquirableNow: boolean; useLicence: string | null; consequence: string; sources: string[]; lastVerified: string; note: string };
}
export const huntingItems = huntingFile.records as HuntingItem[];

export interface AmmoRole { id: string; label: string; cartridge: string; roundsPerYear: number; practicePerYear: number; minimum: number; packSize: number; shelfLifeYears: number }
export const ammoRoles = ammoFile.records as AmmoRole[];

export interface HarvestNote { id: string; species: string; note: string }
export const harvestNotes = harvestFile.records as HarvestNote[];

export interface Source { id: string; title: string; publisher: string; url: string; lastVerified: string }
export const sources = sourcesFile.records as Source[];

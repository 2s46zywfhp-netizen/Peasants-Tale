/** The household plan: everything the user tells us that drives the lists. */

export type AgeBand = 'infant' | 'child1-3' | 'child4-8' | 'child9-13' | 'teen14-18' | 'adult19-50' | 'adult51-70' | 'senior71';
export type Sex = 'male' | 'female';
export type Activity = 'low' | 'moderate' | 'high';
export type Budget = 'budget' | 'standard' | 'premium';
export type StorageLocation = 'heated' | 'basement' | 'cold-room' | 'unheated';
export type HeatSource = 'wood' | 'propane' | 'kerosene' | 'heating-oil' | 'pellets' | 'electric';
export type CookFuel = 'wood' | 'propane' | 'white-gas' | 'kerosene' | 'butane' | 'electric';
export type Insulation = 'poor' | 'average' | 'good';
export type DurationPreset = '72h' | '2w' | '3m' | '1y' | '3y' | 'custom';

export interface Person {
  id: string;
  name: string;
  age: AgeBand;
  sex: Sex;
  activity: Activity;
  kcalOverride?: number;
}

export interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  weightKg: number;
}

export interface Plan {
  people: Person[];
  pets: Pet[];
  durationPreset: DurationPreset;
  customDays: number;
  budget: Budget;
  storageLocation: StorageLocation;
  storageFloorM2: number;
  heatSource: HeatSource;
  cookFuel: CookFuel;
  heatedAreaM2: number;
  insulation: Insulation;
  coldLabour: boolean;
  huntingEnabled: boolean;
  collapseMode: boolean;
  huntingRoles: string[];
}

export const DURATIONS: { id: DurationPreset; label: string; days: number }[] = [
  { id: '72h', label: '72 hours', days: 3 },
  { id: '2w', label: '2 weeks', days: 14 },
  { id: '3m', label: '3 months', days: 91 },
  { id: '1y', label: '1 year', days: 365 },
  { id: '3y', label: '3 years', days: 1095 },
  { id: 'custom', label: 'Custom', days: 30 },
];

export function planDays(p: Plan): number {
  if (p.durationPreset === 'custom') return Math.max(1, Math.round(p.customDays || 1));
  return DURATIONS.find((d) => d.id === p.durationPreset)!.days;
}

export function durationLabel(p: Plan): string {
  return p.durationPreset === 'custom' ? `${planDays(p)} days` : DURATIONS.find((d) => d.id === p.durationPreset)!.label;
}

export const isAdult = (p: Person) => ['adult19-50', 'adult51-70', 'senior71', 'teen14-18'].includes(p.age);

export function defaultPlan(): Plan {
  return {
    people: [
      { id: 'p1', name: 'Adult 1', age: 'adult19-50', sex: 'male', activity: 'moderate' },
      { id: 'p2', name: 'Adult 2', age: 'adult19-50', sex: 'female', activity: 'moderate' },
    ],
    pets: [],
    durationPreset: '3m',
    customDays: 30,
    budget: 'standard',
    storageLocation: 'basement',
    storageFloorM2: 4,
    heatSource: 'wood',
    cookFuel: 'propane',
    heatedAreaM2: 100,
    insulation: 'average',
    coldLabour: false,
    huntingEnabled: false,
    collapseMode: false,
    huntingRoles: ['small-game', 'big-game', 'bird'],
  };
}

/** Fills fields missing from older saved plans. */
export function normalizePlan(p: Partial<Plan> | undefined | null): Plan {
  return { ...defaultPlan(), ...(p ?? {}) };
}

export interface Warning {
  level: 'danger' | 'warn' | 'info';
  text: string;
}

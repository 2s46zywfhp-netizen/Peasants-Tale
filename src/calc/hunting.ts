import { planDays, type Plan } from './plan';
import * as R from './ref';

export const STATUS_LABEL: Record<R.LegalStatus, string> = {
  legal: 'Legal (no licence)',
  pal: 'PAL',
  rpal: 'RPAL',
  prohibited: 'Prohibited',
  'licence-to-use': 'Licence required to use',
};

/**
 * Normal mode: things you can legally acquire now come first, then by utility.
 * Collapse Mode: utility only. Nothing is ever hidden because of its legal class.
 */
export function rankItems(items: R.HuntingItem[], collapse: boolean): R.HuntingItem[] {
  return [...items].sort((a, b) => {
    if (!collapse && a.legal.acquirableNow !== b.legal.acquirableNow) return a.legal.acquirableNow ? -1 : 1;
    return b.utility - a.utility || a.name.localeCompare(b.name);
  });
}

export function filterByRole(items: R.HuntingItem[], role: string | null): R.HuntingItem[] {
  return role ? items.filter((i) => i.roles.includes(role)) : items;
}

export interface AmmoLine { role: string; label: string; cartridge: string; rounds: number; packs: number; packSize: number; shelfLifeYears: number }

export function calcAmmo(plan: Plan, roles: R.AmmoRole[] = R.ammoRoles): AmmoLine[] {
  const years = Math.max(planDays(plan) / 365, 0.25);
  return roles
    .filter((r) => plan.huntingRoles.includes(r.id))
    .map((r) => {
      const rounds = Math.ceil(r.minimum + (r.roundsPerYear + r.practicePerYear) * years);
      const packs = Math.ceil(rounds / r.packSize);
      return { role: r.id, label: r.label, cartridge: r.cartridge, rounds: packs * r.packSize, packs, packSize: r.packSize, shelfLifeYears: r.shelfLifeYears };
    });
}

export const ROLES: { id: string; label: string }[] = [
  { id: 'small-game', label: 'Small game' },
  { id: 'big-game', label: 'Big game' },
  { id: 'bird', label: 'Birds' },
  { id: 'predator-defence', label: 'Predator / defence' },
  { id: 'trapline', label: 'Trapline' },
  { id: 'multi-role', label: 'Multi-role' },
  { id: 'fish', label: 'Fish' },
  { id: 'processing', label: 'Processing' },
  { id: 'security', label: 'Security' },
  { id: 'reloading', label: 'Reloading' },
];

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'firearm', label: 'Firearms' },
  { id: 'airgun', label: 'Air guns' },
  { id: 'archery', label: 'Bows, crossbows, slingshots' },
  { id: 'trapping', label: 'Trapping' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'processing', label: 'Game processing & preservation' },
  { id: 'defence', label: 'Defence & security' },
  { id: 'reloading', label: 'Reloading' },
];

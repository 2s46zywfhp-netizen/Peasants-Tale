import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { normalizePlan, type Plan } from '../calc/plan';
import { effectiveClimate, type Climate, type LocationProfile } from '../calc/climate';

/** The active location profile and household plan live in the settings table (so backups include them). */

export function useProfile(): { profile: LocationProfile | null; climate: Climate | null; loading: boolean } {
  const row = useLiveQuery(() => db.settings.get('profile'), [], 'loading' as const);
  if (row === 'loading') return { profile: null, climate: null, loading: true };
  const profile = (row?.value as LocationProfile | undefined) ?? null;
  return { profile, climate: profile ? effectiveClimate(profile) : null, loading: false };
}

export function saveProfile(p: LocationProfile) {
  return db.settings.put({ key: 'profile', value: p });
}

export function usePlan(): { plan: Plan; loading: boolean } {
  const row = useLiveQuery(() => db.settings.get('plan'), [], 'loading' as const);
  if (row === 'loading') return { plan: normalizePlan(null), loading: true };
  return { plan: normalizePlan(row?.value as Partial<Plan> | undefined), loading: false };
}

export function savePlan(p: Plan) {
  return db.settings.put({ key: 'plan', value: p });
}

import type { Sighting } from './types';

// Public values only. The eBird key lives in Supabase secrets, never here.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export async function fetchSightings(lat: number, lng: number): Promise<Sighting[]> {
  if (!backendConfigured) throw new Error('Backend not set up yet');
  const url = `${SUPABASE_URL}/functions/v1/sightings?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&dist=50&back=7`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error(`Couldn't load sightings (${res.status})`);
  const body = (await res.json()) as { sightings?: Sighting[] };
  return body.sightings ?? [];
}

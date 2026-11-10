export type Group = 'duck' | 'goose' | 'coot';
export type GroupFilter = 'all' | Group;

/** Matches `Sighting` in supabase/functions/_shared/waterfowl.ts. */
export interface Sighting {
  id: string;
  speciesCode: string;
  name: string;
  group: Group;
  count: number | null;
  /** eBird local time, "YYYY-MM-DD HH:mm" or "YYYY-MM-DD". */
  when: string;
  place: string;
  lat: number;
  lng: number;
}

// Pure helpers shared by the edge function. No Deno or network APIs here,
// so the same file is unit-tested with Vitest.

export type Group = 'duck' | 'goose' | 'coot';

/** One row of the eBird taxonomy (only the fields we use). */
export interface TaxonRow {
  speciesCode: string;
  comName: string;
  sciName: string;
  category: string;
  familySciName?: string;
}

/** One eBird observation (only the fields we use). */
export interface EbirdObs {
  speciesCode: string;
  comName: string;
  sciName: string;
  locName: string;
  obsDt: string;
  howMany?: number;
  lat: number;
  lng: number;
  subId: string;
}

export interface Sighting {
  id: string;
  speciesCode: string;
  name: string;
  group: Group;
  count: number | null;
  when: string;
  place: string;
  lat: number;
  lng: number;
}

// Goose and swan genera. Swans show as geese (grey) on the map.
const GOOSE_GENERA = new Set(['Anser', 'Branta', 'Cygnus', 'Coscoroba', 'Cereopsis', 'Chen']);

/**
 * Sorts a taxonomy row into duck / goose / coot, or null if it is not waterfowl.
 * Waterfowl = family Anatidae (ducks, geese, swans) + coots (genus Fulica, family Rallidae).
 */
export function classify(row: TaxonRow): Group | null {
  const genus = row.sciName.split(' ')[0] ?? '';
  if (row.familySciName === 'Anatidae') {
    return GOOSE_GENERA.has(genus) || /\b(goose|swan)\b/i.test(row.comName) ? 'goose' : 'duck';
  }
  if (row.familySciName === 'Rallidae' && (genus === 'Fulica' || /\bcoot\b/i.test(row.comName))) {
    return 'coot';
  }
  return null;
}

/** speciesCode -> group, for every species-level waterfowl taxon. */
export function buildWaterfowlIndex(rows: TaxonRow[]): Map<string, Group> {
  const index = new Map<string, Group>();
  for (const row of rows) {
    if (row.category !== 'species') continue;
    const group = classify(row);
    if (group) index.set(row.speciesCode, group);
  }
  return index;
}

/** Turns raw eBird observations into map sightings, dropping duplicates and non-waterfowl. */
export function toSightings(obs: EbirdObs[], index: Map<string, Group>): Sighting[] {
  const seen = new Set<string>();
  const out: Sighting[] = [];
  for (const o of obs) {
    const group = index.get(o.speciesCode);
    if (!group) continue;
    const id = `${o.subId}:${o.speciesCode}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      speciesCode: o.speciesCode,
      name: o.comName,
      group,
      count: typeof o.howMany === 'number' ? o.howMany : null,
      when: o.obsDt,
      place: o.locName,
      lat: o.lat,
      lng: o.lng,
    });
  }
  return out;
}

/** Parses and clamps query params. eBird caps radius at 50 km and lookback at 30 days. */
export function parseQuery(params: URLSearchParams): { lat: number; lng: number; dist: number; back: number } | null {
  const rawLat = params.get('lat');
  const rawLng = params.get('lng');
  if (!rawLat || !rawLng) return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const dist = Math.min(50, Math.max(1, Number(params.get('dist') ?? 50) || 50));
  const back = Math.min(30, Math.max(1, Number(params.get('back') ?? 7) || 7));
  return { lat, lng, dist, back };
}

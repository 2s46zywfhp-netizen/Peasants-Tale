// GET /functions/v1/sightings?lat=..&lng=..[&dist=50&back=7]
// Returns recent duck / goose / coot sightings near a point, from eBird.
// The eBird key stays here, on the backend. Set it with:
//   supabase secrets set EBIRD_API_KEY=...
import {
  buildWaterfowlIndex,
  parseQuery,
  toSightings,
  type EbirdObs,
  type Group,
  type TaxonRow,
} from '../_shared/waterfowl.ts';

const EBIRD = 'https://api.ebird.org/v2';
const TAXONOMY_TTL_MS = 24 * 60 * 60 * 1000;
const RESULT_TTL_MS = 30 * 60 * 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

let taxonomy: { index: Map<string, Group>; at: number } | null = null;
const resultCache = new Map<string, { body: string; at: number }>();

async function ebird<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${EBIRD}${path}`, { headers: { 'X-eBirdApiToken': key } });
  if (!res.ok) throw new Error(`eBird ${res.status} on ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

// Species list comes from the eBird taxonomy, not a hardcoded list.
async function waterfowlIndex(key: string): Promise<Map<string, Group>> {
  if (taxonomy && Date.now() - taxonomy.at < TAXONOMY_TTL_MS) return taxonomy.index;
  const rows = await ebird<TaxonRow[]>('/ref/taxonomy/ebird?fmt=json&cat=species', key);
  taxonomy = { index: buildWaterfowlIndex(rows), at: Date.now() };
  return taxonomy.index;
}

function json(body: string, status = 200): Response {
  return new Response(body, { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const key = Deno.env.get('EBIRD_API_KEY');
  if (!key) return json(JSON.stringify({ error: 'EBIRD_API_KEY is not set' }), 500);

  const q = parseQuery(new URL(req.url).searchParams);
  if (!q) return json(JSON.stringify({ error: 'lat and lng are required' }), 400);

  // Round to ~1 km so nearby users share a cache entry.
  const cacheKey = `${q.lat.toFixed(2)},${q.lng.toFixed(2)},${q.dist},${q.back}`;
  const hit = resultCache.get(cacheKey);
  if (hit && Date.now() - hit.at < RESULT_TTL_MS) return json(hit.body);

  try {
    const index = await waterfowlIndex(key);
    const area = `lat=${q.lat}&lng=${q.lng}&dist=${q.dist}&back=${q.back}`;

    // geo/recent gives one (latest) record per species. Use it to learn which
    // waterfowl are around, then fetch every sighting of each of those species.
    const latest = await ebird<EbirdObs[]>(`/data/obs/geo/recent?${area}`, key);
    const present = [...new Set(latest.map((o) => o.speciesCode).filter((c) => index.has(c)))];
    const perSpecies = await Promise.all(
      present.map((code) => ebird<EbirdObs[]>(`/data/obs/geo/recent/${code}?${area}`, key).catch(() => [])),
    );

    const sightings = toSightings([...latest, ...perSpecies.flat()], index);
    const body = JSON.stringify({ sightings, source: 'eBird', fetchedAt: new Date().toISOString() });
    resultCache.set(cacheKey, { body, at: Date.now() });
    return json(body);
  } catch (err) {
    return json(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), 502);
  }
});

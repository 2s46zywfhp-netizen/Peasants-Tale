/**
 * Rebuilds data/ontario-climate.json from Environment and Climate Change Canada
 * 1981-2010 climate normals (api.weather.gc.ca). Needs internet; the app never does.
 * Run: npx vite-node scripts/build-climate.ts
 */
import { writeFileSync } from 'node:fs';
import { ECCC_IDS, parseEcccNormals, type EcccNormalRow, type Station } from '../src/calc/climate';

const API = 'https://api.weather.gc.ca/collections/climate-normals/items';

async function fetchAll(params: Record<string, string>) {
  const out: { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }[] = [];
  let offset = 0;
  for (;;) {
    const q = new URLSearchParams({ f: 'json', limit: '10000', offset: String(offset), PROVINCE_CODE: 'ON', CURRENT_FLAG: 'Y', ...params });
    const res = await fetch(`${API}?${q}`);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const j = (await res.json()) as { features: typeof out };
    out.push(...j.features);
    if (j.features.length < 10000) return out;
    offset += 10000;
  }
}

const rowsByStation = new Map<string, { name: string; lat: number; lon: number; rows: EcccNormalRow[] }>();
for (const id of Object.values(ECCC_IDS)) {
  const feats = await fetchAll({ NORMAL_ID: String(id) });
  console.log(`element ${id}: ${feats.length} rows`);
  for (const f of feats) {
    const p = f.properties as { CLIMATE_IDENTIFIER: string; STATION_NAME: string; NORMAL_ID: number; MONTH: number | null; VALUE: number | null };
    let s = rowsByStation.get(p.CLIMATE_IDENTIFIER);
    if (!s) {
      s = { name: p.STATION_NAME, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], rows: [] };
      rowsByStation.set(p.CLIMATE_IDENTIFIER, s);
    }
    s.rows.push({ NORMAL_ID: p.NORMAL_ID, MONTH: p.MONTH, VALUE: p.VALUE });
  }
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bA$/, '(Airport)');
const records: Station[] = [...rowsByStation.entries()]
  .map(([id, s]) => ({ id, name: titleCase(s.name), lat: Math.round(s.lat * 1e4) / 1e4, lon: Math.round(s.lon * 1e4) / 1e4, ...parseEcccNormals(s.rows) }))
  .filter((s) => s.lastFrostDoy != null && s.firstFrostDoy != null)
  .sort((a, b) => b.lat - a.lat);

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  new URL('../data/ontario-climate.json', import.meta.url),
  JSON.stringify(
    {
      dataset: 'ontario-climate',
      version: '1.0.0',
      updated: today,
      description:
        'Ontario climate stations with 1981-2010 normals from ECCC (api.weather.gc.ca). Frost dates are day-of-year. snowMonths = months averaging 15+ days with >=1 cm snow on ground. Regenerate with scripts/build-climate.ts.',
      source: 'eccc-normals',
      records,
    },
    null,
    1,
  ) + '\n',
);
console.log(`wrote ${records.length} stations`);

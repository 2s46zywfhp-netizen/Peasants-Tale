/** Optional online refreshes. The app works without these. */
import { deriveFromDaily, haversineKm, parseEcccNormals, ECCC_IDS, doyToMmDd, type Climate, type EcccNormalRow } from '../calc/climate';

export async function fetchOpenMeteo(lat: number, lon: number, endYear = new Date().getFullYear() - 1): Promise<{ values: Partial<Climate>; detail: string }> {
  const startYear = endYear - 9;
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: `${startYear}-01-01`,
    end_date: `${endYear}-12-31`,
    daily: 'temperature_2m_min,temperature_2m_mean,precipitation_sum,snow_depth_max',
    timezone: 'auto',
  });
  const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${q}`);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const j = await res.json();
  const d = j.daily;
  const r = deriveFromDaily({ time: d.time, tmin: d.temperature_2m_min, tmean: d.temperature_2m_mean, precip: d.precipitation_sum, snowDepthM: d.snow_depth_max });
  if (!r.years) throw new Error('No complete years of data returned.');
  const { years, ...values } = r;
  return { values, detail: `Open-Meteo reanalysis ${startYear}–${endYear} (${years} years). Design low estimated from January daily minimums.` };
}

export async function fetchEcccNormals(lat: number, lon: number): Promise<{ values: Partial<Climate>; detail: string }> {
  const api = 'https://api.weather.gc.ca/collections/climate-normals/items';
  const bbox = [lon - 2, lat - 1.5, lon + 2, lat + 1.5].map((n) => n.toFixed(3)).join(',');
  const res = await fetch(`${api}?${new URLSearchParams({ f: 'json', limit: '500', NORMAL_ID: '13', CURRENT_FLAG: 'Y', bbox })}`);
  if (!res.ok) throw new Error(`ECCC error ${res.status}`);
  const stations = (await res.json()).features as { properties: { CLIMATE_IDENTIFIER: string; STATION_NAME: string }; geometry: { coordinates: [number, number] } }[];
  if (!stations.length) throw new Error('No ECCC normals station with frost data within ~150 km.');
  let best = stations[0];
  let bestKm = Infinity;
  for (const s of stations) {
    const km = haversineKm(lat, lon, s.geometry.coordinates[1], s.geometry.coordinates[0]);
    if (km < bestKm) [best, bestKm] = [s, km];
  }
  const ids = Object.values(ECCC_IDS).join(',');
  const res2 = await fetch(`${api}?${new URLSearchParams({ f: 'json', limit: '2000', CLIMATE_IDENTIFIER: best.properties.CLIMATE_IDENTIFIER, properties: 'NORMAL_ID,MONTH,VALUE' })}`);
  if (!res2.ok) throw new Error(`ECCC error ${res2.status}`);
  const rows = ((await res2.json()).features as { properties: EcccNormalRow }[]).map((f) => f.properties).filter((r) => ids.includes(String(r.NORMAL_ID)));
  const s = parseEcccNormals(rows);
  const values: Partial<Climate> = { snowMonths: s.snowMonths };
  if (s.lastFrostDoy != null) values.lastFrost = doyToMmDd(s.lastFrostDoy);
  if (s.firstFrostDoy != null) values.firstFrost = doyToMmDd(s.firstFrostDoy);
  if (s.frostFreeDays != null) values.frostFreeDays = s.frostFreeDays;
  if (s.annualPrecipMm != null) values.annualPrecipMm = s.annualPrecipMm;
  if (s.hdd != null) values.hdd = s.hdd;
  if (s.janMeanC != null) values.janMeanC = s.janMeanC;
  return { values, detail: `ECCC climate normals, station ${best.properties.STATION_NAME} (${Math.round(bestKm)} km away).` };
}

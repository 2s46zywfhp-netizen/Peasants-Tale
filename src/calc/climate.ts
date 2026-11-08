/** Climate lookup and derivation. Pure functions: no network, no DOM. */

export interface Station {
  id: string; // ECCC climate identifier
  name: string;
  lat: number;
  lon: number;
  lastFrostDoy: number | null;
  firstFrostDoy: number | null;
  frostFreeDays: number | null;
  annualPrecipMm: number | null;
  janMeanC: number | null;
  janMeanMinC: number | null;
  hdd: number | null; // heating degree-days below 18 °C
  snowMonths: number[]; // months (1-12) averaging >= 15 days with snow on the ground
}

export interface RefTown {
  id: string;
  name: string;
  lat: number;
  lon: number;
  zone: string; // NRCan plant hardiness zone, e.g. "3a"
  designLowC: number; // NBC January 2.5 % design temperature
  fsa: string[]; // postal code prefixes (first 3 chars) that map here
}

export interface Climate {
  zone: string;
  lastFrost: string; // MM-DD
  firstFrost: string; // MM-DD
  frostFreeDays: number;
  designLowC: number;
  annualPrecipMm: number;
  snowMonths: number[];
  hdd: number;
  janMeanC: number;
}

export type ClimateField = keyof Climate;

export interface LocationProfile {
  name: string;
  input: { kind: 'postal' | 'gps' | 'latlon' | 'town'; value: string };
  lat: number;
  lon: number;
  stationId: string;
  stationName: string;
  stationKm: number;
  townName: string;
  townKm: number;
  derived: Climate;
  overrides: Partial<Climate>;
  refreshed?: { source: 'open-meteo' | 'eccc'; at: string; detail: string };
  notes: string[];
}

export function effectiveClimate(p: LocationProfile): Climate {
  return { ...p.derived, ...p.overrides };
}

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLon = r(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearest<T extends { lat: number; lon: number }>(items: T[], lat: number, lon: number): { item: T; km: number } {
  let best = items[0];
  let bestKm = Infinity;
  for (const it of items) {
    const km = haversineKm(lat, lon, it.lat, it.lon);
    if (km < bestKm) {
      best = it;
      bestKm = km;
    }
  }
  return { item: best, km: bestKm };
}

/** Day of year (1-366, non-leap reference year) -> "MM-DD". */
export function doyToMmDd(doy: number): string {
  const d = new Date(Date.UTC(2023, 0, 1) + (Math.round(doy) - 1) * 86400000);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function mmDdToDoy(mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number);
  return Math.round((Date.UTC(2023, m - 1, d) - Date.UTC(2023, 0, 1)) / 86400000) + 1;
}

/** "3a" -> 3, "3b" -> 3.5. Unknown -> NaN. */
export function zoneValue(zone: string): number {
  const m = /^(\d)([ab])?$/.exec(zone.trim().toLowerCase());
  if (!m) return NaN;
  return Number(m[1]) + (m[2] === 'b' ? 0.5 : 0);
}

export function normalizePostal(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(s) ? s : null;
}

/** Postal code -> reference town. Exact FSA first, then first letter. */
export function townForPostal(postal: string, towns: RefTown[]): { town: RefTown; exact: boolean } | null {
  const p = normalizePostal(postal);
  if (!p) return null;
  const fsa = p.slice(0, 3);
  const exact = towns.find((t) => t.fsa.includes(fsa));
  if (exact) return { town: exact, exact: true };
  const letter = towns.find((t) => t.fsa.includes(fsa[0]));
  return letter ? { town: letter, exact: false } : null;
}

export function climateFrom(station: Station, town: RefTown): Climate {
  return {
    zone: town.zone,
    lastFrost: station.lastFrostDoy != null ? doyToMmDd(station.lastFrostDoy) : '05-25',
    firstFrost: station.firstFrostDoy != null ? doyToMmDd(station.firstFrostDoy) : '09-20',
    frostFreeDays: station.frostFreeDays ?? 110,
    designLowC: town.designLowC,
    annualPrecipMm: station.annualPrecipMm ?? 800,
    snowMonths: station.snowMonths,
    hdd: station.hdd ?? 5000,
    janMeanC: station.janMeanC ?? -13,
  };
}

export function buildProfile(
  lat: number,
  lon: number,
  input: LocationProfile['input'],
  stations: Station[],
  towns: RefTown[],
  name = 'Home',
): LocationProfile {
  const usable = stations.filter((s) => s.lastFrostDoy != null && s.firstFrostDoy != null);
  const st = nearest(usable, lat, lon);
  const tw = nearest(towns, lat, lon);
  const notes: string[] = [];
  if (st.km > 75) notes.push(`Nearest climate station is ${Math.round(st.km)} km away; local frost dates may differ. Use online refresh or edit values.`);
  if (tw.km > 75) notes.push(`Hardiness zone and design low taken from ${tw.item.name}, ${Math.round(tw.km)} km away.`);
  return {
    name,
    input,
    lat,
    lon,
    stationId: st.item.id,
    stationName: st.item.name,
    stationKm: Math.round(st.km),
    townName: tw.item.name,
    townKm: Math.round(tw.km),
    derived: climateFrom(st.item, tw.item),
    overrides: {},
    notes,
  };
}

// ---------- ECCC climate normals (api.weather.gc.ca) ----------

export interface EcccNormalRow {
  NORMAL_ID: number;
  MONTH: number | null;
  VALUE: number | null;
}

export const ECCC_IDS = { meanTemp: 1, meanMin: 8, lastFrost: 13, firstFrost: 14, frostFree: 21, hdd18: 32, precip: 56, snowDays1cm: 76 } as const;

/** Turns one station's ECCC normals rows into the fields we use. Month 13 = annual. */
export function parseEcccNormals(rows: EcccNormalRow[]): Omit<Station, 'id' | 'name' | 'lat' | 'lon'> {
  const get = (id: number, month: number) => rows.find((r) => r.NORMAL_ID === id && r.MONTH === month)?.VALUE ?? null;
  const snowMonths: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const days = get(ECCC_IDS.snowDays1cm, m);
    if (days != null && days >= 15) snowMonths.push(m);
  }
  const r1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
  return {
    lastFrostDoy: get(ECCC_IDS.lastFrost, 13),
    firstFrostDoy: get(ECCC_IDS.firstFrost, 13),
    frostFreeDays: get(ECCC_IDS.frostFree, 13),
    annualPrecipMm: r1(get(ECCC_IDS.precip, 13)) != null ? Math.round(get(ECCC_IDS.precip, 13)!) : null,
    janMeanC: r1(get(ECCC_IDS.meanTemp, 1)),
    janMeanMinC: r1(get(ECCC_IDS.meanMin, 1)),
    hdd: get(ECCC_IDS.hdd18, 13) != null ? Math.round(get(ECCC_IDS.hdd18, 13)!) : null,
    snowMonths,
  };
}

// ---------- Open-Meteo historical daily data ----------

export interface DailySeries {
  time: string[]; // YYYY-MM-DD
  tmin: (number | null)[];
  tmean: (number | null)[];
  precip: (number | null)[];
  snowDepthM: (number | null)[];
}

function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))));
  return s[idx];
}

/**
 * Derives frost dates, frost-free days, design low, precipitation, HDD and snow months
 * from several full years of daily data. Frost = daily minimum <= 0 °C.
 * Design low is approximated as the 2.5th percentile of January daily minimums.
 */
export function deriveFromDaily(d: DailySeries): Partial<Climate> & { years: number } {
  const byYear = new Map<number, number[]>();
  d.time.forEach((t, i) => {
    const y = Number(t.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(i);
  });
  const lasts: number[] = [];
  const firsts: number[] = [];
  let precipTotal = 0;
  let hddTotal = 0;
  const janMins: number[] = [];
  const janMeans: number[] = [];
  const snowDaysByMonth = new Array(12).fill(0);
  let fullYears = 0;
  for (const [, idxs] of byYear) {
    if (idxs.length < 365) continue;
    fullYears++;
    let last = -1;
    let first = -1;
    for (const i of idxs) {
      const doy = mmDdToDoy(d.time[i].slice(5));
      const tmin = d.tmin[i];
      if (tmin != null && tmin <= 0) {
        if (doy < 182) last = doy;
        else if (first < 0) first = doy;
      }
      precipTotal += d.precip[i] ?? 0;
      const tm = d.tmean[i];
      if (tm != null) hddTotal += Math.max(0, 18 - tm);
      const month = Number(d.time[i].slice(5, 7));
      if (month === 1) {
        if (tmin != null) janMins.push(tmin);
        if (tm != null) janMeans.push(tm);
      }
      if ((d.snowDepthM[i] ?? 0) >= 0.01) snowDaysByMonth[month - 1]++;
    }
    if (last > 0) lasts.push(last);
    if (first > 0) firsts.push(first);
  }
  if (fullYears === 0) return { years: 0 };
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const out: Partial<Climate> & { years: number } = { years: fullYears };
  if (lasts.length) out.lastFrost = doyToMmDd(avg(lasts));
  if (firsts.length) out.firstFrost = doyToMmDd(avg(firsts));
  if (lasts.length && firsts.length) out.frostFreeDays = Math.round(avg(firsts) - avg(lasts) - 1);
  out.annualPrecipMm = Math.round(precipTotal / fullYears);
  out.hdd = Math.round(hddTotal / fullYears);
  if (janMins.length) out.designLowC = Math.round(percentile(janMins, 2.5));
  if (janMeans.length) out.janMeanC = Math.round(avg(janMeans) * 10) / 10;
  out.snowMonths = snowDaysByMonth.map((n, m) => [n / fullYears, m + 1]).filter(([avgDays]) => avgDays >= 15).map(([, m]) => m);
  return out;
}

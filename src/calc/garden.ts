/** Garden log: year-over-year summary from journal entries of type "garden". */
import type { JournalEntry } from '../db/types';

export interface CropYear { crop: string; year: number; firstPlanted?: string; harvestQty: number; harvestUnit: string; harvests: number; seedSaved: boolean }
export interface FrostYear { year: number; lastSpring?: string; firstFall?: string; events: string[] }

const key = (s: string) => s.trim().toLowerCase();

export function gardenSummary(entries: JournalEntry[]): { crops: CropYear[]; frosts: FrostYear[]; years: number[] } {
  const crops = new Map<string, CropYear>();
  const frosts = new Map<number, FrostYear>();
  for (const e of entries) {
    if (e.type !== 'garden' || !e.garden || e.locked) continue;
    const year = Number(e.date.slice(0, 4));
    const day = e.date.slice(0, 10);
    const g = e.garden;
    if (g.event === 'frost') {
      const f = frosts.get(year) ?? { year, events: [] };
      f.events.push(day);
      const md = day.slice(5);
      if (md < '07-01') { if (!f.lastSpring || day > f.lastSpring) f.lastSpring = day; }
      else if (!f.firstFall || day < f.firstFall) f.firstFall = day;
      frosts.set(year, f);
      continue;
    }
    if (!g.crop.trim()) continue;
    const k = `${key(g.crop)}|${year}`;
    const c = crops.get(k) ?? { crop: g.crop.trim(), year, harvestQty: 0, harvestUnit: g.unit || 'kg', harvests: 0, seedSaved: false };
    if (g.event === 'planting' && (!c.firstPlanted || day < c.firstPlanted)) c.firstPlanted = day;
    if (g.event === 'harvest') {
      c.harvests++;
      if (g.qty && (!g.unit || g.unit === c.harvestUnit)) c.harvestQty += g.qty;
      else if (g.qty && c.harvests === 1) { c.harvestUnit = g.unit!; c.harvestQty += g.qty; }
    }
    if (g.event === 'seed-saved') c.seedSaved = true;
    crops.set(k, c);
  }
  const all = [...crops.values()].sort((a, b) => a.crop.localeCompare(b.crop) || a.year - b.year);
  const years = [...new Set([...all.map((c) => c.year), ...frosts.keys()])].sort();
  return { crops: all, frosts: [...frosts.values()].sort((a, b) => a.year - b.year), years };
}

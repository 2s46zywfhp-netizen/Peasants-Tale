/** Field guide data access, search, safety validation and seasonal calendar. */
import guideFile from '../../data/field-guide.json';
import imagesFile from '../../data/guide-images.json';
import calendarFile from '../../data/calendar.json';

export type Edibility = 'edible' | 'edible-caution' | 'medicinal' | 'toxic' | 'deadly';
export interface Lookalike { id: string | null; name: string; danger: 'deadly' | 'toxic' | 'harmless'; howToTell: string }
export interface GuideEntry {
  id: string;
  section: string;
  kind: 'plant' | 'mushroom' | 'skill' | 'reference' | 'hazard';
  title: string;
  latin?: string;
  edibility?: Edibility;
  summary: string;
  idFeatures?: string[];
  habitat?: string;
  season?: number[];
  seasonNote?: string;
  prep?: string;
  steps?: string[];
  warnings?: string[];
  lookalikes?: Lookalike[];
  confusedWith?: string[];
  practiceRequired?: boolean;
  table?: { columns: string[]; rows: string[][] };
  diagram?: string;
  images: string[];
  related?: string[];
  sources?: string[];
  wiki?: string;
}
export interface GuideImage { id: string; file: string; title: string; author: string; licence: string; licenceUrl: string; sourceUrl: string }
export interface CalendarEvent { id: string; label: string; kind: string; months: number[] }

export const sections = guideFile.sections as { id: string; label: string }[];
export const guide = guideFile.records as unknown as GuideEntry[];
export const guideImages = imagesFile.records as GuideImage[];
export const calendarEvents = calendarFile.records as CalendarEvent[];

export const entryById = (id: string, list: GuideEntry[] = guide) => list.find((e) => e.id === id);
export const imageById = (id: string) => guideImages.find((i) => i.id === id);
export const isEdible = (e: { edibility?: string }) => e.edibility === 'edible' || e.edibility === 'edible-caution';

/**
 * Safety rules, enforced by tests and when saving user entries:
 * every edible entry lists lookalikes; every link points at a real entry; no edible mushroom without warnings.
 */
export function validateGuide(list: GuideEntry[] = guide, imageIds: string[] = guideImages.map((i) => i.id)): string[] {
  const ids = new Set(list.map((e) => e.id));
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (seen.has(e.id)) problems.push(`${e.id}: duplicate id`);
    seen.add(e.id);
    if (!sections.some((s) => s.id === e.section)) problems.push(`${e.id}: unknown section ${e.section}`);
    if (isEdible(e) && !(e.lookalikes && e.lookalikes.length)) problems.push(`${e.id}: edible entry has no lookalikes`);
    if (e.kind === 'mushroom' && isEdible(e) && !(e.warnings ?? []).some((w) => /Never eat a wild mushroom/.test(w))) problems.push(`${e.id}: mushroom missing safety warning`);
    for (const l of e.lookalikes ?? []) if (l.id && !ids.has(l.id)) problems.push(`${e.id}: lookalike ${l.id} missing`);
    for (const r of e.related ?? []) if (!ids.has(r)) problems.push(`${e.id}: related ${r} missing`);
    for (const i of e.images) if (!imageIds.includes(i)) problems.push(`${e.id}: image ${i} missing`);
    if (e.kind === 'skill' && !(e.steps && e.steps.length)) problems.push(`${e.id}: skill has no steps`);
  }
  return problems;
}

/** Simple ranked search over titles, latin names, summaries and features. */
export function searchGuide(q: string, list: GuideEntry[] = guide): GuideEntry[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = list.map((e) => {
    const title = `${e.title} ${e.latin ?? ''}`.toLowerCase();
    const body = [e.summary, ...(e.idFeatures ?? []), e.habitat, e.prep, ...(e.steps ?? []), ...(e.lookalikes ?? []).map((l) => l.name)].join(' ').toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 10;
      else if (body.includes(t)) score += 1;
      else return { e, score: 0 };
    }
    return { e, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.e);
}

export interface CalendarRow { label: string; kind: string; months: number[]; link?: string }

/** Months 1-12 → what's happening. Foraging rows come from guide seasons; the rest from calendar.json; garden dates from the profile. */
export function buildCalendar(list: GuideEntry[] = guide, events: CalendarEvent[] = calendarEvents, frost?: { last: string; first: string }): CalendarRow[] {
  const rows: CalendarRow[] = [];
  for (const e of list) if (isEdible(e) && e.season?.length && e.season.length < 12) rows.push({ label: e.title, kind: e.kind === 'mushroom' ? 'mushroom' : 'forage', months: [...new Set(e.season)].sort((a, b) => a - b), link: e.id });
  for (const ev of events) rows.push({ label: ev.label, kind: ev.kind, months: ev.months });
  if (frost) {
    const lm = Number(frost.last.slice(0, 2));
    const fm = Number(frost.first.slice(0, 2));
    rows.push({ label: `Last spring frost (~${frost.last})`, kind: 'garden', months: [lm] });
    rows.push({ label: `First fall frost (~${frost.first})`, kind: 'garden', months: [fm] });
  }
  return rows;
}

export function inMonth(rows: CalendarRow[], month: number): CalendarRow[] {
  return rows.filter((r) => r.months.includes(month));
}

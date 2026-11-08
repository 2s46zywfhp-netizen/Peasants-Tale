/** Turns text extracted from a PDF into draft field-guide entries. Pure: pdf.js extraction happens in the UI. */

export interface PdfLine { text: string; size: number; page: number }
export interface DraftEntry { title: string; section: string; body: string; page: number; include: boolean }

const SECTION_WORDS: [string, RegExp][] = [
  ['mushrooms', /mushroom|fung|amanita|bolete|chanterelle|morel|puffball/i],
  ['lookalikes', /poison|toxic|deadly|hemlock|lookalike|baneberry/i],
  ['cold', /hypotherm|frostbite|trench foot|cold injur|immersion/i],
  ['medical', /wound|bleed|tourniquet|splint|first aid|tccc|burn|fracture/i],
  ['ice', /\bice\b|ice thickness|through the ice/i],
  ['shelter', /shelter|quinzhee|lean-?to|snow (cave|trench)|debris hut|tarp/i],
  ['fire', /fire|tinder|ember|spark|kindling/i],
  ['navigation', /compass|navigat|map|bearing|declination/i],
  ['signalling', /signal|whistle|mirror|rescue beacon|plb/i],
  ['game', /fish|hunt|snare|trap|game|moose|hare|field dress/i],
  ['preservation', /dry|smok|cur(e|ing)|can(ning)?|ferment|pemmican|jerky|root cellar/i],
  ['water', /water|purif|boil|filter/i],
  ['foraging', /edible|berr|plant|root|leaf|forag|tea|nut/i],
];

/** Title keywords win over body keywords; specific sections are checked before general ones. */
export function guessSection(text: string, title = ''): string {
  for (const t of [title, text]) for (const [id, re] of SECTION_WORDS) if (t && re.test(t)) return id;
  return 'foraging';
}

/** Body text size = the font size that covers the most characters. */
export function bodySize(lines: PdfLine[]): number {
  const chars = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size * 2) / 2;
    chars.set(k, (chars.get(k) ?? 0) + l.text.length);
  }
  let best = 0, bestN = -1;
  for (const [k, n] of chars) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** A line is a heading if its font is clearly larger than body text, or it's a short ALL-CAPS line. */
export function isHeading(line: PdfLine, bodySize: number): boolean {
  const t = line.text.trim();
  if (t.length < 3 || t.length > 70 || /[.:;,]$/.test(t) || /^\d+$/.test(t)) return false;
  if (line.size >= bodySize * 1.25) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 8;
}

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);

export function splitIntoEntries(lines: PdfLine[]): DraftEntry[] {
  const clean = lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() })).filter((l) => l.text);
  const body = bodySize(clean);
  const out: DraftEntry[] = [];
  let cur: DraftEntry | null = null;
  for (const l of clean) {
    if (isHeading(l, body)) {
      if (cur) out.push(cur);
      cur = { title: titleCase(l.text), section: 'foraging', body: '', page: l.page, include: true };
    } else if (cur) {
      // Join wrapped lines; keep paragraph/bullet breaks.
      const startsNew = /^([•\-–*]|\d+[.)])\s/.test(l.text) || /[.!?:]$/.test(cur.body.trimEnd());
      cur.body += cur.body ? (startsNew ? '\n' : ' ') + l.text : l.text;
    }
  }
  if (cur) out.push(cur);
  return out
    .filter((d) => d.body.trim().length >= 20)
    .map((d) => ({ ...d, section: guessSection(d.body.slice(0, 400), d.title), include: true }));
}

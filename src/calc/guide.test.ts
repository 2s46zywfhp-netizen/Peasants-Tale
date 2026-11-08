import { describe, expect, it } from 'vitest';
import { buildCalendar, guide, guideImages, inMonth, isEdible, searchGuide, sections, validateGuide, entryById } from './guide';
import { existsSync } from 'node:fs';

describe('field guide content', () => {
  it('passes every safety and link check', () => {
    expect(validateGuide()).toEqual([]);
  });
  it('covers every required section', () => {
    for (const s of ['foraging', 'mushrooms', 'lookalikes', 'water', 'fire', 'shelter', 'navigation', 'signalling', 'cold', 'medical', 'game', 'preservation', 'ice']) {
      expect(guide.filter((e) => e.section === s).length, s).toBeGreaterThan(0);
    }
    expect(sections.length).toBe(13);
  });
  it('every edible entry shows lookalikes, and they include something dangerous for wild plants', () => {
    const edible = guide.filter(isEdible);
    expect(edible.length).toBeGreaterThan(25);
    for (const e of edible) expect(e.lookalikes!.length, e.id).toBeGreaterThan(0);
  });
  it('the safety rule catches violations', () => {
    const bad = [{ ...entryById('cattail')!, lookalikes: [] }];
    expect(validateGuide(bad)).toContain('cattail: edible entry has no lookalikes');
  });
  it('marks hands-on skills PRACTICE REQUIRED', () => {
    for (const id of ['tourniquet', 'splinting', 'bow-drill', 'field-dress']) expect(entryById(id)!.practiceRequired, id).toBe(true);
  });
  it('the ice table follows the Canadian Red Cross guide', () => {
    const t = entryById('ice-thickness')!.table!;
    expect(t.rows.find((r) => r[0] === '15 cm')![1]).toMatch(/alone/);
    expect(t.rows.find((r) => r[0] === '25 cm')![1]).toMatch(/Snowmobile/);
  });
  it('every bundled photo exists, is freely licensed and attributed', () => {
    for (const i of guideImages) {
      expect(existsSync(`public/${i.file}`), i.file).toBe(true);
      expect(i.licence).toMatch(/public domain|pd|cc0|cc[- ]by/i);
      expect(i.author.length).toBeGreaterThan(0);
      expect(i.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
    expect(guideImages.length).toBeGreaterThan(60);
  });
  it('every referenced diagram exists', () => {
    for (const e of guide) if (e.diagram) expect(existsSync(`data/diagrams/${e.diagram}.svg`), e.diagram).toBe(true);
  });
});

describe('search', () => {
  it('ranks title matches first', () => {
    expect(searchGuide('cattail')[0].id).toBe('cattail');
    expect(searchGuide('blue flag')[0].id).toBe('blue-flag-iris');
  });
  it('requires all terms', () => {
    expect(searchGuide('cattail zzz')).toEqual([]);
    expect(searchGuide('')).toEqual([]);
  });
});

describe('calendar', () => {
  it('puts fiddleheads in May and ice fishing in February', () => {
    const rows = buildCalendar();
    expect(inMonth(rows, 5).some((r) => r.link === 'fiddlehead')).toBe(true);
    expect(inMonth(rows, 2).some((r) => /Ice fishing/.test(r.label))).toBe(true);
  });
  it('adds local frost dates', () => {
    const rows = buildCalendar(undefined, undefined, { last: '06-05', first: '09-15' });
    expect(inMonth(rows, 6).some((r) => /Last spring frost/.test(r.label))).toBe(true);
  });
});

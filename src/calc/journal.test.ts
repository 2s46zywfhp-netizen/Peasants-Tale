import { describe, expect, it } from 'vitest';
import { gardenSummary } from './garden';
import { guessSection, isHeading, splitIntoEntries } from './pdfImport';
import { seal, unseal } from '../lib/pin';
import type { JournalEntry } from '../db/types';

const g = (date: string, event: NonNullable<JournalEntry['garden']>['event'], crop = '', qty?: number, unit?: string): JournalEntry => ({
  date, type: 'garden', title: '', body: '', tags: [], attachmentIds: [], garden: { event, crop, qty, unit }, createdAt: '', updatedAt: '',
});

describe('garden year-over-year', () => {
  it('summarizes planting, harvest totals, seed saving and frosts per year', () => {
    const r = gardenSummary([
      g('2025-05-20T09:00', 'planting', 'Potato'), g('2025-05-25T09:00', 'planting', 'potato '),
      g('2025-08-30T09:00', 'harvest', 'Potato', 20, 'kg'), g('2025-09-20T09:00', 'harvest', 'Potato', 15, 'kg'),
      g('2026-05-28T09:00', 'planting', 'Potato'), g('2026-09-01T09:00', 'harvest', 'Potato', 40, 'kg'), g('2026-09-02T09:00', 'seed-saved', 'Potato'),
      g('2025-06-02T06:00', 'frost'), g('2025-05-20T06:00', 'frost'), g('2025-09-12T06:00', 'frost'), g('2025-09-25T06:00', 'frost'),
    ]);
    expect(r.years).toEqual([2025, 2026]);
    const p25 = r.crops.find((c) => c.year === 2025)!;
    expect(p25.firstPlanted).toBe('2025-05-20');
    expect(p25.harvestQty).toBe(35);
    expect(p25.harvests).toBe(2);
    expect(r.crops.find((c) => c.year === 2026)!.seedSaved).toBe(true);
    expect(r.frosts[0]).toMatchObject({ year: 2025, lastSpring: '2025-06-02', firstFall: '2025-09-12' });
  });
  it('ignores non-garden and locked entries', () => {
    expect(gardenSummary([{ ...g('2025-05-20T09:00', 'planting', 'Kale'), locked: { salt: '', iv: '', data: '' } }]).crops).toEqual([]);
  });
});

describe('PIN lock', () => {
  it('round-trips with the right PIN and fails with the wrong one', async () => {
    const sealed = await seal({ title: 'Cache A', lat: 48.1, lon: -81.2 }, 'birch-472');
    expect(sealed.data).not.toContain('Cache A');
    expect(await unseal(sealed, 'birch-472')).toEqual({ title: 'Cache A', lat: 48.1, lon: -81.2 });
    await expect(unseal(sealed, '0000')).rejects.toThrow();
  });
  it('uses a fresh salt and IV each time', async () => {
    const a = await seal('x', '1234');
    const b = await seal('x', '1234');
    expect(a.salt).not.toBe(b.salt);
    expect(a.data).not.toBe(b.data);
  });
});

describe('PDF import', () => {
  const L = (text: string, size = 10, page = 1) => ({ text, size, page });
  it('detects headings by size or ALL CAPS', () => {
    expect(isHeading(L('Cattail', 16), 10)).toBe(true);
    expect(isHeading(L('WILD LEEK'), 10)).toBe(true);
    expect(isHeading(L('Boil for fifteen minutes.'), 10)).toBe(false);
    expect(isHeading(L('12'), 10)).toBe(false);
  });
  it('splits text into entries and guesses sections', () => {
    const drafts = splitIntoEntries([
      L('CATTAIL', 14), L('Edible shoots and roots grow in marshes.'), L('Peel the shoots and eat the core.'),
      L('QUINZHEE', 14), L('A snow shelter made by piling snow and'), L('hollowing it out after it sinters.'),
      L('NOTES', 14), L('short'),
    ]);
    expect(drafts.map((d) => d.title)).toEqual(['Cattail', 'Quinzhee']);
    expect(drafts[0].section).toBe('foraging');
    expect(drafts[1].section).toBe('shelter');
    expect(drafts[1].body).toBe('A snow shelter made by piling snow and hollowing it out after it sinters.');
  });
  it('uses the most common text size as body size, even with few lines', () => {
    const drafts = splitIntoEntries([
      L('Guide title', 21), L('Cattail', 16.5), L('Edible shoots and starchy roots grow in marshes and lake edges.', 12),
      L('Building a Quinzhee', 16.5), L('Pile snow two metres high and let it sinter for two hours.', 12),
      L('Treating Frostbite', 16.5), L('Rewarm in water at 37 to 39 degrees when there is no risk of refreezing.', 12),
    ]);
    expect(drafts.map((d) => [d.title, d.section])).toEqual([['Cattail', 'foraging'], ['Building a Quinzhee', 'shelter'], ['Treating Frostbite', 'cold']]);
  });
  it('guesses sections from keywords', () => {
    expect(guessSection('Treating frostbite')).toBe('cold');
    expect(guessSection('Tourniquet use')).toBe('medical');
    expect(guessSection('Destroying angel mushroom')).toBe('mushrooms');
  });
});

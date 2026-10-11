import { describe, expect, it } from 'vitest';
import { BLOCK_MS } from './balance';
import { advance, createLife, debugFastForward } from './sim';
import { NOTABLE, entryBlock, summarize } from './summary';

describe('acceptance 5: the Parchment Log summarizes a debug fast-forward of 1 week', () => {
  it('counts every action and meal, lists every notable entry, and nothing outside the week', () => {
    let s = advance(createLife(77, 0), 20 * BLOCK_MS + 1).state; // some history before the week
    const from = s.block;
    s = debugFastForward(s, 42, 20 * BLOCK_MS + 1);
    const to = s.block;
    expect(to - from).toBe(42);
    const sum = summarize(s.log, from, to, s.members[0]!.name);
    const week = s.log.filter((e) => entryBlock(e) >= from && entryBlock(e) < to);
    expect(sum.days).toBe(7);
    // Every action begun in the week is counted, by kind.
    const begun = week.filter((e) => e.action && e.action !== 'eat' && (e.type === 'auto' || e.type === 'action'));
    expect(Object.values(sum.counts).reduce((a, b) => a + b, 0)).toBe(begun.length);
    for (const e of begun) expect(sum.counts[e.action!]).toBe(begun.filter((x) => x.action === e.action).length);
    expect(sum.meals).toBe(week.filter((e) => e.action === 'eat').length);
    expect(sum.meals).toBeGreaterThan(7);
    // Every notable event appears, verbatim, in order.
    const notable = week.filter((e) => !e.action && NOTABLE.has(e.type));
    expect(sum.notable).toEqual(notable);
    for (const e of notable) expect(sum.lines.some((l) => l.endsWith(e.text))).toBe(true);
    // Nothing from before the week.
    const before = s.log.filter((e) => entryBlock(e) < from && NOTABLE.has(e.type));
    expect(before.length).toBeGreaterThan(0);
    for (const e of before) expect(sum.notable).not.toContain(e);
    expect(sum.lines[0]).toBe('7 days have passed.');
    expect(sum.lines.join(' ')).toMatch(/worked the strips|laboured for the lord/);
  });

  it('reads sensibly for a quiet day', () => {
    const s = createLife(1, 0);
    const sum = summarize(s.log, 6, 12, 'WAT');
    expect(sum.lines).toEqual(['A day has passed.', '26 MAR 1345 to 26 MAR 1345.', 'Nothing was eaten.', 'Nothing else of note.']);
  });
});

describe('every deed is told', () => {
  it('has words for every action but eating', async () => {
    const { PHRASE } = await import('./summary');
    const { ACTION_IDS } = await import('./actions');
    for (const id of ACTION_IDS) if (id !== 'eat') expect(PHRASE[id as Exclude<typeof id, 'eat'>], id).toBeDefined();
  });
});

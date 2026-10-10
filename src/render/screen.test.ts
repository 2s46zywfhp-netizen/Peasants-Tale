import { describe, expect, it } from 'vitest';
import { DMG_SHADES, PALETTE, buildDmgMap } from './palette';
import { integerScale } from './screen';

describe('integerScale', () => {
  it('fits a 390px-wide phone at an exact integer device scale', () => {
    // iPhone 12-15: 390 CSS px wide, DPR 3, shell leaves ~358px for the screen.
    expect(integerScale(358, 420, 3)).toBe(6); // 960 device px = 320 CSS px, 6 device px per game px
    expect(integerScale(358, 420, 2)).toBe(4);
    expect(integerScale(100, 100, 1)).toBe(1);
  });
});

describe('DMG map', () => {
  it('covers every palette colour with one of four shades', () => {
    const m = buildDmgMap();
    expect(m.size).toBe(PALETTE.length);
    expect(new Set(m.values())).toEqual(new Set([0, 1, 2, 3]));
    expect(DMG_SHADES.every((s) => (PALETTE as readonly string[]).includes(s))).toBe(true);
  });
});

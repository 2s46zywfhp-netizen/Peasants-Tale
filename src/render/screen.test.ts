import { describe, expect, it } from 'vitest';
import { DMG, DMG_SHADES } from './palette';
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
  it('collapses every palette colour to one of four shades, using all four', () => {
    expect(DMG).toHaveLength(16);
    expect(new Set(DMG)).toEqual(new Set(DMG_SHADES));
  });
});

import { describe, expect, it } from 'vitest';
import { DMG, DMG_SHADES } from './palette';
import { canvasSize, integerScale } from './screen';

describe('integerScale (physical pixels)', () => {
  it('uses the largest whole device-pixel scale that fits 256x224', () => {
    // 390 CSS px wide at DPR 3, ~366 px available: 1098 device px / 256 = 4.
    expect(integerScale(366, 600, 3)).toBe(4);
    // 375 at DPR 2: 351 * 2 / 256 = 2.
    expect(integerScale(351, 400, 2)).toBe(2);
    // 412 at DPR 2.625: 388 * 2.625 / 256 = 3.97 -> 3.
    expect(integerScale(388, 500, 2.625)).toBe(3);
    // Height can limit it.
    expect(integerScale(1000, 224, 1)).toBe(1);
    expect(integerScale(100, 100, 1)).toBe(1);
  });
  it('backing store is 256*scale x 224*scale, CSS size is backing / dpr', () => {
    expect(canvasSize(4, 3)).toEqual({ backW: 1024, backH: 896, cssW: 1024 / 3, cssH: 896 / 3 });
  });
});

describe('DMG map', () => {
  it('collapses every palette colour to one of four shades, using all four', () => {
    expect(DMG).toHaveLength(32);
    expect(new Set(DMG)).toEqual(new Set(DMG_SHADES));
  });
});

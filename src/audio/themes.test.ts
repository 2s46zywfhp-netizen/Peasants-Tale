import { describe, expect, it } from 'vitest';
import { THEMES, noteFreq } from './themes';

describe('seasonal themes', () => {
  it('has one theme per season, each in a minor mode, with matching melody and bass lengths', () => {
    expect(Object.keys(THEMES).sort()).toEqual(['autumn', 'spring', 'summer', 'winter']);
    for (const t of Object.values(THEMES)) {
      expect(t.scale[2]).toBe(3); // minor third over the drone
      expect(t.melody.length).toBe(t.bass.length);
    }
    expect(new Set(Object.values(THEMES).map((t) => t.melody.join())).size).toBe(4);
  });
  it('computes scale-degree frequencies', () => {
    const t = THEMES.summer;
    expect(noteFreq(t, 0, 0)).toBeCloseTo(55);
    expect(noteFreq(t, 7, 0)).toBeCloseTo(110); // an octave up
    expect(noteFreq(t, 2, 0)).toBeCloseTo(55 * Math.pow(2, 3 / 12));
  });
});

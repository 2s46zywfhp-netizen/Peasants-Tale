import type { Season } from '../sim/calendar';

/**
 * Seasonal themes: a minor-key drone under a square-wave melody and triangle bass.
 * Steps are eighth notes; numbers are scale degrees (0 = root), -1 is a rest.
 */
export interface Theme {
  bpm: number;
  /** Root frequency of the drone (Hz). */
  root: number;
  /** Semitone offsets of the scale. */
  scale: readonly number[];
  melody: readonly number[];
  bass: readonly number[];
}

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

export const THEMES: Record<Season, Theme> = {
  // Spring: Dorian on D, walking pace, a plough song.
  spring: {
    bpm: 84, root: 73.42, scale: DORIAN,
    melody: [4, -1, 3, 2, 3, -1, 4, -1, 5, 4, 3, -1, 2, -1, -1, -1, 0, -1, 2, 3, 4, -1, 3, 2, 3, -1, 2, 0, 1, -1, -1, -1],
    bass: [0, -1, -1, -1, 4, -1, -1, -1, 3, -1, -1, -1, 4, -1, -1, -1, 0, -1, -1, -1, 3, -1, -1, -1, 4, -1, -1, -1, 0, -1, -1, -1],
  },
  // Summer: Aeolian on A, brighter and quicker, harvest under a hard sun.
  summer: {
    bpm: 96, root: 55, scale: AEOLIAN,
    melody: [7, 6, 4, -1, 4, 5, 6, -1, 7, -1, 9, 7, 6, -1, 4, -1, 5, 4, 2, -1, 4, -1, 2, 1, 0, -1, 2, -1, 4, -1, -1, -1],
    bass: [0, -1, 0, -1, 5, -1, 5, -1, 3, -1, 3, -1, 4, -1, 4, -1, 0, -1, 0, -1, 5, -1, 5, -1, 4, -1, 4, -1, 0, -1, -1, -1],
  },
  // Autumn: Phrygian on E, slow and heavy with the dark half of the year.
  autumn: {
    bpm: 70, root: 82.41, scale: PHRYGIAN,
    melody: [0, -1, 1, -1, 0, -1, -1, -1, 3, -1, 2, 1, 0, -1, -1, -1, 4, -1, 3, -1, 1, -1, 0, -1, 1, -1, -1, -1, 0, -1, -1, -1],
    bass: [0, -1, -1, -1, -1, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1, 3, -1, -1, -1, 1, -1, -1, -1, 0, -1, -1, -1, -1, -1, -1, -1],
  },
  // Winter: Aeolian on C, sparse, long silences, the drone carries it.
  winter: {
    bpm: 58, root: 65.41, scale: AEOLIAN,
    melody: [4, -1, -1, -1, 3, -1, -1, -1, 2, -1, 0, -1, -1, -1, -1, -1, 2, -1, -1, -1, 3, -1, 4, -1, 2, -1, -1, -1, -1, -1, -1, -1],
    bass: [0, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1, -1, 3, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1],
  },
};

/** Frequency of scale degree `deg` above `root`, `oct` octaves up. */
export function noteFreq(t: Theme, deg: number, oct: number): number {
  const n = t.scale.length;
  const o = Math.floor(deg / n);
  const semis = t.scale[((deg % n) + n) % n]! + 12 * (o + oct);
  return t.root * Math.pow(2, semis / 12);
}

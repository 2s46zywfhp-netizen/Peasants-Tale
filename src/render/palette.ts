/** The only colours allowed anywhere in the game. */
export const PALETTE = [
  '#0b0d14', '#141a2e', '#1f2d4a', '#2e5a6b', '#3f8a8c', '#e8e0c4', '#8a9bb0', '#4a5468',
  '#8c2a2a', '#d4622a', '#5c1a1a', '#4a3326', '#6b4a32', '#3d5a3a', '#c9b99a', '#f2c14e',
] as const;
export type Colour = (typeof PALETTE)[number];

export const C = {
  black: '#0b0d14',
  night: '#141a2e',
  navy: '#1f2d4a',
  teal: '#2e5a6b',
  sea: '#3f8a8c',
  bone: '#e8e0c4',
  mist: '#8a9bb0',
  slate: '#4a5468',
  blood: '#8c2a2a',
  ember: '#d4622a',
  gore: '#5c1a1a',
  mud: '#4a3326',
  wood: '#6b4a32',
  moss: '#3d5a3a',
  parchment: '#c9b99a',
  gold: '#f2c14e',
} as const satisfies Record<string, Colour>;

/** DMG mode: four palette shades, darkest first. */
export const DMG_SHADES = ['#141a2e', '#2e5a6b', '#3f8a8c', '#e8e0c4'] as const satisfies readonly Colour[];

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const luma = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Maps each palette colour (packed 0xRRGGBB) to a DMG shade index by luminance rank. */
export function buildDmgMap(): Map<number, number> {
  const sorted = [...PALETTE].sort((a, b) => luma(hexToRgb(a)) - luma(hexToRgb(b)));
  const map = new Map<number, number>();
  sorted.forEach((hex, i) => {
    const [r, g, b] = hexToRgb(hex);
    map.set((r << 16) | (g << 8) | b, Math.min(3, Math.floor((i * 4) / sorted.length)));
  });
  return map;
}

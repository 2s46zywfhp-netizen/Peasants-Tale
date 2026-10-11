/**
 * The 32 colours: eight ramps of four, darkest first (index = ramp * 4 + shade). Nothing else is ever drawn.
 * Seasons, the hour, the pestilence and lighting are lookup tables over these indices, never tints.
 */
export const PALETTE = [
  '#07080d', '#0b0d14', '#141a2e', '#1f2d4a', // night
  '#1d3d47', '#2e5a6b', '#3f8a8c', '#6cb5a8', // teal
  '#a89f86', '#c9b99a', '#e8e0c4', '#f7f2df', // bone / moon
  '#4a5468', '#6b7689', '#8a9bb0', '#b4c0cf', // stone
  '#3a1012', '#5c1a1a', '#8c2a2a', '#b8432f', // blood
  '#d4622a', '#ec8f3a', '#f2c14e', '#fbe39a', // fire
  '#2e2019', '#4a3326', '#6b4a32', '#8f6a46', // earth
  '#1f3324', '#3d5a3a', '#5f7f4a', '#8aa65c', // moss
] as const;

export const RAMP = { night: 0, teal: 1, bone: 2, stone: 3, blood: 4, fire: 5, earth: 6, moss: 7 } as const;
export type RampName = keyof typeof RAMP;
/** Palette index of a ramp's shade (0 darkest .. 3 lightest). */
export const c = (ramp: RampName, shade: number): number => RAMP[ramp] * 4 + Math.max(0, Math.min(3, shade));

/** Named colours (the old 16-colour names map to the same colours, all of which are in the 32). */
export const C = {
  black: 0, ink: 1, night: 1, deep: 2, navy: 3,
  tealDark: 4, teal: 5, sea: 6, aqua: 7,
  bone0: 8, parchment: 9, bone: 10, moon: 11,
  slate: 12, stone: 13, mist: 14, frost: 15,
  gore0: 16, gore: 17, blood: 18, rust: 19,
  ember: 20, flame: 21, gold: 22, spark: 23,
  soil: 24, mud: 25, wood: 26, oak: 27,
  pine: 28, moss: 29, grass: 30, leaf: 31,
} as const;
export type Ci = number;
/** A table sending each palette index to another. */
export type Remap = Uint8Array;

export const IDENTITY: Remap = Uint8Array.from({ length: 32 }, (_, i) => i);
const table = (f: (i: number, ramp: number, shade: number) => number): Remap => Uint8Array.from({ length: 32 }, (_, i) => f(i, i >> 2, i & 3));
const R = RAMP;

/** One shade down its ramp; the darkest shade of any ramp falls into the night. */
export const DARKER: Remap = table((i, r, s) => (s > 0 ? i - 1 : r === R.night ? 0 : r === R.teal || r === R.stone ? 2 : 1));
/** One shade up; the lightest falls into the moon. */
export const LIGHTER: Remap = table((i, r, s) => (s < 3 ? i + 1 : r === R.fire ? c('fire', 3) : c('bone', 3)));
/** Firelight: stone and bone take on fire, earth warms, the dark turns to ember-brown. */
export const WARM: Remap = table((i, r, s) =>
  r === R.stone ? c('earth', s + 1) : r === R.bone ? c('fire', s) : r === R.night ? c('earth', s - 1) : r === R.teal ? c('earth', s) : r === R.moss ? c('earth', s + 1) : r === R.earth ? c('earth', s + 1) : i);

export const compose = (...ts: readonly Remap[]): Remap => table((i) => ts.reduce((v, t) => t[v]!, i));

/* ── seasons (applied to the world, never to the UI) ── */

export const SEASON_LUTS = {
  spring: IDENTITY,
  // Summer: grass goes gold at the tips, the light is warmer.
  summer: table((i, r, s) => (r === R.moss && s === 3 ? c('fire', 2) : r === R.moss ? c('moss', s + 1) : r === R.bone && s === 3 ? c('fire', 3) : i)),
  // Autumn: green turns to earth and ember.
  autumn: table((i, r, s) => (r === R.moss ? (s >= 2 ? c('fire', s - 2) : c('earth', s + 1)) : i)),
  // Winter: green and earth go grey and blue, the light goes cold.
  winter: table((i, r, s) => (r === R.moss ? c('stone', s) : r === R.earth && s >= 2 ? c('stone', s - 1) : r === R.fire && s < 2 ? c('earth', s + 2) : i)),
} as const;
export type SeasonName = keyof typeof SEASON_LUTS;

/** Fog: every colour pales toward the grey-blue of mist, keeping its shade. */
export const FOG_LUT: Remap = table((i, r, s) => (r === R.night || r === R.fire ? i : r === R.bone ? c('stone', 3) : c('stone', s)));

/** The pestilence: a sickly cast over skin, light and green. */
export const PLAGUE_LUT: Remap = table((i, r, s) => (r === R.bone ? c('teal', s) : r === R.fire ? c('moss', s) : r === R.moss ? c('teal', s) : r === R.blood ? c('blood', s - 1) : i));

/* ── the hours (ambient light; local lights leave lit pixels in true colour) ── */

/** Dawn: cold blue below, the first gold on the heights. */
const DAWN = table((i, r, s) => (r === R.bone ? c('stone', s + 1) : r === R.moss ? c('teal', s) : r === R.fire ? c('blood', s + 1) : i));
/** Dusk: everything red and ember. */
const DUSK = table((i, r, s) => (r === R.bone ? c('fire', s) : r === R.moss ? c('earth', s + 1) : r === R.teal ? c('night', s + 1) : r === R.stone && s < 2 ? c('blood', s + 1) : i));
/** Night under the moon: teal and navy, with the brightest things left cream. */
const NIGHT = table((i, r, s) =>
  r === R.bone ? (s >= 2 ? c('bone', s - 1) : c('teal', s + 1)) : r === R.fire || r === R.blood ? c('night', s) : r === R.night ? i : c(s >= 2 ? 'teal' : 'night', s >= 2 ? s - 1 : s + 1));
/** Per block of the day: dawn, morning, midday, afternoon, dusk, night. */
export const HOUR_LUTS: readonly Remap[] = [DAWN, IDENTITY, IDENTITY, table((i, r, s) => (r === R.bone && s === 3 ? c('fire', 3) : i)), DUSK, NIGHT];
/** Ambient light per block (0..15): how much the dark steps colours down where no lamp reaches. */
export const AMBIENT = [11, 15, 15, 14, 11, 9] as const;

/* ── DMG: the unlockable four-shade mode ── */

const luma = (h: string) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16);
/** Four greens of the old handheld, drawn from the palette's own teal and moss ramps. */
export const DMG_SHADES = [c('night', 1), c('moss', 0), c('moss', 2), c('moss', 3)] as const;
export const DMG: Remap = (() => {
  const order = PALETTE.map((h, i) => ({ i, l: luma(h) })).sort((a, b) => a.l - b.l);
  const r = new Uint8Array(32);
  order.forEach((o, rank) => (r[o.i] = DMG_SHADES[Math.min(3, Math.floor((rank * 4) / 32))]!));
  return r;
})();

let dmgMode = false;
export function setDmgMode(on: boolean): void {
  dmgMode = on;
}
export function dmgOn(): boolean {
  return dmgMode;
}

/** RGBA words (little-endian ABGR) for the 32 colours, for writing ImageData. */
export const RGBA32 = Uint32Array.from(PALETTE, (h) => (0xff000000 | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16)) >>> 0);

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

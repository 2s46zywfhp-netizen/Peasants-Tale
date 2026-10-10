/** The only colours allowed anywhere in the game. Everything is drawn by palette index. */
export const PALETTE = [
  '#0b0d14', '#141a2e', '#1f2d4a', '#2e5a6b', '#3f8a8c', '#e8e0c4', '#8a9bb0', '#4a5468',
  '#8c2a2a', '#d4622a', '#5c1a1a', '#4a3326', '#6b4a32', '#3d5a3a', '#c9b99a', '#f2c14e',
] as const;

/**
 * Palette indices by name. Sprite strings use the same indices as hex digits:
 * 0 black, 1 night, 2 navy, 3 teal, 4 sea, 5 bone, 6 mist, 7 slate,
 * 8 blood, 9 ember, a gore, b mud, c wood, d moss, e parchment, f gold.
 */
export const C = {
  black: 0, night: 1, navy: 2, teal: 3, sea: 4, bone: 5, mist: 6, slate: 7,
  blood: 8, ember: 9, gore: 10, mud: 11, wood: 12, moss: 13, parchment: 14, gold: 15,
} as const;
/** A palette index 0..15. */
export type Ci = number;

/** A remap sends each palette index to another palette index. */
export type Remap = Uint8Array;

export const IDENTITY: Remap = Uint8Array.from({ length: 16 }, (_, i) => i);

export function remapOf(changes: Readonly<Record<number, number>>): Remap {
  const r = Uint8Array.from(IDENTITY);
  for (const [k, v] of Object.entries(changes)) r[Number(k)] = v;
  return r;
}

/** Apply `first`, then each following remap. */
export function compose(...remaps: readonly Remap[]): Remap {
  const r = Uint8Array.from(IDENTITY);
  for (const m of remaps) for (let i = 0; i < 16; i++) r[i] = m[r[i]!]!;
  return r;
}

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const luma = ([r, g, b]: [number, number, number]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** DMG mode: four palette shades, darkest first. */
export const DMG_SHADES = [C.night, C.teal, C.sea, C.bone] as const;

/** Every palette index collapsed to one of the four DMG shades by luminance rank. */
export const DMG: Remap = (() => {
  const order = PALETTE.map((h, i) => ({ i, l: luma(hexToRgb(h)) })).sort((a, b) => a.l - b.l);
  const r = new Uint8Array(16);
  order.forEach((o, rank) => (r[o.i] = DMG_SHADES[Math.min(3, Math.floor((rank * 4) / 16))]!));
  return r;
})();

/* Seasons: spring is the base art (mud and moss). */
export const SEASON_REMAPS = {
  spring: IDENTITY,
  // Cold blue-grey: dead grass, bare wood, grey light.
  winter: remapOf({ [C.moss]: C.slate, [C.wood]: C.slate, [C.mud]: C.navy, [C.parchment]: C.mist, [C.gold]: C.mist, [C.ember]: C.blood, [C.sea]: C.mist }),
  // Gold: sunlit walls and straw, warm wood, bright water (skin, which is parchment, is left alone).
  summer: remapOf({ [C.bone]: C.gold, [C.mud]: C.wood, [C.teal]: C.sea, [C.slate]: C.mist, [C.moss]: C.moss }),
  // Ember: turning leaves and grass, low red sun.
  autumn: remapOf({ [C.moss]: C.wood, [C.wood]: C.ember, [C.gold]: C.ember, [C.parchment]: C.gold, [C.sea]: C.teal }),
} as const;

/** Plague years: a sickly green tint over skin, light and fire. */
export const PLAGUE: Remap = remapOf({ [C.parchment]: C.sea, [C.bone]: C.sea, [C.gold]: C.moss, [C.ember]: C.moss, [C.blood]: C.gore, [C.wood]: C.mud });

/** Light through the six blocks: dawn, morning, midday, afternoon, dusk, night. */
export const TIME_REMAPS: readonly Remap[] = [
  remapOf({ [C.bone]: C.parchment, [C.sea]: C.teal, [C.mist]: C.slate, [C.gold]: C.ember, [C.moss]: C.teal }),
  IDENTITY,
  IDENTITY,
  remapOf({ [C.bone]: C.parchment, [C.mist]: C.parchment }),
  remapOf({
    [C.bone]: C.ember, [C.parchment]: C.ember, [C.mist]: C.slate, [C.sea]: C.teal, [C.moss]: C.mud,
    [C.gold]: C.ember, [C.teal]: C.navy, [C.wood]: C.gore,
  }),
  // Moonlit teal and navy.
  remapOf({
    [C.bone]: C.sea, [C.parchment]: C.teal, [C.gold]: C.sea, [C.ember]: C.gore, [C.blood]: C.gore, [C.wood]: C.navy,
    [C.mud]: C.night, [C.moss]: C.navy, [C.mist]: C.teal, [C.slate]: C.navy, [C.sea]: C.teal, [C.teal]: C.navy,
    [C.navy]: C.night, [C.gore]: C.night,
  }),
];

export type SeasonName = keyof typeof SEASON_REMAPS;

/** The world remap for a moment; `lit` skips the time-of-day darkening (hearth and candle light). */
export function worldRemap(season: SeasonName, plague: boolean, bod: number, dmg: boolean, lit = false): Remap {
  const parts: Remap[] = [SEASON_REMAPS[season]];
  if (plague) parts.push(PLAGUE);
  if (!lit) parts.push(TIME_REMAPS[bod]!);
  if (dmg) parts.push(DMG);
  return compose(...parts);
}

export function remapKey(r: Remap): string {
  let k = '';
  for (let i = 0; i < 16; i++) k += r[i]!.toString(16);
  return k;
}

/* ── The remap in force for immediate-mode drawing (rects, text). ── */

let current: Remap = IDENTITY;
let dmgMode = false;

export function setDmgMode(on: boolean): void {
  dmgMode = on;
}
export function dmgOn(): boolean {
  return dmgMode;
}

export function setRemap(r: Remap): void {
  current = r;
}

/** UI screens: true colours, or DMG shades. */
export function useUiRemap(): void {
  current = dmgMode ? DMG : IDENTITY;
}

export function currentRemap(): Remap {
  return current;
}

/** Hex string for a palette index under the current remap. */
export function hex(i: Ci): string {
  return PALETTE[current[i]!]!;
}

import { AMBIENT, DARKER, DMG, HOUR_LUTS, IDENTITY, PLAGUE_LUT, RGBA32, SEASON_LUTS, WARM, compose, dmgOn, type Remap, type SeasonName } from './palette';

/** Internal resolution (SNES). */
export const W = 256;
export const H = 224;
/** Index meaning "nothing drawn here". */
export const NONE = 255;
/**
 * A palette index with this bit set is final: finishWorld leaves it alone (the sky's own colours, the moon,
 * stars, lit windows' glass). present() shows it as the plain colour.
 */
export const LOCK = 64;
/** Remap that locks every colour (blit a sprite that must not be darkened). */
export const LOCKED = Uint8Array.from({ length: 32 }, (_, i) => i | LOCK);

/**
 * The frame: palette indices, a per-pixel light level (0..15) from local sources, and whether the light
 * there is fire (warm). All preallocated; nothing in the frame loop allocates.
 */
export const pix = new Uint8Array(W * H);
export const light = new Uint8Array(W * H);
export const warm = new Uint8Array(W * H);

const BAYER = Uint8Array.from([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

/* ── lighting ── */

/** Clears the light map for a new frame of the world. */
export function resetLight(): void {
  light.fill(0);
  warm.fill(0);
}

/**
 * A light source: full `level` (0..15) at the centre, falling to nothing at `radius`. `fire` lights are warm.
 * `ry` squashes the pool vertically (light on a floor seen from the side).
 */
export function addLight(cx: number, cy: number, radius: number, level: number, fire: boolean, squash = 1): void {
  const x0 = Math.max(0, (cx - radius) | 0), x1 = Math.min(W - 1, (cx + radius) | 0);
  const ry = radius * squash;
  const y0 = Math.max(0, (cy - ry) | 0), y1 = Math.min(H - 1, (cy + ry) | 0);
  const inv = 1 / radius;
  const sq = 1 / squash;
  for (let y = y0; y <= y1; y++) {
    const dy = (y - cy) * sq;
    const row = y * W;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d = Math.sqrt(dx * dx + dy * dy) * inv;
      if (d >= 1) continue;
      const l = (level * (1 - d * d) + 0.5) | 0;
      const i = row + x;
      if (l > light[i]!) {
        light[i] = l;
        if (fire) warm[i] = 1;
      }
    }
  }
}

/* ── finishing the world: season, plague, the hour, and light ── */

/** [index * 3 + mode] * 4 + steps -> final index. mode 0 ambient (hour LUT), 1 lit, 2 lit by fire. */
const FINAL = new Uint8Array(32 * 3 * 4);
let finalKey = -1;
const SEASONS: readonly SeasonName[] = ['spring', 'summer', 'autumn', 'winter'];

function buildFinal(season: SeasonName, plague: boolean, bod: number): void {
  const base = plague ? compose(SEASON_LUTS[season], PLAGUE_LUT) : SEASON_LUTS[season];
  const hour = HOUR_LUTS[bod]!;
  for (let i = 0; i < 32; i++) {
    for (let mode = 0; mode < 3; mode++) {
      let v = base[i]!;
      if (mode === 0) v = hour[v]!;
      else if (mode === 2) v = WARM[v]!;
      for (let s = 0; s < 4; s++) {
        FINAL[(i * 3 + mode) * 4 + s] = v;
        v = DARKER[v]!;
      }
    }
  }
}

/** Per step count (0..3), the hour's ambient look for each colour, locked: for sprites that must read in any dark. */
const AMBIENT_LOCKED = [new Uint8Array(32), new Uint8Array(32), new Uint8Array(32), new Uint8Array(32)];
let ambientKey = -1;

/** The colours a pixel unlit by any lamp ends with at this hour, `steps` darker, already final (locked). */
export function ambientRemap(season: SeasonName, plague: boolean, bod: number, steps: number): Uint8Array {
  const key = (SEASONS.indexOf(season) * 2 + (plague ? 1 : 0)) * 6 + bod;
  if (key !== finalKey) {
    buildFinal(season, plague, bod);
    finalKey = key;
  }
  if (ambientKey !== key) {
    ambientKey = key;
    for (let s = 0; s < 4; s++) for (let v = 0; v < 32; v++) AMBIENT_LOCKED[s]![v] = FINAL[((v * 3) << 2) + s]! | LOCK;
  }
  return AMBIENT_LOCKED[Math.max(0, Math.min(3, steps))]!;
}

/** Steps darker the hour leaves a pixel no lamp reaches. */
export function ambientSteps(amb: number): number {
  return Math.min(3, Math.round((15 - amb) / 4));
}

/**
 * Applies season, plague, hour and light to the rows [y0, y1) of the world, in place.
 * Light: where a source is brighter than the ambient light, the true (or fire-warmed) colour shows; elsewhere
 * the hour's table. Either way, the darkness steps each colour down its ramp, ordered-dithered between steps.
 */
export function finishWorld(season: SeasonName, plague: boolean, bod: number, y0 = 0, y1 = H, ambientOverride = -1): void {
  const key = (SEASONS.indexOf(season) * 2 + (plague ? 1 : 0)) * 6 + bod;
  if (key !== finalKey) {
    buildFinal(season, plague, bod);
    finalKey = key;
  }
  const amb = ambientOverride >= 0 ? ambientOverride : AMBIENT[bod]!;
  // Where no lamp reaches: a flat step count for the hour (no dither: the dark stays calm).
  const ambSteps = ambientSteps(amb);
  for (let y = y0; y < y1; y++) {
    const row = y * W;
    const by = (y & 3) << 2;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      const v = pix[i]!;
      if (v >= 32) continue;
      const l = light[i]!;
      const b = BAYER[by + (x & 3)]!;
      // Lit where a source outshines the hour; its edge is dithered over four levels.
      if (l > amb && (l - amb) * 4 > b) {
        let steps = ((15 - l) * 4 + b) >> 4;
        if (steps > 3) steps = 3;
        pix[i] = FINAL[((v * 3 + (warm[i] ? 2 : 1)) << 2) + steps]!;
      } else pix[i] = FINAL[((v * 3) << 2) | ambSteps]!;
    }
  }
}

/* ── presenting ── */

let imageData: ImageData | null = null;
let rgba: Uint32Array | null = null;
const DMG32 = new Uint32Array(32);

/** Converts the frame to colour (DMG shades if on) and puts it on the 256x224 canvas. */
export function present(ctx: CanvasRenderingContext2D): void {
  if (!imageData) {
    imageData = ctx.createImageData(W, H);
    rgba = new Uint32Array(imageData.data.buffer);
    for (let i = 0; i < 32; i++) DMG32[i] = RGBA32[DMG[i]!]!;
  }
  const table = dmgOn() ? DMG32 : RGBA32;
  const out = rgba!;
  const bg = table[0]!;
  for (let i = 0; i < W * H; i++) {
    const v = pix[i]!;
    out[i] = v === NONE ? bg : table[v & 31]!;
  }
  ctx.putImageData(imageData, 0, 0);
}

/* ── drawing primitives on the frame ── */

/** Remap for UI drawing: identity, or nothing extra (DMG is applied at present). */
export const UI: Remap = IDENTITY;

export function fill(v: number): void {
  pix.fill(v);
}

export function rect(x: number, y: number, w: number, h: number, v: number): void {
  let x0 = x | 0, y0 = y | 0;
  let x1 = x0 + (w | 0), y1 = y0 + (h | 0);
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > W) x1 = W;
  if (y1 > H) y1 = H;
  for (let yy = y0; yy < y1; yy++) pix.fill(v, yy * W + x0, yy * W + x1);
}

/** Ordered-dither a colour over a rectangle: amount 0..16 (sixteenths). */
export function dither(x: number, y: number, w: number, h: number, v: number, amount: number): void {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    const by = (yy & 3) << 2;
    for (let xx = x0; xx < x1; xx++) if (BAYER[by + (xx & 3)]! < amount) pix[yy * W + xx] = v;
  }
}

/** Haze over a rectangle: where the dither says so (amount 0..16), colours go through `lut`. Locked pixels are kept. */
export function haze(x: number, y: number, w: number, h: number, lut: Uint8Array, amount: number): void {
  const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0), y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    const by = (yy & 3) << 2;
    for (let xx = x0; xx < x1; xx++) {
      if (BAYER[by + (xx & 3)]! >= amount) continue;
      const i = yy * W + xx;
      const v = pix[i]!;
      if (v < 32) pix[i] = lut[v]!;
    }
  }
}

export function plot(x: number, y: number, v: number): void {
  x |= 0;
  y |= 0;
  if (x >= 0 && y >= 0 && x < W && y < H) pix[y * W + x] = v;
}

/** The ordered-dither threshold (0..15) at a pixel. */
export function bayer(x: number, y: number): number {
  return BAYER[((y & 3) << 2) + (x & 3)]!;
}

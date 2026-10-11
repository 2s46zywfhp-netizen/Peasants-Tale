import type { Sky } from '../sim/weather';
import { blit, blitPart, spriteId } from './atlas';
import { LOCK, LOCKED, W, bayer, pix } from './fb';
import { C } from './palette';

/*
 * The sky over outdoor scenes, in five parallax layers:
 *   1. dithered colour bands for the hour and the weather (final colours: the hour's look is built in),
 *   2. stars and the moon in its phase,
 *   3. clouds drifting with the wind,
 *   4. the far silhouette (castle on its hill, the church tower),
 *   5. the treeline.
 * Layers 3-5 are ordinary colours, so the hour's lookup table and the lighting darken them with the world.
 * The camera is fractional: each layer moves at its own rate, rounded to whole pixels only when drawn.
 */

/** Sky colours top to bottom per block of the day (dawn, morning, midday, afternoon, dusk, night). */
const CLEAR: readonly (readonly number[])[] = [
  [C.ink, C.navy, C.gore, C.blood, C.ember],
  [C.teal, C.sea, C.sea, C.aqua, C.frost],
  [C.sea, C.sea, C.aqua, C.aqua, C.frost],
  [C.teal, C.sea, C.aqua, C.mist, C.bone],
  [C.ink, C.deep, C.gore, C.rust, C.ember],
  [C.ink, C.deep, C.deep, C.navy, C.tealDark],
];
const OVERCAST: readonly (readonly number[])[] = [
  [C.ink, C.deep, C.slate, C.stone, C.gore],
  [C.slate, C.stone, C.stone, C.mist, C.mist],
  [C.stone, C.stone, C.mist, C.mist, C.frost],
  [C.slate, C.stone, C.mist, C.mist, C.bone0],
  [C.ink, C.deep, C.slate, C.gore, C.gore0],
  [C.black, C.ink, C.ink, C.deep, C.deep],
];

/** Layer 1: bands, dithered only near each boundary so they read as bands. */
function bands(bod: number, sky: Sky, h: number): void {
  const cols = sky === 'fair' ? CLEAR[bod]! : OVERCAST[bod]!;
  const n = cols.length - 1;
  for (let y = 0; y < h; y++) {
    const t = (y / h) * n;
    const i = t | 0;
    const frac = t - i;
    // 0 in the band, rising to 16 over its last third.
    const mix = frac < 0.62 ? 0 : ((frac - 0.62) / 0.38) * 16;
    const a = cols[i]! | LOCK, b = cols[Math.min(n, i + 1)]! | LOCK;
    const row = y * W;
    for (let x = 0; x < W; x++) pix[row + x] = bayer(x, y) < mix ? b : a;
  }
}

/** Fixed star field: x, y, brightness. */
const STARS = (() => {
  const a = new Int16Array(150);
  let s = 1345;
  const r = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) >>> 8) / 16777216;
  for (let i = 0; i < 150; i += 3) {
    a[i] = Math.floor(r() * 300);
    a[i + 1] = Math.floor(r() * 46);
    a[i + 2] = r() < 0.2 ? 1 : 0;
  }
  return a;
})();

let ids: { moon: Int32Array; clouds0: number; clouds1: number; sil: number; tree: number } | null = null;
const getIds = () =>
  (ids ??= {
    moon: Int32Array.from({ length: 8 }, (_, p) => spriteId(`sky.moon.${p}`)),
    clouds0: spriteId('sky.clouds.0'),
    clouds1: spriteId('sky.clouds.1'),
    sil: spriteId('sky.silhouette'),
    tree: spriteId('sky.treeline'),
  });

/** Where the moon stands on screen (x before parallax) per block, and whether it is up. */
const MOON_X = [216, -1, -1, -1, 40, 128] as const;
const MOON_Y = [14, 0, 0, 0, 22, 6] as const;

/** Screen x of the moon this frame (for its reflection in water), or -999 if it is not up. */
export let moonScreenX = -999;

/**
 * Draws the sky above `horizon`. `cam` is the camera (fractional), `wind` -1..1 pushes the clouds,
 * `moon` is the phase 0..7 (0 new, 4 full).
 */
export function drawSky(bod: number, sky: Sky, moon: number, cam: number, wind: number, now: number, horizon: number): void {
  const k = getIds();
  bands(bod, sky, horizon);
  const clear = sky === 'fair' || sky === 'cloud';
  moonScreenX = -999;

  // 2. Stars and the moon (fixed in the sky: a tiny parallax so they feel far away).
  if ((bod === 5 || bod === 0 || bod === 4) && clear) {
    const off = Math.round(cam * 0.02);
    const tw = (now / 400) | 0;
    for (let i = 0; i < STARS.length; i += 3) {
      if (bod !== 5 && i % 9 !== 0) continue;
      const x = STARS[i]! - off, y = STARS[i + 1]!;
      if (x < 0 || x >= W || y >= horizon - 18) continue;
      if ((i + tw) % 13 === 0) continue; // twinkle
      pix[y * W + x] = (STARS[i + 2] ? C.moon : C.mist) | LOCK;
    }
    if (MOON_X[bod]! >= 0 && moon !== 0) {
      const mx = MOON_X[bod]! - Math.round(cam * 0.04);
      blit(k.moon[moon]!, mx, MOON_Y[bod]!, false, LOCKED);
      moonScreenX = mx + 7;
    }
  }

  // 3. Clouds: two bands at different depths, drifting.
  const drift = now * (0.002 + Math.abs(wind) * 0.01) * (wind < 0 ? -1 : 1);
  const cover = sky === 'fair' ? 1 : 2;
  for (let layer = 0; layer < cover + (sky === 'storm' || sky === 'rain' ? 1 : 0); layer++) {
    const id = layer % 2 ? k.clouds1 : k.clouds0;
    const off = Math.round(cam * (0.08 + layer * 0.05) + drift * (1 + layer * 0.6) + layer * 57);
    const y = 4 + layer * 13;
    let x = -(((off % 128) + 128) % 128);
    for (; x < W; x += 128) blit(id, x, y, false);
  }

  // 4. The far silhouette, barely moving.
  const so = Math.round(cam * 0.15);
  blitPart(k.sil, 0, 0, 256, 48, 20 - so, horizon - 46);

  // 5. The treeline, nearer.
  const to = Math.round(cam * 0.4);
  for (let x = -(to % 128); x < W; x += 128) blit(k.tree, x, horizon - 26, false);
}

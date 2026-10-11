// Materials and the shader: a mask of material chars -> palette indices, lit from the top-left.
import { T, idx } from './palette.mjs';

/**
 * One char per material. ramp/base: its colour; dark/light: where shading past the ramp's ends goes;
 * flat: no shading (eyes, mouths, flames); dither: checker the lower interior one shade down;
 * noOutline: edges keep their colour.
 */
export const MAT = {
  s: { ramp: 'bone', base: 1, dark: idx('earth', 3) }, // skin
  h: { ramp: 'earth', base: 1 }, // brown hair
  H: { ramp: 'stone', base: 2 }, // grey hair
  y: { ramp: 'fire', base: 2, dark: idx('earth', 3) }, // straw, blond, gold
  e: { ramp: 'night', base: 0, flat: true }, // eye
  m: { ramp: 'blood', base: 1, flat: true }, // mouth
  b: { ramp: 'earth', base: 2, dither: true }, // brown cloth
  g: { ramp: 'moss', base: 1, dither: true }, // green cloth
  u: { ramp: 'teal', base: 1, dither: true }, // blue cloth
  r: { ramp: 'blood', base: 2, dither: true }, // red cloth
  n: { ramp: 'stone', base: 1, dither: true }, // grey cloth
  k: { ramp: 'night', base: 2, light: idx('stone', 0) }, // black cloth
  w: { ramp: 'bone', base: 2 }, // linen
  l: { ramp: 'earth', base: 1 }, // leather, belts, shoes
  o: { ramp: 'earth', base: 2 }, // wood
  i: { ramp: 'stone', base: 1 }, // iron
  f: { ramp: 'fire', base: 2, flat: true, noOutline: true }, // flame
  z: { ramp: 'bone', base: 2 }, // feathers
  p: { ramp: 'earth', base: 3, light: idx('bone', 1) }, // pig hide
  c: { ramp: 'bone', base: 1 }, // pale hide
  C: { ramp: 'earth', base: 1 }, // dark hide patches
  d: { ramp: 'night', base: 2, light: idx('stone', 0) }, // black dog
  x: { ramp: 'blood', base: 3, flat: true, noOutline: true }, // glowing eyes, wattle
  a: { ramp: 'fire', base: 1, flat: true }, // beak, ember
  t: { ramp: 'earth', base: 3, light: idx('bone', 0), dark: idx('earth', 1), dither: true }, // thatch, straw bundle
  q: { ramp: 'teal', base: 2 }, // bright cloth highlight / glass
  v: { ramp: 'moss', base: 2, dither: true }, // leaves
};
// Building and nature materials.
MAT['#'] = { ramp: 'stone', base: 1, dither: true }; // dressed stone
MAT['%'] = { ramp: 'stone', base: 0, dark: idx('night', 2) }; // slate roof
MAT['@'] = { ramp: 'night', base: 1, flat: true }; // dark window glass
MAT['!'] = { ramp: 'fire', base: 2, flat: true, noOutline: true }; // lit window
MAT['&'] = { ramp: 'moss', base: 0, light: idx('moss', 1) }; // deep foliage
MAT['^'] = { ramp: 'earth', base: 1 }; // bark
MAT['='] = { ramp: 'bone', base: 1, dither: true }; // limewashed daub
MAT[':'] = { ramp: 'moss', base: 1, dither: true }; // turf, mound grass
MAT[';'] = { ramp: 'night', base: 0, flat: true }; // a dark opening
MAT['$'] = { ramp: 'blood', base: 2 }; // red glass, red cloth on banners
MAT['+'] = { ramp: 'fire', base: 3, flat: true, noOutline: true }; // the brightest flame
// Skin states (body-state layers): hollow shadow, pale wasting, sickly, cold.
MAT.j = { ramp: 'earth', base: 3, flat: true };
MAT.P = { ramp: 'bone', base: 0, dark: idx('earth', 2) };
MAT.X = { ramp: 'bone', base: 0, dark: idx('teal', 1), light: idx('teal', 3) };
MAT.Y = { ramp: 'stone', base: 2, dark: idx('stone', 1) };
// Sleeves: the same cloth as a separate material, so an arm reads against the body.
for (const [c, S] of [['b', 'B'], ['g', 'G'], ['u', 'U'], ['r', 'R'], ['n', 'N'], ['k', 'K'], ['w', 'W']]) MAT[S] = { ...MAT[c], dither: false };
/** The sleeve material for a cloth. */
export const sleeveOf = (c) => ({ b: 'B', g: 'G', u: 'U', r: 'R', n: 'N', k: 'K', w: 'W' })[c] ?? c;

const at = (m, w, h, x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : m[y * w + x]);

/** A w x h mask (string of material chars, '.' transparent) shaded into palette indices. */
export function shade(mask, w, h) {
  const out = new Uint8Array(w * h).fill(T);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = mask[y * w + x];
      if (ch === '.' || ch === undefined) continue;
      const m = MAT[ch];
      if (!m) throw new Error(`unknown material '${ch}'`);
      if (m.flat) {
        out[y * w + x] = idx(m.ramp, m.base);
        continue;
      }
      const up = at(mask, w, h, x, y - 1), left = at(mask, w, h, x - 1, y);
      const down = at(mask, w, h, x, y + 1), right = at(mask, w, h, x + 1, y);
      let sh = m.base;
      const lit = up !== ch || left !== ch;
      const dim = down !== ch || right !== ch;
      if (lit && !dim) sh += 1;
      else if (dim && !lit) sh -= 1;
      if (m.dither && !lit && !dim && (x + y) % 2 === 0 && down === ch && at(mask, w, h, x, y + 2) !== ch) sh -= 1;
      // Selective outline: on the shadow side (open below or right) the edge goes to the darkest shade.
      if (!m.noOutline && (down === '.' || right === '.')) sh = Math.min(sh, 0) - (m.base >= 2 ? 0 : 1);
      if (!m.noOutline && (up === '.' || left === '.') && down !== '.' && right !== '.') sh = Math.max(sh, m.base);
      out[y * w + x] = sh < 0 ? (m.dark ?? idx(m.ramp, 0)) : sh > 3 ? (m.light ?? idx(m.ramp, 3)) : idx(m.ramp, sh);
    }
  }
  return out;
}

/* ── a tiny drawing kit over a mutable mask (array of chars) ── */

export class Mask {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill('.');
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  }
  get(x, y) {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.d[y * this.w + x];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Thick line from (x0,y0) to (x1,y1). */
  line(x0, y0, x1, y1, c, t = 1) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) this.set(Math.round(x - (t - 1) / 2 + i), Math.round(y - (t - 1) / 2 + j), c);
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1) this.set(x, y, c);
  }
  /** Paint pattern rows (strings) at x,y; '.' skips. */
  stamp(x, y, rows, map = {}) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && this.set(x + i, y + j, map[ch] ?? ch)));
  }
  flipX() {
    const m = new Mask(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) m.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return m;
  }
  str() {
    return this.d.join('');
  }
}

/** Layer = pixels of `variant` that differ from `base` (transparent elsewhere). */
export function diff(base, variant) {
  const out = new Uint8Array(base.length).fill(T);
  for (let i = 0; i < base.length; i++) if (variant[i] !== base[i] && variant[i] !== T) out[i] = variant[i];
  return out;
}

// 16x16 terrain tiles with variants, edge/corner fringes for autotiling, and animated water.
import { T, idx } from './palette.mjs';

/** Deterministic noise in [0, 1). */
export function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => B4[(y & 3) * 4 + (x & 3)] / 16;

/** Terrain painters: (x, y, variant) -> palette index. Tile-local x, y in 0..15. */
export const TERRAIN = {
  grass: (x, y, v) => {
    const n = hash(x, y, 11 + v);
    if (v === 3 && n > 0.985) return y % 2 ? idx('fire', 2) : idx('bone', 3); // a flower
    const blade = hash(x, Math.floor(y / 3), 21 + v);
    if (blade > 0.86) return hash(x, y, 31 + v) > 0.5 ? idx('moss', 3) : idx('moss', 2);
    if (n < 0.05) return idx('moss', 0);
    return bayer(x + v, y) < 0.25 ? idx('moss', 2) : idx('moss', 1);
  },
  mud: (x, y, v) => {
    const n = hash(x, y, 41 + v);
    if (n < 0.08) return idx('earth', 0);
    if (n > 0.93) return idx('earth', 2);
    return bayer(x, y + v) < 0.2 ? idx('earth', 0) : idx('earth', 1);
  },
  path: (x, y, v) => {
    const n = hash(x, y, 51 + v);
    if (n > 0.95) return idx('stone', 2);
    if (n > 0.88) return idx('earth', 3);
    if ((y === 4 || y === 11) && hash(x, y, 52 + v) > 0.3) return idx('earth', 1); // ruts
    return bayer(x, y) < 0.15 ? idx('earth', 1) : idx('earth', 2);
  },
  cobble: (x, y, v) => {
    const row = Math.floor(y / 5);
    const off = row % 2 ? 4 : 0;
    if (y % 5 === 4 || (x + off) % 8 === 7) return idx('night', 2);
    const stone = hash(Math.floor((x + off) / 8), row, 61 + v);
    if (y % 5 === 0 || (x + off) % 8 === 0) return idx('stone', stone > 0.5 ? 3 : 2);
    return idx('stone', stone > 0.7 ? 2 : 1);
  },
  snow: (x, y, v) => {
    const n = hash(x, y, 71 + v);
    if (n < 0.04) return idx('stone', 3);
    return bayer(x + v, y) < 0.12 ? idx('bone', 2) : idx('bone', 3);
  },
  flagstone: (x, y, v) => {
    if (y % 8 === 7 || x % 8 === 7) return idx('night', 3);
    const s = hash(Math.floor(x / 8), Math.floor(y / 8), 81 + v);
    if (y % 8 === 0 || x % 8 === 0) return idx('stone', 2);
    return idx('stone', s > 0.5 ? 1 : 0);
  },
  rushes: (x, y, v) => {
    const n = hash(x, y, 91 + v);
    if ((x + Math.floor(y / 2) * 3) % 5 === 0) return idx('fire', 1);
    if (n > 0.9) return idx('earth', 3);
    return n < 0.1 ? idx('earth', 1) : idx('earth', 2);
  },
  /** Ploughed strips and the crops on them (variant = stage). */
  soil: (x, y) => (y % 4 === 0 ? (hash(x, y, 7) > 0.85 ? idx('earth', 3) : idx('earth', 2)) : y % 4 === 3 ? idx('earth', 0) : idx('earth', 1)),
};

/** Crop stages drawn over soil. */
export function cropTile(stage) {
  const px = new Uint8Array(256);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const f = y % 4;
      let c = TERRAIN.soil(x, y);
      if (stage === 'sprout' && ((f === 0 && x % 3 === 0) || (f === 3 && x % 3 === 0))) c = f === 0 ? idx('moss', 3) : idx('moss', 2);
      if (stage === 'growing') c = f === 3 ? (x % 2 ? idx('moss', 1) : idx('earth', 0)) : f === 0 ? (x % 2 ? idx('moss', 3) : idx('moss', 2)) : x % 2 ? idx('moss', 2) : idx('moss', 1);
      if (stage === 'ripe') c = f === 0 ? (x % 2 ? idx('fire', 3) : idx('fire', 2)) : f === 1 ? (x % 3 ? idx('fire', 2) : idx('fire', 1)) : f === 2 ? idx('bone', 1) : idx('earth', 2);
      if (stage === 'stubble') c = f === 0 ? (x % 2 ? idx('bone', 1) : idx('fire', 1)) : f === 1 && x % 2 === 0 ? idx('bone', 0) : c;
      px[y * 16 + x] = c;
    }
  return px;
}

/** Still water, four frames of slow ripples. Moon reflections are a separate overlay. */
export function waterTile(frame) {
  const px = new Uint8Array(256);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const band = (y + 1) % 5;
      const run = (x + frame * 2 + Math.floor(y / 5) * 6) % 16;
      px[y * 16 + x] = band === 0 && run < 6 ? idx('teal', 1) : band === 2 && run === 10 ? idx('teal', 2) : (x + y) % 7 === 0 ? idx('teal', 0) : idx('night', 3);
    }
  return px;
}
/** The moon on the water: broken cream streaks, four frames. */
export function moonOnWater(frame) {
  const px = new Uint8Array(256).fill(T);
  for (let y = 2; y < 15; y += 3) {
    const w = 6 - Math.abs(y - 8) / 2;
    const x0 = 8 - w / 2 + ((frame + y) % 3) - 1;
    for (let x = Math.floor(x0); x < x0 + w; x++) if (hash(x, y, frame) > 0.25) px[y * 16 + x] = y === 8 ? idx('bone', 3) : idx('bone', 2);
  }
  return px;
}

/** A terrain tile, variant 0..3. */
export function terrainTile(name, v) {
  const f = TERRAIN[name];
  const px = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px[y * 16 + x] = f(x, y, v);
  return px;
}

/**
 * Fringes for autotiling: the terrain spilling onto a lower neighbour across one edge (N, E, S, W)
 * or round one corner (NE, NW, SE, SW), with a ragged dithered boundary 2-5px deep.
 */
export function fringe(name, side) {
  const f = TERRAIN[name];
  const px = new Uint8Array(256).fill(T);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let d;
      if (side === 'N') d = y - (2 + hash(x >> 1, 1, 101) * 3);
      else if (side === 'S') d = 15 - y - (2 + hash(x >> 1, 2, 101) * 3);
      else if (side === 'W') d = x - (2 + hash(y >> 1, 3, 101) * 3);
      else if (side === 'E') d = 15 - x - (2 + hash(y >> 1, 4, 101) * 3);
      else {
        const cx = side.includes('W') ? 0 : 15, cy = side.includes('N') ? 0 : 15;
        d = Math.hypot(x - cx, y - cy) - (3 + hash(x, y, 102) * 2);
      }
      if (d < 0 || (d < 1.5 && bayer(x, y) < 0.5)) px[y * 16 + x] = f(x, y, 0);
    }
  return px;
}

export const TERRAINS = ['grass', 'mud', 'path', 'cobble', 'snow', 'flagstone', 'rushes', 'soil'];
/** Which terrain spills over which: higher spills onto lower. */
export const PRIORITY = { soil: 0, grass: 1, mud: 2, path: 3, cobble: 4, snow: 5, flagstone: 6, rushes: 6 };
export const SIDES = ['N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW'];

export function tiles() {
  const frames = [];
  const anims = {};
  for (const t of TERRAINS) {
    for (let v = 0; v < (t === 'soil' ? 1 : 4); v++) frames.push({ name: `t.${t}.${v}`, w: 16, h: 16, px: terrainTile(t, v) });
    for (const s of SIDES) frames.push({ name: `t.${t}.${s}`, w: 16, h: 16, px: fringe(t, s) });
  }
  for (const st of ['sprout', 'growing', 'ripe', 'stubble']) frames.push({ name: `t.crop.${st}`, w: 16, h: 16, px: cropTile(st) });
  const water = [0, 1, 2, 3].map((k) => {
    frames.push({ name: `t.water.${k}`, w: 16, h: 16, px: waterTile(k) });
    frames.push({ name: `t.water.moon.${k}`, w: 16, h: 16, px: moonOnWater(k) });
    return `t.water.${k}`;
  });
  anims['t.water'] = { frames: water, ms: 450 };
  anims['t.water.moon'] = { frames: [0, 1, 2, 3].map((k) => `t.water.moon.${k}`), ms: 450 };
  return { frames, anims };
}

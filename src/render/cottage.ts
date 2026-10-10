import { dayInfo, type Season } from '../sim/calendar';
import type { SimState } from '../sim/sim';
import type { Sky } from '../sim/weather';
import { bayer } from './draw';
import { C, DMG, IDENTITY, PALETTE, hexToRgb, hex, setRemap, type Ci, type Remap } from './palette';

/*
 * The cottage, seen from the side: a room wider than the screen that pans with the peasant.
 * Fireplace on the left, a window onto the weather, table and stool, a candlelit bed, the door on the right.
 * Painted procedurally in palette indices (no Math.random: a fixed hash), cached as canvases, so drawing a
 * frame only blits. The painting functions are pure and testable; only `canvasOf` touches the DOM.
 */

/** Room size in pixels; the room's top edge sits under the 8-pixel title bar. */
export const ROOM_W = 256;
export const ROOM_H = 128;
export const ROOM_TOP = 8;
/** First room row of the floor. */
export const FLOOR_Y = 86;
/** Range of the feet row (room y) an actor can stand on: in front of the furniture. */
export const FEET_MIN = 100;
export const FEET_MAX = 124;
/** Walking past this room x (sprite left) goes out through the door. */
export const DOOR_X = 230;

/** Places to act, by the x of the peasant's middle. */
export const SPOTS: readonly { x0: number; x1: number; label: string }[] = [
  { x0: 0, x1: 66, label: 'A:HEARTH' },
  { x0: 88, x1: 158, label: 'A:TABLE' },
  { x0: 162, x1: 228, label: 'A:BED' },
];

/** Where the sleeping peasant lies (sprite top-left, room coords). */
export const BED_SLEEP = { x: 198, y: 66 } as const;

const T = 255; // transparent

/** Deterministic noise in [0, 1). */
export function hash(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const bay = (x: number, y: number) => bayer(x, y) / 16;

/* ───────────── the room ───────────── */

const FIRE_CX = 31;
const FIRE_CY = 72;
const CANDLE_X = 173;
const CANDLE_Y = 66;

/** Window glass rectangle (room coords). */
export const GLASS = { x: 106, y: 20, w: 43, h: 37 } as const;

function inArch(rx: number, ry: number, grow = 0): boolean {
  const dx = rx - FIRE_CX;
  const r = 15 + grow;
  if (Math.abs(dx) > r || ry > 84) return false;
  if (ry >= 62) return true;
  const dy = (ry - 62) * 1.3;
  return dx * dx + dy * dy <= r * r;
}

/** The furnished room in daylight, as palette indices (T where the window glass is). */
export function paintRoom(): Uint8Array {
  const W = ROOM_W;
  const b = new Uint8Array(W * ROOM_H);
  const set = (x: number, y: number, c: number) => {
    if (x >= 0 && x < W && y >= 0 && y < ROOM_H) b[y * W + x] = c;
  };
  const fill = (x0: number, y0: number, w: number, h: number, c: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
  };

  // Back wall: vertical planks with grain and knots, shadowed under the ceiling.
  for (let ry = 10; ry < FLOOR_Y; ry++) {
    for (let rx = 0; rx < W; rx++) {
      const plank = Math.floor((rx + 3) / 11);
      const px = (rx + 3) % 11;
      const dark = hash(plank, 1) < 0.3;
      let c: number = dark ? C.mud : C.wood;
      if (hash(rx, ry >> 2, 3) < 0.13) c = dark ? C.night : C.mud;
      if (hash(plank, ry >> 3, 5) < 0.04 && px > 3 && px < 8) c = C.night;
      if (px === 0) c = C.black;
      else if (px === 1) c = C.mud;
      if (ry < 18 && bay(rx, ry) < (18 - ry) / 9) c = ry < 13 ? C.black : C.mud;
      if (ry >= 82) c = ry === 85 ? C.black : C.mud;
      set(rx, ry, c);
    }
  }
  // Ceiling beam and joist ends.
  for (let rx = 0; rx < W; rx++) {
    set(rx, 0, C.black);
    set(rx, 1, C.black);
    set(rx, 2, C.wood);
    for (let ry = 3; ry < 7; ry++) set(rx, ry, hash(rx, ry, 7) < 0.15 ? C.wood : C.mud);
    set(rx, 7, C.mud);
    set(rx, 8, C.black);
    set(rx, 9, C.night);
  }
  for (let jx = 70; jx < W - 20; jx += 46) {
    fill(jx, 1, 9, 8, C.mud);
    fill(jx + 1, 2, 7, 6, C.wood);
    set(jx + 4, 4, C.mud);
    set(jx + 4, 5, C.mud);
  }
  // Posts and braces.
  for (const px of [62, 158]) {
    for (let ry = 9; ry < FLOOR_Y; ry++) {
      set(px, ry, C.mud);
      set(px + 1, ry, C.wood);
      set(px + 2, ry, hash(px, ry, 9) < 0.2 ? C.parchment : C.wood);
      set(px + 3, ry, C.black);
    }
    for (let k = 0; k < 13; k++) {
      for (let t = 0; t < 3; t++) {
        set(px + 4 + k, 22 - k + t, t === 0 ? C.wood : t === 1 ? C.mud : C.black);
        set(px - 1 - k, 22 - k + t, t === 0 ? C.wood : t === 1 ? C.mud : C.black);
      }
    }
  }
  // A shelf with jars, and herbs drying from the beam.
  fill(68, 46, 26, 1, C.parchment);
  fill(68, 47, 26, 2, C.wood);
  fill(68, 49, 26, 1, C.black);
  fill(70, 50, 2, 4, C.mud);
  fill(90, 50, 2, 4, C.mud);
  fill(72, 39, 6, 7, C.ember);
  fill(72, 39, 6, 1, C.mud);
  fill(76, 40, 2, 6, C.blood);
  fill(81, 41, 5, 5, C.mist);
  fill(84, 41, 2, 5, C.slate);
  fill(87, 42, 4, 4, C.wood);
  for (let k = 0; k < 3; k++) {
    const hx = 98 + k * 4;
    for (let ry = 9; ry < 13 + k * 2; ry++) set(hx, ry, C.mud);
    for (let ry = 13 + k * 2; ry < 24 + k * 2; ry++) {
      set(hx - 1, ry, hash(hx, ry, 11) < 0.5 ? C.moss : C.night);
      set(hx, ry, C.moss);
      set(hx + 1, ry, hash(hx, ry, 12) < 0.4 ? C.teal : C.moss);
    }
  }

  // Fireplace: a stone chimney through the ceiling.
  for (let ry = 0; ry < FLOOR_Y; ry++) {
    for (let rx = 4; rx < 59; rx++) {
      const row = Math.floor(ry / 7);
      const off = (row % 2) * 6;
      const col = Math.floor((rx - 4 + off) / 12);
      const v = hash(col, row, 13);
      let c: number = v < 0.55 ? C.slate : v < 0.82 ? C.mist : C.navy;
      if (ry % 7 === 0 && c === C.slate) c = C.mist;
      if (ry % 7 === 0 && c === C.mist && hash(rx, ry, 14) < 0.4) c = C.bone;
      if (ry % 7 === 6 || (rx - 4 + off) % 12 === 11) c = C.night;
      if (rx < 6 || rx > 56) c = C.night;
      if (rx < 10 && bay(rx, ry) < 0.4) c = C.night;
      set(rx, ry, c);
    }
  }
  // Mantel, with a pot and a candle stub.
  fill(0, 44, 64, 1, C.parchment);
  fill(0, 45, 64, 3, C.wood);
  fill(0, 48, 64, 1, C.mud);
  fill(4, 49, 55, 1, C.black);
  fill(10, 38, 7, 6, C.mud);
  fill(11, 39, 5, 4, C.gore);
  fill(9, 38, 9, 1, C.black);
  fill(46, 40, 3, 4, C.bone);
  set(47, 39, C.gold);
  // Arch of dressed stones round the firebox, then the sooty opening.
  for (let ry = 40; ry < 86; ry++) {
    for (let rx = 10; rx < 54; rx++) {
      if (inArch(rx, ry)) {
        let c: number = ry < 70 ? C.black : bay(rx, ry) < 0.3 ? C.gore : C.black;
        if (ry > 66 && ry < 76 && hash(rx >> 2, ry >> 1, 15) < 0.25) c = C.gore;
        set(rx, ry, c);
      } else if (inArch(rx, ry, 3)) {
        const seg = Math.floor(Math.atan2(ry - 62, rx - FIRE_CX) * 4);
        set(rx, ry, (seg & 1) === 0 ? C.mist : C.slate);
        if (inArch(rx, ry, 1) && !inArch(rx, ry)) set(rx, ry, C.night);
      }
    }
  }
  // Hearthstone out onto the floor.
  fill(2, 84, 60, 1, C.mist);
  fill(2, 85, 60, 4, C.slate);
  for (let rx = 2; rx < 62; rx += 15) fill(rx, 85, 1, 4, C.night);
  fill(2, 89, 60, 1, C.night);

  // Window: wooden frame and sill (the glass is left open for the weather).
  fill(102, 16, 51, 45, C.wood);
  fill(102, 16, 51, 1, C.parchment);
  fill(102, 16, 1, 45, C.parchment);
  fill(105, 19, 45, 39, C.mud);
  fill(GLASS.x, GLASS.y, GLASS.w, GLASS.h, T);
  fill(98, 60, 59, 1, C.parchment);
  fill(98, 61, 59, 3, C.wood);
  fill(98, 64, 59, 1, C.mud);
  fill(100, 65, 55, 1, C.black);

  // Table with a bowl, a jug and a loaf.
  fill(94, 72, 46, 1, C.parchment);
  fill(94, 73, 46, 3, C.wood);
  fill(94, 76, 46, 1, C.mud);
  fill(96, 77, 42, 3, C.mud);
  for (const lx of [97, 133]) {
    fill(lx, 80, 3, 20, C.wood);
    fill(lx + 3, 80, 1, 20, C.mud);
  }
  fill(104, 69, 9, 3, C.wood);
  fill(104, 68, 9, 1, C.mud);
  fill(105, 71, 7, 1, C.mud);
  fill(114, 64, 5, 8, C.ember);
  fill(114, 64, 5, 1, C.mud);
  fill(117, 65, 2, 7, C.blood);
  fill(122, 68, 10, 4, C.gold);
  fill(123, 67, 8, 1, C.gold);
  fill(122, 71, 10, 1, C.ember);
  for (let k = 0; k < 3; k++) set(124 + k * 3, 68, C.ember);
  // Stool.
  fill(142, 86, 14, 1, C.parchment);
  fill(142, 87, 14, 2, C.wood);
  fill(142, 89, 14, 1, C.mud);
  fill(144, 90, 2, 12, C.wood);
  fill(152, 90, 2, 12, C.wood);

  // Bedside table and candle.
  fill(166, 76, 15, 1, C.parchment);
  fill(166, 77, 15, 2, C.wood);
  fill(167, 79, 13, 21, C.mud);
  fill(168, 80, 11, 8, C.wood);
  fill(168, 90, 11, 8, C.wood);
  set(173, 84, C.black);
  set(173, 94, C.black);
  fill(171, 74, 5, 2, C.black);
  fill(172, 68, 3, 6, C.bone);
  fill(174, 68, 1, 6, C.mist);

  // Bed: headboard, footboard, straw mattress under a wool blanket, pillow.
  fill(184, 62, 5, 40, C.wood);
  fill(184, 62, 5, 1, C.parchment);
  fill(188, 62, 1, 40, C.mud);
  fill(228, 74, 5, 28, C.wood);
  fill(228, 74, 5, 1, C.parchment);
  fill(232, 74, 1, 28, C.mud);
  // Straw mattress, a folded linen sheet at the head, a wool blanket with folds over the rest.
  fill(189, 88, 39, 3, C.parchment);
  for (let ry = 78; ry < 88; ry++) {
    for (let rx = 189; rx < 228; rx++) {
      let c: number;
      if (rx < 203) c = ry === 78 ? C.bone : ry > 85 ? C.mist : C.bone;
      else {
        c = ry === 78 ? C.mist : C.slate;
        if ((rx - 203 + (ry - 78)) % 9 === 0 && ry > 79) c = C.navy;
        if (rx === 203) c = C.navy;
      }
      set(rx, ry, c);
    }
  }
  fill(203, 88, 25, 3, C.slate);
  fill(203, 90, 25, 1, C.navy);
  fill(190, 73, 13, 6, C.bone);
  fill(190, 73, 13, 1, C.mist);
  fill(190, 78, 13, 1, C.mist);
  fill(189, 91, 39, 1, C.parchment);
  fill(189, 92, 39, 3, C.wood);
  fill(189, 95, 39, 1, C.mud);
  fill(191, 96, 2, 6, C.mud);
  fill(224, 96, 2, 6, C.mud);

  // Door: planks under a header beam, iron hinges and ring.
  fill(232, 24, 24, 4, C.mud);
  fill(232, 24, 24, 1, C.wood);
  for (let ry = 28; ry < FLOOR_Y; ry++) {
    for (let rx = 236; rx < 254; rx++) {
      const p = (rx - 236) % 6;
      let c: number = p === 0 ? C.black : hash(rx, ry >> 2, 17) < 0.15 ? C.mud : C.wood;
      if (p === 5) c = C.mud;
      set(rx, ry, c);
    }
  }
  fill(236, 38, 14, 2, C.black);
  fill(236, 74, 14, 2, C.black);
  fill(238, 56, 3, 1, C.slate);
  fill(238, 60, 3, 1, C.slate);
  set(238, 57, C.slate);
  set(238, 58, C.slate);
  set(238, 59, C.slate);
  set(240, 58, C.slate);
  fill(254, 0, 2, ROOM_H, C.black);
  fill(0, 0, 2, FLOOR_Y, C.black);

  // Floor: planks running away in perspective, end joints, the wall line in shadow.
  const vx = 128;
  const vy = 30;
  for (let ry = FLOOR_Y; ry < ROOM_H; ry++) {
    const t = ry - vy;
    for (let rx = 0; rx < W; rx++) {
      const u = ((rx - vx) * 40) / t;
      const u2 = ((rx + 1 - vx) * 40) / t;
      const board = Math.floor(u / 13);
      let c: number = hash(board, 21) < 0.3 ? C.mud : C.wood;
      if (c === C.wood && hash(rx >> 1, ry, 22) < 0.1) c = C.mud;
      if (Math.floor(u2 / 13) !== board) c = C.black;
      const joint = 90 + Math.floor(hash(board, 23) * 34);
      if (ry === joint) c = C.black;
      if (ry === FLOOR_Y) c = C.black;
      else if (ry < FLOOR_Y + 4 && bay(rx, ry) < 0.5) c = C.night;
      set(rx, ry, c);
    }
  }
  // Shadows under the furniture.
  for (const [x0, x1, y0, y1] of [[94, 140, 99, 102], [142, 156, 101, 103], [166, 181, 99, 102], [189, 228, 101, 104]] as const) {
    for (let ry = y0; ry < y1; ry++) for (let rx = x0; rx < x1; rx++) if (bay(rx, ry) < 0.6) set(rx, ry, C.black);
  }
  // Hearthstone over the floor line.
  fill(2, 86, 60, 3, C.slate);
  fill(2, 89, 60, 1, C.night);
  return b;
}

/** Light at a room pixel from the fire and the candle, 0..1. */
function lightAt(rx: number, ry: number): number {
  const df = Math.hypot(rx - FIRE_CX, (ry - FIRE_CY) * 1.4);
  const dc = Math.hypot(rx - CANDLE_X, ry - CANDLE_Y);
  return Math.max(0, 1 - df / 92, 1 - dc / 36);
}

/** Darkness level for a block of the day: 0 daylight, 1 dawn/dusk, 2 night. */
export function darknessOf(bod: number): 0 | 1 | 2 {
  return bod === 5 ? 2 : bod === 0 || bod === 4 ? 1 : 0;
}

/** One shade darker for each palette colour (wood to mud to night-blue, and so on). */
export const DARKER: readonly number[] = [
  C.black, C.black, C.night, C.navy, C.teal, C.mist, C.slate, C.navy, C.gore, C.blood, C.black, C.night, C.mud, C.navy, C.wood, C.ember,
];

/**
 * The room lit for a darkness level. Away from the fire and the candle every colour steps down its ramp
 * (one step at dawn and dusk, two at night), dithered only where one step meets the next; close to the
 * fire the wood and stone are warmed instead.
 */
export function litRoom(base: Uint8Array, level: 0 | 1 | 2): Uint8Array {
  const out = base.slice();
  const W = ROOM_W;
  const warmth = level === 0 ? 0.3 : level === 1 ? 0.75 : 1;
  for (let ry = 0; ry < ROOM_H; ry++) {
    for (let rx = 0; rx < W; rx++) {
      const i = ry * W + rx;
      let c = out[i]!;
      if (c === T) continue;
      const l = lightAt(rx, ry);
      const d = bay(rx, ry);
      if (l > 0.6 && d < (l - 0.6) * 1.8 * warmth) {
        out[i] = c === C.mud ? C.wood : c === C.wood ? C.ember : c === C.slate ? C.mist : c === C.black ? C.gore : c === C.night ? C.mud : c;
        continue;
      }
      if (level === 0) continue;
      // Steps of darkness: a smooth value, its whole part applied, its fraction dithered.
      const v = level === 1 ? Math.min(1, Math.max(0, (0.62 - l) / 0.14)) : Math.min(2, Math.max(0, (0.8 - l) / 0.17));
      const steps = Math.floor(v) + (d < v - Math.floor(v) ? 1 : 0);
      for (let k = 0; k < steps; k++) c = DARKER[c]!;
      out[i] = c;
    }
  }
  // Daylight through the window: a pale patch on the floor.
  if (level === 0) {
    for (let ry = FLOOR_Y + 2; ry < 112; ry++) {
      const shift = (ry - FLOOR_Y) >> 1;
      for (let rx = 112 + shift; rx < 150 + shift; rx++) {
        const i = ry * W + rx;
        if (bay(rx, ry) < 0.5) out[i] = out[i] === C.mud ? C.wood : out[i] === C.wood ? C.parchment : out[i]!;
      }
    }
  }
  return out;
}

/* ───────────── the fire ───────────── */

export const FIRE_W = 30;
export const FIRE_H = 26;
/** Fire frame position in the room (top-left). */
export const FIRE_X = FIRE_CX - 15;
export const FIRE_Y = 84 - FIRE_H;
export const FIRE_FRAMES = 8;

/** One frame of the hearth fire: licking flames over a coal bed and two crossed logs. */
export function paintFire(f: number): Uint8Array {
  const w = FIRE_W;
  const h = FIRE_H;
  const b = new Uint8Array(w * h).fill(T);
  const base = h - 6;
  for (let x = 0; x < w; x++) {
    const n = (x - (w - 1) / 2) / ((w - 1) / 2);
    const H = Math.max(0, 19 * (1 - n * n));
    const tongue = H * (0.5 + 0.5 * hash(x >> 1, f, 31)) + (hash(x, f, 32) < 0.12 ? 4 : 0);
    for (let y = 0; y <= tongue; y++) {
      const sway = Math.round(Math.sin((y + f * 2.3) / 3.2) * (y / 9));
      const px = x + sway;
      const py = base - y;
      if (px < 0 || px >= w || py < 0) continue;
      const frac = y / Math.max(1, tongue) + (bay(px, py) - 0.5) * 0.18;
      const core = Math.abs(n) < 0.38;
      const c = frac < 0.28 && core ? C.bone : frac < 0.5 ? C.gold : frac < 0.78 ? C.ember : frac < 0.95 ? C.blood : C.gore;
      b[py * w + px] = c;
    }
  }
  // A loose flame now and then, above the rest.
  for (let k = 0; k < 3; k++) {
    if (hash(k, f, 33) < 0.5) continue;
    const x = 8 + Math.floor(hash(k, f, 34) * 14);
    const y = 1 + Math.floor(hash(k, f, 35) * 4);
    b[y * w + x] = C.ember;
    b[(y + 1) * w + x] = C.blood;
  }
  // Coal bed and logs.
  for (let x = 2; x < w - 2; x++) {
    b[(base + 1) * w + x] = hash(x, f, 36) < 0.5 ? C.ember : C.blood;
    b[(base + 2) * w + x] = hash(x, f, 37) < 0.3 ? C.ember : C.gore;
  }
  for (let x = 1; x < w - 1; x++) {
    const y1 = base + 3 + Math.floor((x * 2) / w);
    const y2 = base + 4 - Math.floor((x * 2) / w);
    b[y1 * w + x] = x % 5 === 0 ? C.black : C.mud;
    if (y1 + 1 < h) b[(y1 + 1) * w + x] = C.wood;
    b[y2 * w + x] = C.wood;
  }
  b[(base + 3) * w + 1] = C.ember;
  b[(base + 4) * w + w - 2] = hash(f, 1, 38) < 0.5 ? C.gold : C.ember;
  return b;
}

/** Floor glow before the hearth, three strengths for the flicker. */
export const GLOW_W = 80;
export const GLOW_H = 18;
export function paintGlow(k: number): Uint8Array {
  const b = new Uint8Array(GLOW_W * GLOW_H).fill(T);
  const amt = 0.22 + k * 0.06;
  for (let y = 0; y < GLOW_H; y++) {
    for (let x = 0; x < GLOW_W; x++) {
      const dx = (x - GLOW_W / 2) / (GLOW_W / 2);
      const dy = y / GLOW_H;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1 && bay(x + k, y) < amt * (1 - d)) b[y * GLOW_W + x] = d < 0.4 ? C.gold : C.ember;
    }
  }
  return b;
}

/* ───────────── the window ───────────── */

const WINDOW_SKY: readonly (readonly [Ci, Ci])[] = [
  [C.gore, C.ember], [C.teal, C.sea], [C.sea, C.mist], [C.sea, C.parchment], [C.night, C.ember], [C.black, C.navy],
];

/** The view through the window: sky by the hour, the ground by the season, pines, stars at night. */
export function paintWindow(bod: number, season: Season, sky: Sky): Uint8Array {
  const { w, h } = GLASS;
  const b = new Uint8Array(w * h);
  const night = bod === 5;
  const dim = bod === 0 || bod === 4;
  const [top, low] = sky === 'storm' ? ([C.night, C.slate] as const) : sky === 'rain' || sky === 'cloud' ? ([C.slate, C.mist] as const) : WINDOW_SKY[bod]!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b[y * w + x] = bay(x, y) < y / 24 ? low : top;
  if (night) {
    for (let k = 0; k < 14; k++) b[Math.floor(hash(k, 1, 41) * 16) * w + Math.floor(hash(k, 2, 41) * w)] = C.bone;
    for (let y = 3; y < 7; y++) for (let x = 32; x < 36; x++) if ((x - 33.5) ** 2 + (y - 4.5) ** 2 < 4.5) b[y * w + x] = C.bone;
  }
  const hill: Ci = night ? C.night : dim ? C.navy : C.teal;
  for (let x = 0; x < w; x++) {
    const hy = 21 + Math.round(Math.sin(x / 7) * 2 + Math.sin(x / 3.1));
    for (let y = hy; y < h; y++) b[y * w + x] = hill;
  }
  const winter = season === 'winter';
  const [g1, g2]: readonly [Ci, Ci] = winter
    ? night ? [C.slate, C.navy] : [C.bone, C.mist]
    : night ? [C.night, C.navy] : season === 'autumn' ? [C.wood, C.ember] : season === 'summer' ? [C.moss, C.gold] : [C.moss, C.teal];
  for (let y = 27; y < h; y++) for (let x = 0; x < w; x++) b[y * w + x] = bay(x, y) < 0.3 ? g2 : g1;
  const leaf: Ci = night ? C.night : dim ? C.navy : C.moss;
  const shade: Ci = night ? C.black : C.night;
  for (const [cx, base, ht] of [[8, 31, 20], [31, 30, 16], [39, 29, 11]] as const) {
    for (let y = 0; y < ht; y++) {
      const half = Math.floor(((y % 6) + 2 + y / 3) / 1.6);
      const py = base - ht + y;
      for (let dx = -half; dx <= half; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= w || py < 0) continue;
        let c: Ci = dx > half / 3 ? shade : leaf;
        if (winter && y % 6 < 2 && dx < 1) c = night ? C.mist : C.bone;
        b[py * w + px] = c;
      }
    }
    for (let y = base; y < base + 2 && y < h; y++) b[y * w + cx] = C.mud;
  }
  if (sky === 'fog') for (let y = 8; y < h; y++) for (let x = 0; x < w; x++) if (bay(x, y) < 0.4) b[y * w + x] = C.mist;
  return b;
}

/* ───────────── canvases (DOM) ───────────── */

const RGB = PALETTE.map(hexToRgb);

function canvasOf(buf: Uint8Array, w: number, h: number, remap: Remap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = buf[i]!;
    if (v === T) continue;
    const [r, gg, bb] = RGB[remap[v]!]!;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = bb;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

let roomBase: Uint8Array | null = null;
const roomCache: (HTMLCanvasElement | undefined)[] = [];
const fireCache: (HTMLCanvasElement | undefined)[] = [];
const glowCache: (HTMLCanvasElement | undefined)[] = [];
const windowCache = new Map<number, HTMLCanvasElement>();
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const SKIES: readonly Sky[] = ['fair', 'cloud', 'fog', 'rain', 'storm', 'snow'];

function roomCanvas(level: 0 | 1 | 2, dmg: boolean): HTMLCanvasElement {
  const k = level * 2 + (dmg ? 1 : 0);
  let c = roomCache[k];
  if (!c) {
    roomBase ??= paintRoom();
    c = canvasOf(litRoom(roomBase, level), ROOM_W, ROOM_H, dmg ? DMG : IDENTITY);
    roomCache[k] = c;
  }
  return c;
}

function fireCanvas(f: number, dmg: boolean): HTMLCanvasElement {
  const k = f * 2 + (dmg ? 1 : 0);
  let c = fireCache[k];
  if (!c) {
    c = canvasOf(paintFire(f), FIRE_W, FIRE_H, dmg ? DMG : IDENTITY);
    fireCache[k] = c;
  }
  return c;
}

function glowCanvas(k: number, dmg: boolean): HTMLCanvasElement {
  const i = k * 2 + (dmg ? 1 : 0);
  let c = glowCache[i];
  if (!c) {
    c = canvasOf(paintGlow(k), GLOW_W, GLOW_H, dmg ? DMG : IDENTITY);
    glowCache[i] = c;
  }
  return c;
}

function windowCanvas(bod: number, season: Season, sky: Sky, dmg: boolean): HTMLCanvasElement {
  const k = ((bod * 4 + SEASONS.indexOf(season)) * 6 + SKIES.indexOf(sky)) * 2 + (dmg ? 1 : 0);
  let c = windowCache.get(k);
  if (!c) {
    c = canvasOf(paintWindow(bod, season, sky), GLASS.w, GLASS.h, dmg ? DMG : IDENTITY);
    windowCache.set(k, c);
  }
  return c;
}

/* ───────────── drawing a frame ───────────── */

/** Falling snow and rain in the window: [x, phase, speed] triples, fixed. */
const DROPS = (() => {
  const a = new Int16Array(60);
  for (let i = 0; i < 20; i++) {
    a[i * 3] = Math.floor(hash(i, 3, 51) * GLASS.w);
    a[i * 3 + 1] = Math.floor(hash(i, 4, 51) * 256);
    a[i * 3 + 2] = 1 + Math.floor(hash(i, 5, 51) * 3);
  }
  return a;
})();
/** Dust motes in the light under the window: [x, y, phase]. */
const MOTES = Int16Array.from({ length: 24 }, (_, i) => (i % 3 === 0 ? 110 + Math.floor(hash(i, 8, 53) * 40) : i % 3 === 1 ? 60 + Math.floor(hash(i, 9, 53) * 30) : Math.floor(hash(i, 10, 53) * 128)));
/** Sparks up the chimney: [x, phase]. */
const SPARKS = Int16Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 20 + Math.floor(hash(i, 6, 52) * 22) : Math.floor(hash(i, 7, 52) * 64)));

/** Camera x for a peasant whose sprite is at room x `px`. */
export function cameraX(px: number): number {
  const c = px + 8 - 80;
  return c < 0 ? 0 : c > ROOM_W - 160 ? ROOM_W - 160 : c;
}

/**
 * The room behind the actors, panned by `cam`. Reads sim state only.
 * `sky` is the day's weather, `bod` the block of the day.
 */
export function drawCottage(ctx: CanvasRenderingContext2D, s: SimState, cam: number, bod: number, sky: Sky, dmg: boolean, now: number): void {
  const info = dayInfo((s.block / 6) | 0);
  const level = darknessOf(bod);
  const top = ROOM_TOP;
  const gx = GLASS.x - cam;
  // The window first: the room is drawn over it with the glass left open.
  ctx.drawImage(windowCanvas(bod, info.season, sky, dmg), gx, top + GLASS.y);
  const wet = sky === 'rain' || sky === 'storm';
  if (wet || sky === 'snow') {
    setRemap(dmg ? DMG : IDENTITY);
    ctx.fillStyle = hex(wet ? C.mist : C.bone);
    const t = wet ? now >> 3 : now >> 6;
    for (let i = 0; i < 60; i += 3) {
      const y = (DROPS[i + 1]! + t * DROPS[i + 2]!) % GLASS.h;
      const sway = wet ? 0 : ((t + i) >> 4) & 1;
      ctx.fillRect(gx + ((DROPS[i]! + sway) % GLASS.w), top + GLASS.y + y, 1, wet ? 3 : 1);
    }
  }
  ctx.drawImage(roomCanvas(level, dmg), cam, 0, 160, ROOM_H, 0, top, 160, ROOM_H);
  setRemap(dmg ? DMG : IDENTITY);
  if (info.season === 'winter') {
    ctx.fillStyle = hex(C.bone);
    ctx.fillRect(98 - cam, top + 59, 59, 1);
  }
  // The fire, its sparks, and the light it throws on the floor.
  const f = ((now * 3) >> 8) & (FIRE_FRAMES - 1);
  const fx = FIRE_X - cam;
  if (fx > -FIRE_W) {
    ctx.drawImage(fireCanvas(f, dmg), fx, top + FIRE_Y);
    const ember = hex(C.ember);
    const gold = hex(C.gold);
    for (let i = 0; i < SPARKS.length; i += 2) {
      const t = ((now >> 5) + SPARKS[i + 1]!) & 63;
      if (t > 26) continue;
      ctx.fillStyle = t & 4 ? gold : ember;
      ctx.fillRect(fx + SPARKS[i]! - 15 + ((t >> 3) & 1), top + 74 - t, 1, 1);
    }
    const k = ((now >> 7) + (now >> 9)) % 3;
    ctx.drawImage(glowCanvas(k, dmg), FIRE_CX - GLOW_W / 2 - cam, top + 89);
  }
  // Dust turning slowly in the window light, by day.
  if (level === 0) {
    ctx.fillStyle = hex(C.parchment);
    for (let i = 0; i < 24; i += 3) {
      const t = ((now >> 7) + MOTES[i + 2]!) & 127;
      const x = MOTES[i]! + (t >> 3) - cam;
      const y = top + MOTES[i + 1]! + (t >> 2) - 16;
      if ((t & 31) !== 0 && x > 0 && x < 160) ctx.fillRect(x, y, 1, 1);
    }
  }
  // The candle flame.
  const cx = CANDLE_X - cam;
  if (cx > -4 && cx < 164) {
    const flick = (now >> 7) & 1;
    ctx.fillStyle = hex(C.gold);
    ctx.fillRect(cx - 1, top + 64 + flick, 2, 3 - flick);
    ctx.fillStyle = hex(C.bone);
    ctx.fillRect(cx - (flick ? 1 : 0), top + 66, 1, 1);
  }
}

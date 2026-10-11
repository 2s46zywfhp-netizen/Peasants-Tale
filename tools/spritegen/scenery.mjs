// Sky layers, item/tool icons, UI pieces and the side-view rooms.
import { Mask, shade } from './shade.mjs';
import { T, idx } from './palette.mjs';
import { hash } from './tiles.mjs';

const make = (w, h, draw) => {
  const m = new Mask(w, h);
  draw(m);
  return m;
};
const sh = (name, m) => ({ name, w: m.w, h: m.h, px: shade(m.str(), m.w, m.h) });
const raw = (name, w, h, f) => {
  const px = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = f(x, y);
  return { name, w, h, px };
};
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => B4[(y & 3) * 4 + (x & 3)] / 16;

/* ── sky ── */

/** The moon in eight phases (0 new .. 4 full .. 7), 14x14, cream with grey maria. */
function moon(p) {
  return raw(`sky.moon.${p}`, 14, 14, (x, y) => {
    const dx = x - 6.5, dy = y - 6.5;
    if (dx * dx + dy * dy > 42) return T;
    const k = Math.cos((p / 8) * Math.PI * 2); // 1 new .. -1 full
    const lit = p <= 4 ? dx / 6.5 > k : dx / 6.5 < -k;
    if (!lit) return p === 0 ? idx('night', 2) : idx('night', 3);
    if (hash(x, y, 3) > 0.82 || (x - 4) ** 2 + (y - 5) ** 2 < 4) return idx('bone', 1);
    return dx + dy < -3 ? idx('bone', 3) : idx('bone', 2);
  });
}
/** Clouds: a long soft band, tileable (128 wide). */
const clouds = (k) =>
  raw(`sky.clouds.${k}`, 128, 20, (x, y) => {
    const top = 6 + Math.sin((x / 128) * Math.PI * 2 * (k + 1)) * 3 + Math.sin((x / 128) * Math.PI * 6 + k) * 2;
    const bottom = 16 - Math.sin((x / 128) * Math.PI * 4 + k) * 2;
    if (y < top || y > bottom) return T;
    const edge = Math.min(y - top, bottom - y);
    if (edge < 1.2 && bay(x, y) < 0.5) return T;
    return y < top + 2 ? idx('stone', 2) : y > bottom - 2 ? idx('night', 3) : idx('stone', 1);
  });
/** Far silhouette: the castle on its hill and the church tower, 256x48 (dark, to be lit by the LUT). */
const silhouette = () => {
  const m = make(256, 48, (m) => {
    for (let x = 0; x < 256; x++) {
      const hill = 34 - Math.sin((x / 256) * Math.PI) * 10 + Math.sin(x / 9) * 1.5;
      m.rect(x, hill, 1, 48 - hill, 'k');
    }
    // Castle.
    m.rect(78, 8, 60, 22, 'k');
    for (let x = 78; x < 138; x += 6) m.rect(x, 4, 4, 4, 'k');
    m.rect(92, 0, 14, 10, 'k');
    m.rect(122, 2, 12, 8, 'k');
    m.rect(98, 14, 2, 4, ';');
    // Church tower and spire.
    m.rect(176, 12, 12, 24, 'k');
    for (let y = 0; y < 12; y++) m.rect(182 - y / 2, y, y + 1, 1, 'k');
  });
  return { name: 'sky.silhouette', w: 256, h: 48, px: shade(m.str(), 256, 48).map((v) => (v === T ? T : v === idx('night', 0) ? idx('night', 0) : idx('night', 1))) };
};
/** Treeline, tileable (128 wide). */
const treeline = () =>
  raw('sky.treeline', 128, 28, (x, y) => {
    const crown = 10 + Math.abs(Math.sin((x / 128) * Math.PI * 9)) * -6 + Math.sin(x / 3.3) * 1.5 + hash(x, 1, 9) * 2;
    if (y < crown) return T;
    return y < crown + 2 ? idx('moss', 0) : idx('night', 2);
  });

/* ── icons (16x16) ── */

const ICONS = {
  bread: (m) => { m.ellipse(8, 9, 6, 4, 'y'); m.rect(4, 7, 8, 1, 'a'); },
  pottage: (m) => { m.ellipse(8, 10, 6, 3, 'o'); m.rect(3, 7, 10, 2, 'v'); },
  meat: (m) => { m.ellipse(8, 8, 5, 4, 'r'); m.rect(11, 10, 4, 2, 'w'); },
  eggs: (m) => { m.ellipse(6, 9, 3, 4, 'w'); m.ellipse(11, 10, 3, 3.5, 'w'); },
  grain: (m) => { m.rect(4, 4, 8, 11, 'b'); m.rect(5, 2, 6, 2, 'y'); m.rect(4, 7, 8, 1, 'l'); },
  ale: (m) => { m.rect(4, 4, 7, 10, 'o'); m.rect(11, 6, 2, 5, 'o'); m.rect(4, 4, 7, 2, 'w'); m.rect(4, 8, 7, 1, 'i'); },
  firewood: (m) => { for (let k = 0; k < 3; k++) m.ellipse(4 + k * 4, 10 - (k % 2) * 3, 2.5, 2.5, k % 2 ? 'y' : 't'); },
  pence: (m) => { m.ellipse(7, 9, 4.5, 4.5, 'y'); m.ellipse(10, 7, 3.5, 3.5, 'y'); m.set(10, 7, 'a'); },
  hen: (m) => { m.ellipse(7, 9, 4.5, 3.5, 'z'); m.ellipse(11, 6, 2, 2, 'z'); m.set(13, 6, 'a'); m.set(11, 4, 'x'); },
  pig: (m) => { m.ellipse(7, 9, 6, 4, 'p'); m.ellipse(13, 9, 2.5, 2.5, 'p'); m.set(12, 8, 'e'); },
  cow: (m) => { m.rect(2, 6, 10, 6, 'c'); m.ellipse(13, 8, 2.5, 2.5, 'c'); m.ellipse(5, 8, 2, 2, 'C'); },
  ox: (m) => { m.rect(2, 6, 10, 6, 'C'); m.ellipse(13, 8, 2.5, 2.5, 'C'); m.rect(12, 4, 1, 2, 'w'); },
  axe: (m) => { m.line(4, 14, 11, 4, 'o', 1); m.rect(10, 2, 4, 5, 'i'); },
  maul: (m) => { m.line(4, 14, 10, 5, 'o', 1); m.rect(8, 2, 6, 5, 'i'); },
  hoe: (m) => { m.line(3, 14, 12, 3, 'o', 1); m.rect(11, 2, 2, 5, 'i'); },
  sickle: (m) => { m.line(4, 14, 6, 10, 'o', 2); for (let k = 0; k < 8; k++) m.set(8 + Math.sin(k / 2.5) * 4, 9 - Math.cos(k / 2.5) * 5, 'i'); },
  flail: (m) => { m.line(3, 14, 9, 6, 'o', 1); m.line(9, 6, 13, 9, 'o', 2); },
  ladle: (m) => { m.line(5, 3, 9, 11, 'o', 1); m.ellipse(10, 12, 3, 2, 'o'); },
  bucket: (m) => { m.rect(4, 6, 8, 8, 'o'); m.rect(4, 8, 8, 1, 'i'); m.rect(4, 11, 8, 1, 'i'); m.rect(5, 6, 6, 1, 'w'); },
  seedbag: (m) => { m.ellipse(8, 10, 5, 5, 'b'); m.rect(6, 3, 4, 3, 'b'); m.rect(6, 5, 4, 1, 'l'); },
  bowl: (m) => { m.ellipse(8, 10, 6, 3, 'o'); m.rect(3, 8, 10, 1, 'w'); },
  candle: (m) => { m.rect(7, 6, 3, 8, 'w'); m.rect(7, 3, 2, 3, '+'); m.rect(5, 13, 7, 2, 'i'); },
  prayer: (m) => { m.rect(7, 2, 3, 13, 'y'); m.rect(3, 6, 11, 3, 'y'); },
  bed: (m) => { m.rect(1, 6, 3, 9, 'o'); m.rect(4, 9, 11, 3, 'w'); m.rect(4, 12, 11, 2, 'o'); m.rect(5, 8, 3, 1, 'w'); },
  hearth: (m) => { m.rect(1, 3, 14, 12, '#'); m.ellipse(8, 11, 4, 4, ';'); m.rect(6, 10, 4, 4, 'f'); m.set(7, 11, '+'); },
  coin: (m) => { m.ellipse(8, 8, 5, 5, 'y'); m.set(8, 8, 'a'); },
};

/* ── UI pieces ── */

/** 9-slice parchment window (24x24, corners 8): a wooden frame round aged parchment. */
const parchmentWin = () =>
  raw('ui.parchment', 24, 24, (x, y) => {
    const edge = Math.min(x, y, 23 - x, 23 - y);
    if (edge === 0) return (x === 0 || y === 0) && (x + y) % 23 !== 0 ? idx('earth', 1) : idx('earth', 0);
    if (edge === 1) return idx('earth', 3);
    if (edge === 2) return idx('earth', 2);
    if (edge === 3) return idx('bone', 0);
    return hash(x, y, 5) > 0.9 ? idx('bone', 1) : bay(x, y) < 0.08 ? idx('bone', 1) : idx('bone', 2);
  });
/** 9-slice dark panel (dialogue, prompts): night fill, bone rim. */
const darkWin = () =>
  raw('ui.dark', 24, 24, (x, y) => {
    const edge = Math.min(x, y, 23 - x, 23 - y);
    if (edge === 0) return idx('night', 0);
    if (edge === 1) return (x + y) % 23 === 0 ? idx('bone', 1) : idx('bone', 1);
    if (edge === 2) return idx('night', 3);
    return idx('night', 1);
  });
/** The small floating prompt bubble (9-slice, 12x12) and its tail. */
const bubble = () =>
  raw('ui.bubble', 12, 12, (x, y) => {
    const edge = Math.min(x, y, 11 - x, 11 - y);
    if (edge === 0) return (x === 0 || x === 11) && (y === 0 || y === 11) ? T : idx('night', 0);
    return edge === 1 ? idx('bone', 1) : idx('night', 1);
  });
const bubbleTail = () => raw('ui.bubble.tail', 5, 3, (x, y) => (Math.abs(x - 2) <= 2 - y ? (Math.abs(x - 2) === 2 - y ? idx('night', 0) : idx('night', 1)) : T));
const cursor = () => raw('ui.cursor', 6, 8, (x, y) => (x <= 3 - Math.abs(y - 3.5) + 0.5 ? (x === 0 || x >= 3 - Math.abs(y - 3.5) - 0.5 ? idx('blood', 3) : idx('fire', 1)) : T));
const slot = () =>
  raw('ui.slot', 20, 20, (x, y) => {
    const edge = Math.min(x, y, 19 - x, 19 - y);
    return edge === 0 ? idx('night', 0) : edge === 1 ? idx('stone', 0) : idx('night', 2);
  });

/* ── the side-view rooms ── */

export const COTTAGE_ROOM = {
  w: 384, h: 192, floor: 130, glass: { x: 164, y: 34, w: 58, h: 50 }, fire: { x: 47, y: 126 }, candle: { x: 262, y: 100 },
  door: { x: 350, w: 30 }, spots: [
    { x0: 0, x1: 96, label: 'HEARTH' }, { x0: 132, x1: 236, label: 'TABLE' }, { x0: 244, x1: 344, label: 'BED' },
  ],
  bed: { x: 296, y: 102 },
};
export const CHURCH_ROOM = {
  w: 384, h: 192, floor: 134, door: { x: 0, w: 30 }, spots: [{ x0: 40, x1: 250, label: 'PEWS' }, { x0: 250, x1: 384, label: 'ALTAR' }],
  candles: [{ x: 318, y: 86 }, { x: 350, y: 86 }], windows: [{ x: 96, y: 30 }, { x: 184, y: 30 }, { x: 272, y: 30 }],
};

/** Perspective floorboards from the wall line to the front. */
function floor(px, W, H, top, vy, wood = true) {
  for (let y = top; y < H; y++) {
    const t = y - vy;
    for (let x = 0; x < W; x++) {
      const u = ((x - W / 2) * 40) / t, u2 = ((x + 1 - W / 2) * 40) / t;
      const board = Math.floor(u / 13);
      let c;
      if (wood) {
        c = hash(board, 21) < 0.3 ? idx('earth', 1) : idx('earth', 2);
        if (c === idx('earth', 2) && hash(x >> 1, y, 22) < 0.1) c = idx('earth', 1);
        if (Math.floor(u2 / 13) !== board) c = idx('earth', 0);
        if (y === 132 + Math.floor(hash(board, 23) * 56)) c = idx('earth', 0);
      } else {
        c = hash(board, Math.floor(y / 10), 24) < 0.5 ? idx('stone', 1) : idx('stone', 0);
        if (Math.floor(u2 / 13) !== board || y % 10 === 0) c = idx('night', 3);
      }
      if (y === top) c = idx('night', 0);
      else if (y < top + 4 && bay(x, y) < 0.5) c = idx('night', 1);
      px[y * W + x] = c;
    }
  }
}

/** Overlay a shaded mask onto a room at (ox, oy). */
function put(px, W, m, ox, oy) {
  const s = shade(m.str(), m.w, m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (s[y * m.w + x] !== T) px[(oy + y) * W + ox + x] = s[y * m.w + x];
}

function cottageRoom() {
  const R = COTTAGE_ROOM, W = R.w, H = R.h;
  const px = new Uint8Array(W * H);
  // Back wall: vertical planks, grain, knots, shadow under the beam.
  for (let y = 14; y < R.floor; y++)
    for (let x = 0; x < W; x++) {
      const plank = Math.floor((x + 3) / 14), p = (x + 3) % 14;
      const dark = hash(plank, 1) < 0.3;
      let c = dark ? idx('earth', 1) : idx('earth', 2);
      if (hash(x, y >> 2, 3) < 0.12) c = dark ? idx('earth', 0) : idx('earth', 1);
      if (p === 0) c = idx('earth', 0);
      else if (p === 1) c = idx('earth', 1);
      else if (p === 2 && !dark) c = idx('earth', 3);
      if (y < 24 && bay(x, y) < (24 - y) / 10) c = idx('earth', 0);
      if (y >= R.floor - 4) c = idx('earth', 1);
      px[y * W + x] = c;
    }
  // Ceiling beam.
  for (let y = 0; y < 14; y++) for (let x = 0; x < W; x++) px[y * W + x] = y < 2 || y === 12 ? idx('night', 0) : y === 2 ? idx('earth', 3) : y > 9 ? idx('earth', 1) : hash(x, y, 7) < 0.15 ? idx('earth', 3) : idx('earth', 2);
  floor(px, W, H, R.floor, 46, true);
  // Posts and braces.
  for (const x of [94, 236]) put(px, W, make(28, R.floor - 12, (m) => { m.rect(12, 0, 5, R.floor - 12, 'o'); m.line(17, 18, 27, 2, 'o', 3); m.line(11, 18, 1, 2, 'o', 3); }), x - 12, 12);
  // Chimney and hearth.
  put(px, W, make(84, R.floor + 6, (m) => {
    m.rect(4, 0, 76, R.floor + 6, '#');
    for (let y = 0; y < R.floor; y += 10) for (let x = (y / 10) % 2 ? 6 : 0; x < 84; x += 14) m.rect(4 + x, y, 1, 9, ';');
    for (let y = 9; y < R.floor; y += 10) m.rect(4, y, 76, 1, ';');
    m.rect(0, 64, 84, 6, 'o'); // mantel
    // The arch.
    for (let y = 80; y < R.floor + 4; y++)
      for (let x = 14; x < 70; x++) {
        const dx = x - 42, r = 24;
        const inside = Math.abs(dx) <= r && (y >= 92 || dx * dx + ((y - 92) * 1.3) ** 2 <= r * r);
        const ring = Math.abs(dx) <= r + 4 && (y >= 92 || dx * dx + ((y - 92) * 1.3) ** 2 <= (r + 4) ** 2);
        if (inside) m.set(x, y, ';');
        else if (ring) m.set(x, y, Math.floor(Math.atan2(y - 92, dx) * 5) % 2 ? '#' : 'n');
      }
    m.rect(0, R.floor, 84, 6, 'n'); // hearthstone
    m.rect(10, 56, 10, 8, 'k'); // pot on the mantel
    m.rect(64, 58, 4, 6, 'w'); // candle stub
  }), 2, 0);
  // Shelf with jars, herbs from the beam.
  put(px, W, make(46, 20, (m) => { m.rect(0, 12, 46, 3, 'o'); m.rect(4, 2, 8, 10, 'r'); m.rect(16, 4, 7, 8, 'n'); m.rect(27, 5, 6, 7, 'o'); m.rect(37, 3, 6, 9, 'w'); }), 106, 56);
  put(px, W, make(24, 34, (m) => { for (let k = 0; k < 4; k++) { m.line(4 + k * 5, 0, 4 + k * 5, 8, 'l', 1); m.rect(3 + k * 5, 8, 3, 16 + (k % 2) * 6, 'v'); } }), 134, 12);
  // Window frame and sill; the glass is left open for the sky.
  put(px, W, make(74, 66, (m) => { m.rect(0, 0, 74, 62, 'o'); m.rect(4, 4, 66, 54, ';'); m.rect(0, 58, 74, 8, 'o'); }), 156, 26);
  for (let y = R.glass.y; y < R.glass.y + R.glass.h; y++) for (let x = R.glass.x; x < R.glass.x + R.glass.w; x++) px[y * W + x] = T;
  // Table, bowl, jug, loaf; stool.
  put(px, W, make(72, 44, (m) => { m.rect(0, 10, 72, 6, 'o'); m.rect(3, 16, 66, 4, 'l'); m.rect(4, 20, 5, 24, 'o'); m.rect(63, 20, 5, 24, 'o'); m.rect(10, 4, 12, 6, 'o'); m.rect(26, 0, 7, 10, 'r'); m.ellipse(48, 6, 8, 4, 'y'); }), 136, 102);
  put(px, W, make(24, 22, (m) => { m.rect(0, 0, 24, 4, 'o'); m.rect(3, 4, 3, 18, 'o'); m.rect(18, 4, 3, 18, 'o'); }), 212, 124);
  // Bedside table and candle; bed; door.
  put(px, W, make(22, 50, (m) => { m.rect(0, 14, 22, 4, 'o'); m.rect(2, 18, 18, 32, 'l'); m.rect(4, 22, 14, 10, 'o'); m.rect(4, 36, 14, 10, 'o'); m.rect(9, 4, 4, 10, 'w'); m.rect(7, 13, 8, 2, 'i'); }), 250, 86);
  put(px, W, make(80, 62, (m) => {
    m.rect(0, 0, 8, 62, 'o');
    m.rect(72, 16, 8, 46, 'o');
    m.rect(8, 22, 64, 8, 'w'); // sheet
    m.rect(28, 20, 44, 14, 'n'); // wool blanket
    for (let x = 32; x < 72; x += 9) m.line(x, 21, x - 3, 33, 'k', 1);
    m.rect(10, 16, 16, 8, 'w'); // pillow
    m.rect(8, 34, 64, 6, 'o');
    m.rect(10, 40, 4, 22, 'o');
    m.rect(66, 40, 4, 22, 'o');
  }), 272, 80);
  put(px, W, make(34, R.floor - 30, (m) => { m.rect(0, 0, 34, 6, 'o'); for (let x = 4; x < 32; x++) m.rect(x, 6, 1, R.floor - 36, (x - 4) % 9 === 0 ? 'l' : 'o'); m.rect(4, 22, 26, 3, 'i'); m.rect(4, R.floor - 50, 26, 3, 'i'); m.rect(8, 56, 3, 6, 'i'); }), 348, 30);
  return { name: 'room.cottage', w: W, h: H, px };
}

function churchRoom() {
  const R = CHURCH_ROOM, W = R.w, H = R.h;
  const px = new Uint8Array(W * H);
  // Stone walls in courses, a vaulted shadow overhead.
  for (let y = 0; y < R.floor; y++)
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 9), off = row % 2 ? 9 : 0;
      let c = hash(Math.floor((x + off) / 18), row, 11) > 0.6 ? idx('stone', 1) : idx('stone', 0);
      if (y % 9 === 8 || (x + off) % 18 === 17) c = idx('night', 3);
      if (y < 30 && bay(x, y) < (30 - y) / 20) c = idx('night', 2);
      px[y * W + x] = c;
    }
  floor(px, W, H, R.floor, 50, false);
  // Arched stained windows.
  for (const w of R.windows)
    put(px, W, make(32, 64, (m) => {
      m.rect(0, 12, 32, 52, '#');
      m.ellipse(16, 14, 16, 14, '#');
      m.rect(4, 14, 24, 46, 'q');
      m.ellipse(16, 14, 12, 11, 'q');
      m.rect(4, 30, 24, 8, '$');
      m.rect(14, 4, 4, 56, 'y');
      m.rect(4, 22, 24, 2, 'y');
    }), w.x, w.y);
  // The door, the pews, the altar with its candles, the rood.
  put(px, W, make(30, 84, (m) => { m.rect(0, 0, 30, 84, '#'); m.rect(4, 14, 22, 70, 'o'); m.ellipse(15, 16, 11, 10, 'o'); m.line(15, 8, 15, 83, 'l', 1); }), 0, R.floor - 84);
  for (let k = 0; k < 5; k++) put(px, W, make(30, 30, (m) => { m.rect(0, 0, 4, 30, 'o'); m.rect(0, 14, 30, 4, 'o'); m.rect(26, 14, 4, 16, 'o'); }), 48 + k * 40, R.floor - 18);
  put(px, W, make(72, 52, (m) => { m.rect(0, 20, 72, 32, '#'); m.rect(0, 18, 72, 4, 'w'); m.rect(4, 24, 64, 4, '$'); m.rect(28, 0, 16, 18, 'y'); m.rect(34, 4, 4, 12, '+'); }), 300, R.floor - 50);
  for (const c of R.candles) put(px, W, make(6, 14, (m) => { m.rect(1, 2, 4, 12, 'w'); m.rect(0, 12, 6, 2, 'y'); }), c.x - 3, c.y + 2);
  put(px, W, make(30, 50, (m) => { m.rect(13, 0, 4, 50, 'o'); m.rect(0, 12, 30, 4, 'o'); m.rect(12, 16, 6, 14, 'w'); }), 322, 18);
  return { name: 'room.church', w: W, h: H, px };
}

export function scenery() {
  const frames = [];
  for (let p = 0; p < 8; p++) frames.push(moon(p));
  frames.push(clouds(0), clouds(1), silhouette(), treeline());
  for (const [name, draw] of Object.entries(ICONS)) frames.push(sh(`icon.${name}`, make(16, 16, draw)));
  frames.push(parchmentWin(), darkWin(), bubble(), bubbleTail(), cursor(), slot());
  frames.push(cottageRoom(), churchRoom());
  return { frames, anims: {}, meta: { rooms: { cottage: COTTAGE_ROOM, church: CHURCH_ROOM }, icons: Object.keys(ICONS) } };
}

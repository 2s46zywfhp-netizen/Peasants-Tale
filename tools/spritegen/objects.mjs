// Buildings, trees and things in the world, livestock and the black dog: material masks, shaded.
import { Mask, shade } from './shade.mjs';
import { hash } from './tiles.mjs';

const make = (w, h, draw) => {
  const m = new Mask(w, h);
  draw(m);
  return m;
};
const sh = (name, m) => ({ name, w: m.w, h: m.h, px: shade(m.str(), m.w, m.h) });
const swap = (m, from, to) => {
  const n = new Mask(m.w, m.h);
  n.d = m.d.map((c) => (c === from ? to : c));
  return n;
};

/** A thatched cottage: roof, limewashed daub walls in a timber frame, door and window. */
function cottage(w = 64, variant = 0) {
  return make(w, 60, (m) => {
    const wallTop = 30, base = 59;
    // Walls and frame.
    m.rect(4, wallTop, w - 8, base - wallTop + 1, '=');
    for (const x of [4, w / 2 - 1, w - 6]) m.rect(x, wallTop, 2, base - wallTop + 1, 'o');
    m.rect(4, wallTop, w - 8, 2, 'o');
    m.rect(4, base - 1, w - 8, 2, 'o');
    if (variant === 0) for (let k = 0; k < 2; k++) m.line(6 + k * (w / 2 - 6), wallTop + 2, 6 + k * (w / 2 - 6) + 8, base - 2, 'o', 1);
    // Thatch: a deep roof with a ridge and ragged eaves.
    for (let y = 2; y < wallTop + 2; y++) {
      const inset = Math.max(0, 16 - Math.floor(y / 2));
      for (let x = inset; x < w - inset; x++) m.set(x, y, hash(x, y, 5 + variant) > 0.88 ? 'y' : 't');
    }
    for (let x = 0; x < w; x++) if (hash(x, 1, 9) > 0.4) m.set(x, wallTop + 2, 't');
    m.rect(14, 2, w - 28, 2, 'o'); // ridge
    // Chimney (smoke rises from here).
    m.rect(w - 22, 0, 6, 10, '#');
    // Door and window.
    m.rect(12, base - 18, 10, 18, 'o');
    m.line(17, base - 18, 17, base - 1, 'l', 1);
    m.set(20, base - 9, 'i');
    m.rect(w - 24, wallTop + 6, 12, 10, 'o');
    m.rect(w - 22, wallTop + 8, 8, 6, '@');
    m.line(w - 18, wallTop + 8, w - 18, wallTop + 13, 'o', 1);
  });
}

function alehouse() {
  const m = cottage(72, 1);
  m.rect(48, 34, 2, 4, 'i'); // sign bracket
  m.rect(50, 36, 14, 10, 'o');
  m.rect(52, 38, 10, 6, 'y'); // painted sign
  m.rect(26, 50, 7, 9, 'o'); // a barrel
  m.rect(26, 52, 7, 1, 'i');
  m.rect(26, 56, 7, 1, 'i');
  return m;
}

function church() {
  return make(112, 96, (m) => {
    // Nave.
    m.rect(28, 44, 80, 52, '#');
    for (let y = 30; y < 46; y++) {
      const inset = Math.floor((46 - y) * 1.2);
      m.rect(24 + inset / 3, y, 88 - inset / 2, 1, '%');
    }
    // Tower with battlements.
    m.rect(0, 14, 30, 82, '#');
    for (let x = 0; x < 30; x += 6) m.rect(x, 8, 4, 6, '#');
    m.rect(10, 24, 8, 14, ';'); // belfry
    m.rect(13, 20, 2, 4, 'y'); // weathervane post
    // Door with a pointed arch.
    m.rect(52, 70, 18, 26, 'o');
    for (let k = 0; k < 6; k++) m.rect(52 + k, 70 - (6 - k), 18 - k * 2, 1, 'o');
    m.line(61, 66, 61, 95, 'l', 1);
    // Stained windows.
    for (const x of [36, 82, 96]) {
      m.rect(x, 54, 8, 14, 'o');
      m.rect(x + 1, 55, 6, 12, 'q');
      m.rect(x + 1, 59, 6, 3, '$');
      m.rect(x + 3, 55, 2, 12, 'y');
    }
    m.rect(76, 22, 2, 10, 'y'); // cross on the gable
    m.rect(73, 25, 8, 2, 'y');
  });
}

function manorGate() {
  return make(96, 64, (m) => {
    m.rect(0, 16, 96, 48, '#');
    for (let x = 0; x < 96; x += 8) m.rect(x, 10, 5, 6, '#');
    m.rect(32, 28, 32, 36, ';'); // the gateway
    for (let k = 0; k < 8; k++) m.rect(32 + k, 28 - k / 2, 32 - k * 2, 1, '#');
    m.rect(34, 34, 28, 30, 'o'); // gates
    m.line(48, 34, 48, 63, 'l', 1);
    for (let y = 38; y < 64; y += 8) m.rect(34, y, 28, 1, 'i');
    for (const x of [8, 78]) {
      m.rect(x, 20, 10, 26, '$'); // banners
      m.rect(x + 3, 26, 4, 8, 'y');
      m.rect(x, 46, 2, 3, '$');
      m.rect(x + 8, 46, 2, 3, '$');
    }
  });
}

const tree = () =>
  make(32, 48, (m) => {
    m.rect(14, 28, 4, 20, '^');
    m.rect(12, 44, 8, 4, '^');
    m.ellipse(16, 18, 13, 12, '&');
    m.ellipse(13, 14, 10, 9, 'v');
    m.ellipse(20, 20, 8, 7, 'v');
    for (let k = 0; k < 24; k++) m.set(4 + hash(k, 1, 3) * 24, 6 + hash(k, 2, 3) * 22, hash(k, 3, 3) > 0.5 ? '&' : 'v');
  });
const pine = () =>
  make(32, 48, (m) => {
    m.rect(14, 38, 4, 10, '^');
    for (let k = 0; k < 4; k++) for (let y = 0; y < 12; y++) {
      const half = Math.floor((y + 3 + k * 2) / 1.3);
      m.rect(16 - half, 4 + k * 9 + y, half * 2, 1, y > 8 ? '&' : hash(k, y, 7) > 0.8 ? 'v' : '&');
    }
  });
const yew = () =>
  make(32, 40, (m) => {
    m.rect(14, 30, 4, 10, '^');
    m.ellipse(16, 18, 12, 15, '&');
    m.ellipse(13, 14, 7, 9, ':');
  });
const bush = () => make(16, 16, (m) => { m.ellipse(8, 10, 7, 5, '&'); m.ellipse(7, 9, 5, 4, 'v'); });
const fence = () => make(16, 16, (m) => { m.rect(0, 6, 16, 2, 'o'); m.rect(0, 11, 16, 2, 'o'); m.rect(2, 4, 2, 12, 'o'); m.rect(12, 4, 2, 12, 'o'); });
const well = () =>
  make(32, 40, (m) => {
    m.rect(4, 4, 24, 3, 't');
    m.rect(6, 7, 2, 18, 'o');
    m.rect(24, 7, 2, 18, 'o');
    m.rect(8, 10, 16, 1, 'o');
    m.rect(14, 11, 4, 5, 'o'); // bucket
    m.ellipse(16, 30, 13, 8, '#');
    m.ellipse(16, 28, 9, 4, ';');
  });
const tomb = () => make(16, 24, (m) => { m.rect(3, 6, 10, 18, '#'); m.ellipse(8, 7, 5, 4, '#'); m.rect(6, 10, 4, 1, ';'); m.rect(7, 8, 2, 6, ';'); });
const cross = () => make(16, 24, (m) => { m.rect(7, 2, 3, 22, '#'); m.rect(3, 6, 11, 3, '#'); });
const barrow = () =>
  make(80, 40, (m) => {
    m.ellipse(40, 34, 38, 22, ':');
    m.rect(32, 20, 16, 20, '#');
    m.rect(35, 24, 10, 16, ';');
    m.rect(30, 18, 20, 3, '#'); // lintel
  });
const standingStone = () => make(16, 32, (m) => { m.ellipse(8, 16, 5, 15, '#'); m.set(6, 10, ';'); m.set(9, 18, ';'); });
const fairyRing = () =>
  make(32, 16, (m) => {
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const x = 16 + Math.cos(a) * 12, y = 8 + Math.sin(a) * 5;
      m.rect(x - 1, y - 1, 3, 1, k % 3 ? 'w' : '$');
      m.set(x, y, 'w');
    }
  });
const woodpile = () => make(32, 20, (m) => { for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) m.ellipse(4 + k * 5 + r * 2.5, 16 - r * 5, 2.5, 2.5, k % 2 ? 't' : 'y'); });
const block = () => make(16, 16, (m) => { m.rect(3, 6, 10, 10, '^'); m.ellipse(8, 6, 5, 2, 't'); m.line(6, 1, 10, 6, 'i', 1); });
const coop = () => make(32, 28, (m) => { for (let y = 0; y < 10; y++) m.rect(10 - y, y, 12 + y * 2, 1, 't'); m.rect(2, 10, 28, 18, 'o'); m.rect(12, 18, 8, 10, ';'); m.rect(4, 12, 24, 1, 'l'); });
const sty = () => make(48, 24, (m) => { m.rect(0, 8, 48, 16, 'o'); m.rect(2, 10, 44, 12, 'h'); for (let x = 0; x < 48; x += 8) m.rect(x, 4, 2, 20, 'o'); m.rect(0, 6, 48, 2, 'o'); });
const haystack = () => make(32, 28, (m) => { m.ellipse(16, 18, 14, 10, 't'); m.ellipse(16, 10, 8, 6, 't'); });
const cart = () => make(40, 28, (m) => { m.rect(4, 8, 30, 8, 'o'); m.line(34, 12, 40, 16, 'o', 2); m.ellipse(10, 20, 6, 6, '^'); m.ellipse(10, 20, 2, 2, 'i'); m.ellipse(28, 20, 6, 6, '^'); m.ellipse(28, 20, 2, 2, 'i'); });
const stall = () => make(48, 36, (m) => { for (let x = 0; x < 48; x++) m.rect(x, 0, 1, 8, Math.floor(x / 6) % 2 ? '$' : 'w'); m.rect(2, 8, 2, 28, 'o'); m.rect(44, 8, 2, 28, 'o'); m.rect(0, 22, 48, 6, 'o'); m.rect(6, 18, 6, 4, 'y'); m.rect(16, 18, 8, 4, 'v'); m.rect(30, 19, 10, 3, 'w'); });
const marketCross = () => make(16, 40, (m) => { m.rect(2, 32, 12, 8, '#'); m.rect(6, 4, 4, 28, '#'); m.rect(2, 8, 12, 3, '#'); });
const tent = () => make(48, 32, (m) => { for (let y = 0; y < 30; y++) m.rect(24 - y * 0.8, y + 2, y * 1.6, 1, y % 6 === 0 ? 'b' : 'n'); m.rect(20, 18, 8, 14, ';'); });
const sign = () => make(16, 24, (m) => { m.rect(7, 8, 2, 16, 'o'); m.rect(1, 2, 14, 7, 'o'); m.rect(3, 4, 10, 1, 'l'); m.rect(3, 6, 7, 1, 'l'); });
const campfire = () => make(16, 12, (m) => { m.line(2, 10, 14, 6, 't', 2); m.line(2, 6, 14, 10, 'o', 2); for (let k = 0; k < 6; k++) m.set(3 + k * 2, 11, '#'); });

/** Livestock and the dog, side view (right-facing): idle 2 frames, walk 4. */
function beast(kind, frame, walking) {
  const legPhase = walking ? [[0, 2], [1, 1], [2, 0], [1, 1]][frame] : [[0, 0], [0, 0]][frame];
  const breath = walking ? 0 : frame;
  const legs = (m, xs, top, len, mat) => xs.forEach((x, k) => m.rect(x + (k % 2 ? legPhase[0] : legPhase[1]) - 1, top, 2, len, mat));
  if (kind === 'hen')
    return make(16, 16, (m) => {
      m.ellipse(7, 9 - breath * 0, 5, 4, 'z');
      m.ellipse(11, 5 + (walking && frame % 2 ? 1 : 0), 2.5, 2.5, 'z');
      m.set(14, 5, 'a');
      m.set(11, 2, 'x');
      m.set(12, 5, 'e');
      m.rect(1, 6, 3, 3, 'z'); // tail
      legs(m, [6, 9], 13, 3, 'a');
    });
  if (kind === 'pig')
    return make(24, 16, (m) => {
      m.ellipse(11, 8 - breath, 9, 5, 'p');
      m.ellipse(20, 8, 3.5, 3.5, 'p');
      m.rect(22, 8, 2, 2, 'C');
      m.set(20, 6, 'e');
      m.set(18, 3, 'p');
      legs(m, [5, 8, 14, 17], 12, 4, 'C');
      m.set(1, 6, 'C');
    });
  if (kind === 'cow' || kind === 'ox')
    return make(32, 24, (m) => {
      const hide = kind === 'ox' ? 'C' : 'c';
      m.rect(4, 6 - breath, 20, 11, hide);
      if (kind === 'cow') { m.ellipse(10, 10, 3, 3, 'C'); m.ellipse(18, 8, 2.5, 2, 'C'); }
      m.ellipse(26, 9, 4, 4, hide);
      m.rect(28, 10, 3, 3, kind === 'cow' ? 'p' : 'C');
      m.set(27, 7, 'e');
      m.rect(25, 3, 1, 3, 'w'); // horn
      m.rect(28, 3, 1, 3, 'w');
      legs(m, [6, 9, 19, 22], 17, 7, hide === 'c' ? 'C' : 'l');
      m.line(3, 7, 1, 14, hide, 1); // tail
    });
  // The black dog.
  return make(24, 16, (m) => {
    m.rect(4, 5 - breath, 13, 6, 'd');
    m.ellipse(19, 5, 3.5, 3, 'd');
    m.rect(21, 6, 3, 2, 'd');
    m.set(19, 1, 'd');
    m.set(20, 4, 'x'); // coal eye
    legs(m, [5, 8, 13, 16], 11, 5, 'd');
    m.line(4, 6, 0, 2, 'd', 1);
  });
}

/** The hearth fire: flame frames for blazing (8), banked (4), and cold ash. */
function fireFrame(f, heat) {
  return make(32, 28, (m) => {
    const base = 22;
    if (heat > 0) {
      for (let x = 0; x < 32; x++) {
        const n = (x - 15.5) / 15.5;
        const H = Math.max(0, (heat === 2 ? 20 : 7) * (1 - n * n));
        const tongue = H * (0.5 + 0.5 * hash(x >> 1, f, 31)) + (hash(x, f, 32) < 0.12 ? 3 : 0);
        for (let y = 0; y <= tongue; y++) {
          const sway = Math.round(Math.sin((y + f * 2.3) / 3.2) * (y / 9));
          const frac = y / Math.max(1, tongue);
          m.set(x + sway, base - y, frac < 0.3 && Math.abs(n) < 0.4 ? '+' : frac < 0.65 ? 'f' : 'a');
        }
      }
      for (let x = 3; x < 29; x++) m.set(x, base + 1, hash(x, f, 36) < 0.5 ? 'a' : 'x');
    } else for (let x = 3; x < 29; x++) m.set(x, base + 1, hash(x, 2, 39) < 0.5 ? '#' : 'n');
    m.line(1, base + 4, 30, base + 2, heat ? '^' : 'n', 2);
    m.line(1, base + 2, 30, base + 4, heat ? 'o' : '#', 2);
  });
}

export function objects() {
  const frames = [];
  const anims = {};
  const add = (name, m) => frames.push(sh(name, m));
  const c = cottage();
  add('o.cottage', c);
  add('o.cottage.lit', swap(c, '@', '!'));
  const n = cottage(64, 1);
  add('o.house', n);
  add('o.house.lit', swap(n, '@', '!'));
  const a = alehouse();
  add('o.alehouse', a);
  add('o.alehouse.lit', swap(a, '@', '!'));
  add('o.church', church());
  add('o.manorGate', manorGate());
  add('o.tree', tree());
  add('o.pine', pine());
  add('o.yew', yew());
  add('o.bush', bush());
  add('o.fence', fence());
  add('o.well', well());
  add('o.tomb', tomb());
  add('o.cross', cross());
  add('o.barrow', barrow());
  add('o.standingStone', standingStone());
  add('o.fairyRing', fairyRing());
  add('o.woodpile', woodpile());
  add('o.block', block());
  add('o.coop', coop());
  add('o.sty', sty());
  add('o.haystack', haystack());
  add('o.cart', cart());
  add('o.stall', stall());
  add('o.marketCross', marketCross());
  add('o.tent', tent());
  add('o.sign', sign());
  add('o.campfire', campfire());
  for (const kind of ['hen', 'pig', 'cow', 'ox', 'dog']) {
    const idle = [0, 1].map((k) => (add(`${kind}.idle.${k}`, beast(kind, k, false)), `${kind}.idle.${k}`));
    const walk = [0, 1, 2, 3].map((k) => (add(`${kind}.walk.${k}`, beast(kind, k, true)), `${kind}.walk.${k}`));
    anims[`${kind}.idle`] = { frames: idle, ms: 800 };
    anims[`${kind}.walk`] = { frames: walk, ms: 170 };
  }
  const fire = [];
  for (let k = 0; k < 8; k++) {
    add(`fire.blazing.${k}`, fireFrame(k, 2));
    fire.push(`fire.blazing.${k}`);
  }
  anims['fire.blazing'] = { frames: fire, ms: 85 };
  const banked = [0, 1, 2, 3].map((k) => (add(`fire.banked.${k}`, fireFrame(k, 1)), `fire.banked.${k}`));
  anims['fire.banked'] = { frames: banked, ms: 220 };
  add('fire.out', fireFrame(0, 0));
  const flames = [0, 1, 2, 3].map((k) => (add(`fire.camp.${k}`, make(16, 16, (m) => {
    for (let x = 3; x < 13; x++) {
      const h = (6 - Math.abs(x - 8)) * (0.6 + 0.4 * hash(x, k, 40));
      for (let y = 0; y < h; y++) m.set(x, 13 - y, y < h * 0.4 ? '+' : y < h * 0.75 ? 'f' : 'a');
    }
  })), `fire.camp.${k}`));
  anims['fire.camp'] = { frames: flames, ms: 110 };
  return { frames, anims };
}

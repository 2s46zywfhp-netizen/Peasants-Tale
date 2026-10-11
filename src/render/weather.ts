import type { Season } from '../sim/calendar';
import { Rng } from '../sim/rng';
import { weatherFor, type Sky } from '../sim/weather';
import { H, LOCK, W, dither, plot } from './fb';
import { C } from './palette';

/*
 * Weather in the air: rain with splashes where drops land, snow, autumn leaves, lightning; and the state of
 * the ground (how much snow lies, how hard the wind blows) worked out from the sim's own weather days.
 * Particles live in a fixed pool: nothing is allocated while running.
 */

const MAX = 180;
const xs = new Float32Array(MAX);
const ys = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const ph = new Float32Array(MAX);
/** Where a drop lands (screen y). */
const land = new Float32Array(MAX);
const SPLASH = 40;
const sx = new Int16Array(SPLASH);
const sy = new Int16Array(SPLASH);
const st = new Float32Array(SPLASH);
let splashNext = 0;

const RAND = (() => {
  const r = new Rng(1349);
  return Float32Array.from({ length: 1024 }, () => r.next());
})();
let ri = 0;
function rnd(): number {
  ri = (ri + 1) & 1023;
  return RAND[ri]!;
}

type Kind = 'none' | 'rain' | 'storm' | 'snow' | 'leaves';
let kind: Kind = 'none';
let count = 0;
let flash = 0;
let windNow = 0;
/** Top and bottom (screen y) of the ground drops can land on. */
let groundTop = 68;
let groundBottom = 212;

function spawn(i: number, top: boolean): void {
  xs[i] = rnd() * (W + 40) - 20;
  ys[i] = top ? -rnd() * 60 : rnd() * H;
  ph[i] = rnd() * 6.28;
  land[i] = groundTop + rnd() * (groundBottom - groundTop);
  switch (kind) {
    case 'rain': vx[i] = -20 + windNow * 30; vy[i] = 190 + rnd() * 50; break;
    case 'storm': vx[i] = -40 + windNow * 70; vy[i] = 260 + rnd() * 70; break;
    case 'snow': vx[i] = -4 + rnd() * 8 + windNow * 14; vy[i] = 14 + rnd() * 12; break;
    case 'leaves': vx[i] = 8 + rnd() * 14 + windNow * 20; vy[i] = 16 + rnd() * 12; break;
    default: break;
  }
}

/** Picks the particles from the sim's sky (autumn: falling leaves) and sets the wind. */
export function setWeather(sky: Sky, season: Season, outdoor: boolean, wind: number, top = 68, bottom = 212): void {
  groundTop = top;
  groundBottom = bottom;
  windNow = wind;
  const next: Kind = !outdoor ? 'none' : sky === 'rain' ? 'rain' : sky === 'storm' ? 'storm' : sky === 'snow' ? 'snow' : season === 'autumn' && (sky === 'fair' || sky === 'cloud') ? 'leaves' : 'none';
  if (next === kind) return;
  kind = next;
  count = kind === 'none' ? 0 : kind === 'storm' ? MAX : kind === 'rain' ? 120 : kind === 'snow' ? 100 : 18;
  for (let i = 0; i < count; i++) spawn(i, false);
  st.fill(0);
}

export function particleCount(): number {
  return count;
}

export function updateWeather(dtMs: number): void {
  const dt = dtMs / 1000;
  const wet = kind === 'rain' || kind === 'storm';
  for (let i = 0; i < count; i++) {
    ph[i] = ph[i]! + dt * 2;
    const sway = kind === 'snow' || kind === 'leaves' ? Math.sin(ph[i]!) * 10 : 0;
    xs[i] = xs[i]! + (vx[i]! + sway) * dt;
    ys[i] = ys[i]! + vy[i]! * dt;
    if (wet && ys[i]! >= land[i]!) {
      // A splash where the drop lands.
      sx[splashNext] = xs[i]! | 0;
      sy[splashNext] = land[i]! | 0;
      st[splashNext] = 1;
      splashNext = (splashNext + 1) % SPLASH;
      spawn(i, true);
    } else if (ys[i]! > H || xs[i]! < -24 || xs[i]! > W + 24) spawn(i, true);
  }
  for (let k = 0; k < SPLASH; k++) if (st[k]! > 0) st[k] = st[k]! - dt * 6;
  if (kind === 'storm') {
    if (flash > 0) flash -= dtMs;
    else if (rnd() < dt * 0.12) flash = 110;
  } else flash = 0;
}

const LEAF = [C.ember, C.gold, C.wood, C.rust] as const;

/** Draws the particles (after the world is lit: rain and snow keep their own colours). */
export function drawWeather(): void {
  if (count === 0) return;
  if (kind === 'rain' || kind === 'storm') {
    const v = (kind === 'storm' ? C.mist : C.sea) | LOCK;
    const len = kind === 'storm' ? 5 : 4;
    const lean = vx[0]! / vy[0]!;
    for (let i = 0; i < count; i++) {
      const x = xs[i]!, y = ys[i]!;
      for (let k = 0; k < len; k++) plot(x + lean * k, y + k, v);
    }
    const sv = C.aqua | LOCK;
    for (let k = 0; k < SPLASH; k++) {
      const t = st[k]!;
      if (t <= 0) continue;
      const x = sx[k]!, y = sy[k]!;
      if (t > 0.5) {
        plot(x - 1, y - 1, sv);
        plot(x + 1, y - 1, sv);
      } else {
        plot(x - 2, y, sv);
        plot(x + 2, y, sv);
        plot(x, y - 2, sv);
      }
    }
  } else if (kind === 'snow') {
    const a = C.moon | LOCK, b = C.bone | LOCK;
    for (let i = 0; i < count; i++) {
      plot(xs[i]!, ys[i]!, i % 4 ? b : a);
      if (i % 3 === 0) plot(xs[i]! + 1, ys[i]!, b);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const v = LEAF[i & 3]!;
      plot(xs[i]!, ys[i]!, v);
      if (Math.sin(ph[i]!) > 0) plot(xs[i]! + 1, ys[i]!, v);
      else plot(xs[i]!, ys[i]! + 1, v);
    }
  }
  if (flash > 0) dither(0, 0, W, H, C.moon | LOCK, flash > 60 ? 6 : 3);
}

/** Lightning this frame (the world may light up with it). */
export function lightning(): boolean {
  return flash > 0;
}

/* ── the ground and the wind, from the sim's days ── */

/**
 * How much snow lies (0 none .. 3 deep), from the last days' weather: each snowy day adds, each mild day
 * melts. Pure: the same day always gives the same cover.
 */
export function snowCover(seed: number, day: number): number {
  let cover = 0;
  for (let d = Math.max(0, day - 5); d <= day; d++) {
    const w = weatherFor(seed, d);
    if (w.sky === 'snow') cover += w.tempC < -2 ? 2 : 1;
    else if (w.tempC > 4) cover -= 2;
    else if (w.tempC > 1) cover -= 1;
    if (cover < 0) cover = 0;
    if (cover > 3) cover = 3;
  }
  return cover;
}

/** Wind -1..1 (negative blows west) for a day: storms gust hard, rain steadily, fair days a breeze. */
export function windFor(seed: number, day: number, sky: Sky): number {
  const h = ((Math.imul(seed ^ (day * 2654435761), 1597334677) >>> 0) % 1000) / 1000;
  const dir = h < 0.35 ? -1 : 1;
  const strength = sky === 'storm' ? 0.9 : sky === 'rain' || sky === 'snow' ? 0.5 : sky === 'fog' ? 0.05 : 0.15 + h * 0.3;
  return dir * strength;
}

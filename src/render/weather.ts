import { Rng } from '../sim/rng';
import type { Season } from '../sim/calendar';
import type { Sky } from '../sim/weather';
import { hex, C, type Ci } from './palette';

/** Weather particles in a fixed pool: no allocation while running. */
const MAX = 140;
const xs = new Float32Array(MAX);
const ys = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const ph = new Float32Array(MAX);
/** Random numbers drawn once: a typed-array lookup in the loop never allocates (a returned double would be boxed). */
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

function spawn(i: number, top: boolean): void {
  xs[i] = rnd() * 176 - 8;
  ys[i] = top ? -rnd() * 40 : rnd() * 144;
  ph[i] = rnd() * 6.28;
  switch (kind) {
    case 'rain': vx[i] = -18; vy[i] = 150 + rnd() * 40; break;
    case 'storm': vx[i] = -60; vy[i] = 210 + rnd() * 60; break;
    case 'snow': vx[i] = -4 + rnd() * 8; vy[i] = 14 + rnd() * 10; break;
    case 'leaves': vx[i] = 10 + rnd() * 12; vy[i] = 16 + rnd() * 10; break;
    default: break;
  }
}

/** Pick the particle kind from the sim's weather (and autumn for falling leaves). */
export function setWeather(sky: Sky, season: Season, outdoor: boolean): void {
  const next: Kind = !outdoor ? 'none' : sky === 'rain' ? 'rain' : sky === 'storm' ? 'storm' : sky === 'snow' ? 'snow' : season === 'autumn' && (sky === 'fair' || sky === 'cloud') ? 'leaves' : 'none';
  if (next === kind) return;
  kind = next;
  count = kind === 'none' ? 0 : kind === 'storm' ? MAX : kind === 'rain' ? 90 : kind === 'snow' ? 70 : 14;
  for (let i = 0; i < count; i++) spawn(i, false);
}

export function particleCount(): number {
  return count;
}

export function updateWeather(dtMs: number): void {
  const dt = dtMs / 1000;
  for (let i = 0; i < count; i++) {
    ph[i] = ph[i]! + dt * 2;
    xs[i] = xs[i]! + (vx[i]! + (kind === 'snow' || kind === 'leaves' ? Math.sin(ph[i]!) * 10 : 0)) * dt;
    ys[i] = ys[i]! + vy[i]! * dt;
    if (ys[i]! > 144 || xs[i]! < -10 || xs[i]! > 170) spawn(i, true);
  }
  if (kind === 'storm') {
    if (flash > 0) flash -= dtMs;
    else if (rnd() < dt * 0.15) flash = 90;
  } else flash = 0;
}

const LEAF: readonly Ci[] = [C.ember, C.gold, C.wood];

export function drawWeather(ctx: CanvasRenderingContext2D): void {
  if (count === 0) return;
  if (kind === 'rain' || kind === 'storm') {
    ctx.fillStyle = hex(kind === 'storm' ? C.mist : C.sea);
    for (let i = 0; i < count; i++) ctx.fillRect(xs[i]! | 0, ys[i]! | 0, 1, kind === 'storm' ? 4 : 3);
  } else if (kind === 'snow') {
    ctx.fillStyle = hex(C.bone);
    for (let i = 0; i < count; i++) ctx.fillRect(xs[i]! | 0, ys[i]! | 0, i % 3 === 0 ? 2 : 1, 1);
  } else {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = hex(LEAF[i % 3]!);
      ctx.fillRect(xs[i]! | 0, ys[i]! | 0, 2, Math.sin(ph[i]!) > 0 ? 1 : 2);
    }
  }
  if (flash > 0) {
    ctx.fillStyle = hex(C.bone);
    for (let y = 0; y < 144; y += 2) ctx.fillRect(0, y, 160, 1);
  }
}

import { paint } from './lib';

/** Moon, 12x12, phase 0 (new) .. 4 (full) .. 7 (waning crescent). Lit with bone, the dark limb faintly visible. */
export function moon(phase: number): string[] {
  const r = 5.5;
  // Terminator position: -1 (all dark) .. 1 (all lit), waxing from the right.
  const t = Math.cos((phase / 8) * Math.PI * 2);
  const waxing = phase <= 4;
  return paint(12, 12, (x, y) => {
    const dx = x - 5.5;
    const dy = y - 5.5;
    if (dx * dx + dy * dy > r * r) return '.';
    const half = Math.sqrt(Math.max(0, r * r - dy * dy));
    const nx = half > 0 ? dx / half : 0; // -1 left limb .. 1 right limb
    const lit = waxing ? nx > t : nx < -t;
    if (phase === 4) return (x + y) % 7 === 0 ? '6' : '5';
    return lit ? ((x * 3 + y) % 9 === 0 ? '6' : '5') : '2';
  });
}

/** Distant silhouette: a castle keep with towers and a church spire, 80x22. */
export const SILHOUETTE = paint(80, 22, (x, y) => {
  const ground = 18 + Math.round(Math.sin(x / 9) * 1.5);
  if (y >= ground) return '1';
  // castle 6..40
  if (x >= 6 && x < 40) {
    const towerL = x >= 6 && x < 12;
    const towerR = x >= 32 && x < 38;
    const keep = x >= 16 && x < 28;
    const top = towerL || towerR ? 4 : keep ? 2 : 10;
    const crenel = (towerL || towerR || keep) && y === top && x % 2 === 0;
    if (y > top || crenel) return (x === 22 && y > 6 && y < 9) || (x === 9 && y === 8) ? '9' : '1';
  }
  // church spire 55..67
  if (x >= 55 && x < 67) {
    const cx = 61;
    if (x >= 59 && x < 63 && y >= 6) return '1';
    if (Math.abs(x - cx) < (y - 0) / 3 && y < 8) return '1';
    if (y >= 11) return x === 60 && y === 14 ? '9' : '1';
  }
  return '.';
});

/** Treeline strip, tileable horizontally (32x10). */
export const TREELINE = paint(32, 10, (x, y) => {
  const h = 4 + Math.round(2 * Math.sin(x * 0.7) + 1.5 * Math.sin(x * 0.31 + 1));
  return y >= h ? '1' : '.';
});

/** Cloud bands, tileable (48x8): heaped tops, flat dark bellies. */
export const CLOUDS = [
  paint(48, 8, (x, y) => {
    const top = 4 - Math.round(2.2 * Math.max(0, Math.sin(x * 0.26)) + 1.2 * Math.max(0, Math.sin(x * 0.61 + 1)));
    if (y < top || y > 6) return '.';
    if (y === 6) return x % 3 === 0 ? '.' : '2';
    return y === top ? '6' : y < 5 ? '7' : '2';
  }),
  paint(48, 8, (x, y) => {
    const top = 5 - Math.round(1.5 * Math.max(0, Math.sin(x * 0.18 + 2)) + Math.max(0, Math.sin(x * 0.5)));
    if (y < top || y > 6) return '.';
    return y === top ? '7' : '2';
  }),
];

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)]! / 16;

/**
 * A pool of firelight, dithered so it stays inside the palette: gold at the heart, ember at the edge.
 * `hole` leaves the middle clear (w, h of a window the halo surrounds rather than covers).
 */
function glow(w: number, h: number, strength: number, hole: readonly [number, number] | null = null): string[] {
  return paint(w, h, (x, y) => {
    if (hole && Math.abs(x - w / 2 + 0.5) < hole[0] / 2 + 1 && Math.abs(y - h / 2 + 0.5) < hole[1] / 2 + 1) return '.';
    const dx = (x - w / 2 + 0.5) / (w / 2);
    const dy = (y - h / 2 + 0.5) / (h / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= 1) return '.';
    const t = bayer(x, y);
    const lit = (1 - d) * strength;
    if (lit > 0.55 + t * 0.4) return 'f';
    if (lit > 0.2 + t * 0.5) return '9';
    if (lit > 0.05 + t * 0.35) return 'a';
    return '.';
  });
}

export const GLOWS = {
  hearth: glow(48, 40, 0.5),
  candle: glow(24, 24, 0.45),
  window: glow(30, 22, 0.28, [10, 9]),
};

/** Fog bank, tileable horizontally (64x32): sparse mist thickening toward the ground. */
export const FOG = paint(64, 32, (x, y) => {
  const density = 0.15 + 0.25 * (y / 32) + 0.12 * Math.sin((x / 64) * Math.PI * 4);
  return bayer(x, y) < density && (x * 5 + y * 3) % 7 !== 0 ? '6' : '.';
});

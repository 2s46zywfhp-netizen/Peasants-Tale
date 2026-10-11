import { blitPart, spriteId } from './atlas';
import { H, W, bayer, dither, fill, pix, plot, rect } from './fb';
import { C } from './palette';

export { H, W, bayer, dither, fill, plot, rect };

/** Clears the whole frame to one colour. */
export function clear(v: number = C.black): void {
  fill(v);
}

/** A box: a one-pixel border round a fill. */
export function frame(x: number, y: number, w: number, h: number, border: number, inside: number): void {
  rect(x, y, w, h, border);
  rect(x + 1, y + 1, w - 2, h - 2, inside);
}

/** Ordered-dither darkness over the frame: amount 0 = none, 1 = fully black. */
export function fade(amount: number, v: number = C.black): void {
  if (amount <= 0) return;
  if (amount >= 1) return fill(v);
  dither(0, 0, W, H, v, Math.round(amount * 16));
}

/**
 * A wipe across the screen (scene changes): a dithered edge sweeping left to right. t 0..1 covers, 1..2 uncovers.
 */
export function wipe(t: number, v: number = C.black): void {
  if (t <= 0 || t >= 2) return;
  const cover = t < 1;
  const edge = Math.round((cover ? t : t - 1) * (W + 24)) - 12;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const d = edge - x; // > 0: behind the edge
      const inside = d > 8 || (d > -8 && bayer(x, y) < ((d + 8) * 16) / 16);
      if (cover ? inside : !inside) pix[row + x] = v;
    }
  }
}

let nineIds: Record<string, number> | null = null;
const nine = (name: string): number => {
  nineIds ??= {};
  return (nineIds[name] ??= spriteId(name));
};

/** Draws a 9-slice sprite (corners `c` pixels) stretched over a w x h box: edges and middle are tiled. */
export function nineSlice(name: string, x: number, y: number, w: number, h: number, c: number, size: number): void {
  const id = nine(name);
  const mid = size - 2 * c;
  const iw = w - 2 * c, ih = h - 2 * c;
  // Corners.
  blitPart(id, 0, 0, c, c, x, y);
  blitPart(id, size - c, 0, c, c, x + w - c, y);
  blitPart(id, 0, size - c, c, c, x, y + h - c);
  blitPart(id, size - c, size - c, c, c, x + w - c, y + h - c);
  // Edges, tiled.
  for (let i = 0; i < iw; i += mid) {
    const n = Math.min(mid, iw - i);
    blitPart(id, c, 0, n, c, x + c + i, y);
    blitPart(id, c, size - c, n, c, x + c + i, y + h - c);
  }
  for (let j = 0; j < ih; j += mid) {
    const n = Math.min(mid, ih - j);
    blitPart(id, 0, c, c, n, x, y + c + j);
    blitPart(id, size - c, c, c, n, x + w - c, y + c + j);
  }
  // Middle.
  for (let j = 0; j < ih; j += mid)
    for (let i = 0; i < iw; i += mid) blitPart(id, c, c, Math.min(mid, iw - i), Math.min(mid, ih - j), x + c + i, y + c + j);
}

/** An aged-parchment window in a wooden frame: menus, pages, results. Ink inside it is dark. */
export function parchment(x: number, y: number, w: number, h: number): void {
  nineSlice('ui.parchment', x, y, w, h, 8, 24);
}

/** A dark window with a bone rim: dialogue, prompts, the HUD. Text inside it is light. */
export function darkPanel(x: number, y: number, w: number, h: number): void {
  nineSlice('ui.dark', x, y, w, h, 8, 24);
}

/** The small floating bubble (prompts above things in the world), with its tail pointing down at (tx, y + h). */
export function bubble(x: number, y: number, w: number, h: number, tx: number): void {
  nineSlice('ui.bubble', x, y, w, h, 4, 12);
  blitPart(nine('ui.bubble.tail'), 0, 0, 5, 3, tx - 2, y + h - 1);
}

/** Ink colours on parchment, and on dark panels. */
export const INK = { text: C.soil, dim: C.wood, title: C.gore, warn: C.blood, pick: C.blood } as const;
export const LIGHT = { text: C.bone, dim: C.stone, title: C.gold, warn: C.rust, pick: C.flame } as const;

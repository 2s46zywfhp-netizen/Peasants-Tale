import { type Colour } from './palette';
import { H, W } from './screen';

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: Colour): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function clear(ctx: CanvasRenderingContext2D, c: Colour): void {
  rect(ctx, 0, 0, W, H, c);
}

/** Draws a sprite from rows of palette keys; '.' is transparent. */
export function sprite(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  keys: Readonly<Record<string, Colour>>,
  x: number,
  y: number,
): void {
  rows.forEach((row, sy) => {
    for (let sx = 0; sx < row.length; sx++) {
      const c = keys[row[sx]!];
      if (c) rect(ctx, x + sx, y + sy, 1, 1, c);
    }
  });
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither a solid colour over the frame: amount 0 = nothing, 1 = fully covered. */
export function ditherFill(ctx: CanvasRenderingContext2D, amount: number, c: Colour, x0 = 0, y0 = 0, w = W, h = H): void {
  if (amount <= 0) return;
  ctx.fillStyle = c;
  if (amount >= 1) {
    ctx.fillRect(x0, y0, w, h);
    return;
  }
  const level = amount * 16;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) if (BAYER4[(y & 3) * 4 + (x & 3)]! < level) ctx.fillRect(x, y, 1, 1);
}

export function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border: Colour, fill: Colour): void {
  rect(ctx, x, y, w, h, border);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

import { bayer, rect } from './draw';
import { drawText, drawTextCentered } from './font';
import { C, currentRemap, remapKey, setRemap } from './palette';

const cache = new Map<string, HTMLCanvasElement>();

/** Aged parchment with torn edges and stains, cached per palette remap (so DMG mode works). */
function background(): HTMLCanvasElement {
  const r = currentRemap();
  const key = remapKey(r);
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 160;
  c.height = 144;
  const g = c.getContext('2d')!;
  setRemap(r);
  rect(g, 0, 0, 160, 144, C.black);
  for (let y = 2; y < 142; y++) {
    // ragged left/right edges
    const l = 3 + ((y * 7) % 5 === 0 ? 1 : 0) + ((y * 13) % 11 === 0 ? 1 : 0);
    const rr = 157 - ((y * 5) % 7 === 0 ? 1 : 0) - ((y * 3) % 13 === 0 ? 1 : 0);
    rect(g, l, y, rr - l, 1, C.parchment);
    for (let x = l; x < rr; x++) {
      const edge = Math.min(x - l, rr - x, y - 2, 141 - y);
      if (edge < 3 && bayer(x, y) < (3 - edge) * 4) rect(g, x, y, 1, 1, C.wood);
      else if (((x * 31 + y * 17) % 97 === 0)) rect(g, x, y, 1, 1, C.wood);
    }
  }
  // two old stains
  for (const [cx, cy, rad] of [[132, 26, 7], [22, 120, 5]] as const) {
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const d = x * x + y * y;
      if (d <= rad * rad && d >= (rad - 1.5) * (rad - 1.5) && bayer(cx + x, cy + y) < 9) rect(g, cx + x, cy + y, 1, 1, C.wood);
    }
  }
  cache.set(key, c);
  return c;
}

/** A parchment page: heading, then up to 12 lines of ink, starting at `scroll`. */
export function drawParchment(ctx: CanvasRenderingContext2D, title: string, lines: readonly string[], scroll: number, footer: string): void {
  ctx.drawImage(background(), 0, 0);
  drawTextCentered(ctx, title, 6, C.gore);
  rect(ctx, 14, 16, 132, 1, C.wood);
  const n = Math.min(12, lines.length - scroll);
  for (let i = 0; i < n; i++) drawText(ctx, lines[scroll + i]!, 8, 20 + i * 9, C.mud);
  if (scroll > 0) drawText(ctx, '^', 148, 20, C.gore);
  if (scroll + 12 < lines.length) drawText(ctx, 'v', 148, 119, C.gore);
  drawTextCentered(ctx, footer, 132, C.wood);
}

export const PARCHMENT_LINES = 12;
export const PARCHMENT_COLS = 18;

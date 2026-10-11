import { H, W, pix } from './fb';
import { C } from './palette';
import { FONT_ROWS } from './fontData';

export const GLYPH = 8;
const FIRST = 32;
const LAST = 126;

/** 1-bit glyphs, 8x8, one byte per row (bit 7 = left). */
let glyphs: Uint8Array = FONT_ROWS;

/** Installs glyph rows directly (tests, or a font rasterised elsewhere). */
export function setGlyphs(rows: Uint8Array): void {
  glyphs = rows;
}

/** The glyphs are baked in (render/fontData): nothing to load, identical on every device. */
export async function loadFont(): Promise<void> {
  glyphs = FONT_ROWS;
}

function glyph(code: number, x: number, y: number, v: number): void {
  if (code < FIRST || code > LAST) code = 63; // '?'
  const g = (code - FIRST) * GLYPH;
  for (let r = 0; r < GLYPH; r++) {
    const yy = y + r;
    if (yy < 0 || yy >= H) continue;
    const bits = glyphs[g + r]!;
    if (!bits) continue;
    const row = yy * W;
    for (let k = 0; k < GLYPH; k++) {
      if (!(bits & (0x80 >> k))) continue;
      const xx = x + k;
      if (xx >= 0 && xx < W) pix[row + xx] = v;
    }
  }
}

/**
 * Draws text at (x, y) in palette colour `v`. With `shadow` >= 0, a one-pixel drop shadow in that colour
 * first, so light text stays readable over the world.
 */
export function drawText(text: string, x: number, y: number, v: number = C.bone, shadow = -1): void {
  x |= 0;
  y |= 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 32) continue;
    if (shadow >= 0) glyph(code, x + i * GLYPH + 1, y + 1, shadow);
    glyph(code, x + i * GLYPH, y, v);
  }
}

export function drawTextCentered(text: string, y: number, v?: number, width = W, x0 = 0, shadow = -1): void {
  drawText(text, x0 + ((width - text.length * GLYPH) >> 1), y, v, shadow);
}

export function drawTextRight(text: string, right: number, y: number, v?: number, shadow = -1): void {
  drawText(text, right - text.length * GLYPH, y, v, shadow);
}

/** Word-wraps text to lines of at most `cols` characters. */
export function wrap(text: string, cols = 30): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if (line && line.length + 1 + word.length > cols) {
      lines.push(line);
      line = '';
    }
    let w = word;
    while (w.length > cols) {
      lines.push(w.slice(0, cols));
      w = w.slice(cols);
    }
    line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines;
}

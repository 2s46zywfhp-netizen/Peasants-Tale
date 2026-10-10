import { C, type Colour } from './palette';

export const GLYPH = 8;
const FIRST = 32;
const LAST = 126;
const FONT = `${GLYPH}px "Press Start 2P"`;

let masks: Uint8Array[] | null = null;
const atlases = new Map<Colour, HTMLCanvasElement>();

/**
 * Rasterises the bundled Press Start 2P once and thresholds it to 1-bit
 * glyphs, so text is crisp and only ever uses palette colours.
 */
export async function loadFont(): Promise<void> {
  await document.fonts.load(FONT, 'A');
  const n = LAST - FIRST + 1;
  const c = document.createElement('canvas');
  c.width = n * GLYPH;
  c.height = GLYPH;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.bone; // only alpha is read
  for (let i = 0; i < n; i++) ctx.fillText(String.fromCharCode(FIRST + i), i * GLYPH, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  masks = [];
  for (let i = 0; i < n; i++) {
    const m = new Uint8Array(GLYPH * GLYPH);
    for (let y = 0; y < GLYPH; y++)
      for (let x = 0; x < GLYPH; x++) m[y * GLYPH + x] = (img[(y * c.width + i * GLYPH + x) * 4 + 3] ?? 0) >= 128 ? 1 : 0;
    masks.push(m);
  }
}

function atlas(colour: Colour): HTMLCanvasElement {
  let a = atlases.get(colour);
  if (a) return a;
  if (!masks) throw new Error('font not loaded');
  a = document.createElement('canvas');
  a.width = masks.length * GLYPH;
  a.height = GLYPH;
  const ctx = a.getContext('2d')!;
  ctx.fillStyle = colour;
  masks.forEach((m, i) => {
    for (let p = 0; p < m.length; p++) if (m[p]) ctx.fillRect(i * GLYPH + (p % GLYPH), Math.floor(p / GLYPH), 1, 1);
  });
  atlases.set(colour, a);
  return a;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, colour: Colour = C.bone): void {
  const a = atlas(colour);
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < FIRST || code > LAST) code = 63; // '?'
    if (code === 32) continue;
    ctx.drawImage(a, (code - FIRST) * GLYPH, 0, GLYPH, GLYPH, x + i * GLYPH, y, GLYPH, GLYPH);
  }
}

export function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, y: number, colour?: Colour, width = 160): void {
  drawText(ctx, text, Math.floor((width - text.length * GLYPH) / 2), y, colour);
}

/** Word-wraps text to lines of at most `cols` characters. */
export function wrap(text: string, cols = 20): string[] {
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

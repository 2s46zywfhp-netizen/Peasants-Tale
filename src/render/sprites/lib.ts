/**
 * Sprites are palette-indexed strings: one hex digit per pixel naming a palette index
 * (0 black … f gold), '.' for transparent. These helpers transform them in code.
 */
export type Rows = readonly string[];

/** Rows from a template literal: one row per non-empty line, surrounding whitespace removed. */
export function px(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

export const blank = (w: number, h: number): string[] => Array.from({ length: h }, () => '.'.repeat(w));

export function mirror(rows: Rows): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

/** Draw `top` over `base` at (dx, dy); '.' in top is transparent. */
export function overlay(base: Rows, top: Rows, dx = 0, dy = 0): string[] {
  const out = base.map((r) => [...r]);
  top.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]!;
      const ty = y + dy;
      const tx = x + dx;
      if (c !== '.' && ty >= 0 && ty < out.length && tx >= 0 && tx < out[ty]!.length) out[ty]![tx] = c;
    }
  });
  return out.map((r) => r.join(''));
}

/** Replace palette indices (e.g. { e: 'd' } turns skin sickly). */
export function recolor(rows: Rows, map: Readonly<Record<string, string>>, from = 0, to = rows.length): string[] {
  return rows.map((r, y) => (y >= from && y < to ? [...r].map((c) => map[c] ?? c).join('') : r));
}

/** Move the rows [from, to) down by n, leaving transparency behind (things above stay). */
export function shiftRows(rows: Rows, from: number, to: number, n: number): string[] {
  const out = [...rows];
  const w = rows[0]!.length;
  const band = rows.slice(from, to);
  for (let y = from; y < to; y++) out[y] = '.'.repeat(w);
  band.forEach((r, i) => {
    const y = from + i + n;
    if (y >= 0 && y < out.length) out[y] = overlay([out[y]!], [r])[0]!;
  });
  return out;
}

/** Grow (n > 0) or shrink (n < 0) each row in [from, to) symmetrically by n pixels per side. */
export function girth(rows: Rows, from: number, to: number, n: number): string[] {
  return rows.map((r, y) => {
    if (y < from || y >= to) return r;
    const chars = [...r];
    const first = chars.findIndex((c) => c !== '.');
    const last = chars.length - 1 - [...chars].reverse().findIndex((c) => c !== '.');
    if (first < 0) return r;
    for (let k = 0; k < Math.abs(n); k++) {
      if (n > 0) {
        const l = first - 1 - k;
        const rr = last + 1 + k;
        if (l >= 0) chars[l] = chars[first]!;
        if (rr < chars.length) chars[rr] = chars[last]!;
      } else {
        if (first + k <= last - k) {
          chars[first + k] = '.';
          chars[last - k] = '.';
        }
      }
    }
    return chars.join('');
  });
}

export function stack(...parts: Rows[]): string[] {
  return parts.flat();
}

/** Deterministic little hash for procedural texture (no Math.random anywhere). */
export function noise(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Build a w×h sprite by asking `f` for the palette char at each pixel. */
export function paint(w: number, h: number, f: (x: number, y: number) => string): string[] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)).join(''));
}

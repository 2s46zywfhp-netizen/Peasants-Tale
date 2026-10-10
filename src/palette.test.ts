import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE } from './render/palette';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('palette discipline', () => {
  it('uses no colour outside the palette in source, styles, HTML or manifest', () => {
    const files = [...walk('src'), 'index.html', 'public/manifest.webmanifest', 'scripts/gen-icons.mjs'].filter(
      (f) => /\.(ts|css|html|webmanifest|mjs)$/.test(f) && !f.endsWith('.test.ts'),
    );
    const allowed = new Set(PALETTE.map((c) => c.toLowerCase()));
    const bad: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g))
        if (!allowed.has(m[0].toLowerCase())) bad.push(`${f}: ${m[0]}`);
      for (const m of src.matchAll(/\b(rgba?|hsla?)\(/g)) bad.push(`${f}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
});

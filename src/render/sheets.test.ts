import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** Decode an 8-bit RGBA PNG (filters 0-4) without dependencies. */
function decode(buf: Buffer): { w: number; h: number; rgba: Uint8Array } {
  let p = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(w * h * 4);
  const stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? out[y * stride + i - 4]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0;
      const c = i >= 4 && y > 0 ? out[(y - 1) * stride + i - 4]! : 0;
      let v = raw[y * (stride + 1) + 1 + i]!;
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 255;
    }
  }
  return { w, h, rgba: out };
}

const DIR = join(process.cwd(), 'public', 'sprites');
const atlas = JSON.parse(readFileSync(join(DIR, 'atlas.json'), 'utf8')) as {
  palette: string[]; sheets: string[]; frames: Record<string, [number, number, number, number, number]>; anims: Record<string, { frames: string[]; ms: number }>;
};
const PALETTE_32 = [
  '#07080d', '#0b0d14', '#141a2e', '#1f2d4a', '#1d3d47', '#2e5a6b', '#3f8a8c', '#6cb5a8', '#a89f86', '#c9b99a', '#e8e0c4', '#f7f2df',
  '#4a5468', '#6b7689', '#8a9bb0', '#b4c0cf', '#3a1012', '#5c1a1a', '#8c2a2a', '#b8432f', '#d4622a', '#ec8f3a', '#f2c14e', '#fbe39a',
  '#2e2019', '#4a3326', '#6b4a32', '#8f6a46', '#1f3324', '#3d5a3a', '#5f7f4a', '#8aa65c',
];

describe('generated sprite sheets (acceptance 4: the 32-colour palette)', () => {
  it('the atlas carries exactly the 32 palette colours', () => {
    expect(atlas.palette).toEqual(PALETTE_32);
  });

  it('every pixel of every sheet is transparent or one of the 32 colours', () => {
    const allowed = new Set(PALETTE_32.map((h) => parseInt(h.slice(1), 16)));
    for (const sheet of atlas.sheets) {
      const { w, h, rgba } = decode(readFileSync(join(DIR, sheet)));
      let off = 0;
      for (let i = 0; i < w * h; i++) {
        const a = rgba[i * 4 + 3]!;
        if (a === 0) continue;
        if (a !== 255) off++;
        else if (!allowed.has((rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!)) off++;
      }
      expect(off, sheet).toBe(0);
    }
  });

  it('every frame lies inside its sheet, and every animation names real frames', () => {
    const sizes = atlas.sheets.map((s) => decode(readFileSync(join(DIR, s))));
    for (const [name, [si, x, y, w, h]] of Object.entries(atlas.frames)) {
      const s = sizes[si]!;
      expect(x + w <= s.w && y + h <= s.h, name).toBe(true);
    }
    for (const [name, a] of Object.entries(atlas.anims)) for (const f of a.frames) expect(atlas.frames[f], `${name} -> ${f}`).toBeDefined();
  });

  it('the peasant has every movement and work animation, with body-state and tool layers', () => {
    for (const d of ['down', 'up', 'side']) {
      expect(atlas.anims[`peasant.walk.${d}`]?.frames).toHaveLength(4);
      expect(atlas.anims[`peasant.run.${d}`]?.frames).toHaveLength(4);
      expect(atlas.anims[`peasant.idle.${d}`]?.frames).toHaveLength(2);
    }
    for (const w of ['chop', 'split', 'carry', 'stir', 'milk', 'sow', 'hoe', 'reap', 'flail', 'pray', 'sleep', 'eat']) expect(atlas.anims[`peasant.${w}`], w).toBeDefined();
    for (const l of ['girth1', 'girth2', 'gaunt', 'skeletal', 'sick', 'cold']) expect(atlas.frames[`peasant.walk.side.1@${l}`], l).toBeDefined();
    expect(atlas.frames['peasant.chop.0@tool']).toBeDefined();
    const [, , , w, h] = atlas.frames['peasant.walk.down.0']!;
    expect([w, h]).toEqual([16, 32]);
  });

  it('every other character, the livestock and the black dog have idle and a four-frame walk', () => {
    for (const who of ['wife', 'child', 'elder', 'priest', 'reeve', 'steward', 'lord', 'smith', 'shepherd', 'goodwife', 'maid', 'beggar']) {
      expect(atlas.anims[`${who}.idle.down`], who).toBeDefined();
      expect(atlas.anims[`${who}.walk.side`]?.frames, who).toHaveLength(4);
    }
    for (const b of ['hen', 'pig', 'cow', 'ox', 'dog']) {
      expect(atlas.anims[`${b}.idle`], b).toBeDefined();
      expect(atlas.anims[`${b}.walk`]?.frames, b).toHaveLength(4);
    }
  });

  it('terrain has variants and autotile fringes for every side and corner', () => {
    for (const t of ['grass', 'mud', 'path', 'cobble', 'snow']) {
      for (let v = 0; v < 4; v++) expect(atlas.frames[`t.${t}.${v}`], `${t}.${v}`).toBeDefined();
      for (const s of ['N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW']) expect(atlas.frames[`t.${t}.${s}`], `${t}.${s}`).toBeDefined();
    }
    expect(atlas.anims['t.water']?.frames).toHaveLength(4);
    expect(atlas.anims['t.water.moon']?.frames).toHaveLength(4);
  });
});

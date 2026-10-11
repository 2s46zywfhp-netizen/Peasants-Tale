// Builds every sprite and writes PNG sheets + a JSON atlas to /public/sprites.
// Run: node tools/spritegen/index.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { characters } from './characters.mjs';
import { objects } from './objects.mjs';
import { scenery } from './scenery.mjs';
import { tiles } from './tiles.mjs';
import { encodePng } from './png.mjs';
import { PALETTE, RAMPS, T, rgbOf } from './palette.mjs';

const OUT = join(process.cwd(), 'public', 'sprites');
const SHEET_W = 1024;

/** Shelf-pack frames (tallest first) into one sheet; returns placements and the sheet height. */
function pack(frames) {
  const order = [...frames].sort((a, b) => b.h - a.h || b.w - a.w);
  const place = new Map();
  let x = 0, y = 0, rowH = 0;
  for (const f of order) {
    if (x + f.w > SHEET_W) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    place.set(f.name, [x, y]);
    x += f.w + 1;
    rowH = Math.max(rowH, f.h);
  }
  return { place, h: y + rowH };
}

function writeSheet(name, frames, atlas, sheetIndex) {
  const { place, h } = pack(frames);
  const rgba = new Uint8Array(SHEET_W * h * 4);
  const rgb = PALETTE.map((_, i) => rgbOf(i));
  for (const f of frames) {
    const [ox, oy] = place.get(f.name);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const v = f.px[y * f.w + x];
        if (v === T) continue;
        if (v >= 32) throw new Error(`${f.name}: off-palette index ${v}`);
        const p = ((oy + y) * SHEET_W + ox + x) * 4;
        rgba[p] = rgb[v][0];
        rgba[p + 1] = rgb[v][1];
        rgba[p + 2] = rgb[v][2];
        rgba[p + 3] = 255;
      }
    if (atlas.frames[f.name]) throw new Error(`duplicate frame ${f.name}`);
    atlas.frames[f.name] = [sheetIndex, ox, oy, f.w, f.h];
  }
  writeFileSync(join(OUT, name), encodePng(SHEET_W, h, rgba));
  atlas.sheets.push(name);
}

mkdirSync(OUT, { recursive: true });
const atlas = { palette: PALETTE, ramps: RAMPS, sheets: [], frames: {}, anims: {}, meta: {} };
const groups = [
  ['characters.png', characters()],
  ['tiles.png', tiles()],
  ['objects.png', objects()],
  ['scenery.png', scenery()],
];
groups.forEach(([file, g], i) => {
  writeSheet(file, g.frames, atlas, i);
  Object.assign(atlas.anims, g.anims);
  Object.assign(atlas.meta, g.meta ?? {});
});
writeFileSync(join(OUT, 'atlas.json'), JSON.stringify(atlas));
console.log(`${Object.keys(atlas.frames).length} frames, ${Object.keys(atlas.anims).length} animations, ${atlas.sheets.length} sheets -> public/sprites`);

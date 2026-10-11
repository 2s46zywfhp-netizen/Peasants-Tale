import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { installAtlas, toIndices, type AtlasJson } from './atlas';
import { setGlyphs } from './font';

/* Test helpers: load the committed sprite sheets into the atlas without a browser. */

/** Decode an 8-bit RGBA PNG (filters 0-4) without dependencies. */
export function decode(buf: Buffer): { w: number; h: number; rgba: Uint8Array } {
  let p = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error('not 8-bit RGBA');
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

let loaded = false;
/** Loads public/sprites into the atlas (once), and a stand-in font so text draws something. */
export function loadTestAtlas(): AtlasJson {
  const dir = join(process.cwd(), 'public', 'sprites');
  const json = JSON.parse(readFileSync(join(dir, 'atlas.json'), 'utf8')) as AtlasJson;
  if (!loaded) {
    installAtlas(json, json.sheets.map((s) => {
      const { w, h, rgba } = decode(readFileSync(join(dir, s)));
      return { w, h, data: toIndices(rgba, w, h, s) };
    }));
    // Every glyph a solid block: enough to see where text lands.
    setGlyphs(new Uint8Array(95 * 8).fill(0xff));
    loaded = true;
  }
  return json;
}

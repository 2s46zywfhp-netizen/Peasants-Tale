import { PALETTE, hexToRgb, remapKey, type Remap } from './palette';
import { ANIMS, SPRITES } from './sprites';

/** All sprite frames packed into one palette-indexed atlas (255 = transparent). */
export interface Atlas {
  w: number;
  h: number;
  idx: Uint8Array;
  /** x, y, w, h per sprite number. */
  rects: Int16Array;
  ids: Map<string, number>;
  names: string[];
}

const ATLAS_W = 512;

export function buildAtlas(sprites: Readonly<Record<string, readonly string[]>>): Atlas {
  const names = Object.keys(sprites).sort((a, b) => sprites[b]!.length - sprites[a]!.length || a.localeCompare(b));
  const rects = new Int16Array(names.length * 4);
  let x = 0;
  let y = 0;
  let shelf = 0;
  names.forEach((n, i) => {
    const rows = sprites[n]!;
    const w = rows[0]!.length;
    const h = rows.length;
    if (x + w > ATLAS_W) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    rects.set([x, y, w, h], i * 4);
    x += w;
    shelf = Math.max(shelf, h);
  });
  const H = y + shelf;
  const idx = new Uint8Array(ATLAS_W * H).fill(255);
  names.forEach((n, i) => {
    const [rx, ry] = [rects[i * 4]!, rects[i * 4 + 1]!];
    sprites[n]!.forEach((row, sy) => {
      for (let sx = 0; sx < row.length; sx++) {
        const c = row[sx]!;
        if (c !== '.') idx[(ry + sy) * ATLAS_W + rx + sx] = parseInt(c, 16);
      }
    });
  });
  return { w: ATLAS_W, h: H, idx, rects, ids: new Map(names.map((n, i) => [n, i])), names };
}

const RGB = PALETTE.map(hexToRgb);

/** RGBA pixels for the atlas under a remap. */
export function atlasRgba(a: Atlas, remap: Remap): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(a.w * a.h * 4));
  for (let i = 0; i < a.idx.length; i++) {
    const v = a.idx[i]!;
    if (v === 255) continue;
    const rgb = RGB[remap[v]!]!;
    out[i * 4] = rgb[0];
    out[i * 4 + 1] = rgb[1];
    out[i * 4 + 2] = rgb[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}

export const ATLAS: Atlas = buildAtlas(SPRITES);

export function spriteId(name: string): number {
  const id = ATLAS.ids.get(name);
  if (id === undefined) throw new Error(`no sprite ${name}`);
  return id;
}

/** An animation resolved to sprite numbers, for allocation-free frame lookup. */
export interface Anim {
  ids: Int32Array;
  ms: number;
}

const animCache = new Map<string, Anim>();
export function anim(name: string): Anim {
  let a = animCache.get(name);
  if (!a) {
    const def = ANIMS[name];
    if (!def) throw new Error(`no animation ${name}`);
    a = { ids: Int32Array.from(def.frames.map(spriteId)), ms: def.ms };
    animCache.set(name, a);
  }
  return a;
}

export function frameAt(a: Anim, nowMs: number, offset = 0): number {
  return a.ids[Math.floor((nowMs + offset) / a.ms) % a.ids.length]!;
}

/* ── Browser side: one image per remap, cached ── */

export type Img = HTMLCanvasElement | ImageBitmap;
const images = new Map<string, Img>();
const MAX_IMAGES = 24;

function makeImage(remap: Remap, key: string): Img {
  const c = document.createElement('canvas');
  c.width = ATLAS.w;
  c.height = ATLAS.h;
  c.getContext('2d')!.putImageData(new ImageData(atlasRgba(ATLAS, remap), ATLAS.w, ATLAS.h), 0, 0);
  // Promote to an ImageBitmap (GPU-friendly) as soon as the browser has made one.
  if (typeof createImageBitmap === 'function') {
    void createImageBitmap(c).then((bmp) => {
      if (images.get(key) === c) images.set(key, bmp);
    });
  }
  return c;
}

/** The atlas image for a remap, built on first use and cached. */
export function atlasImage(remap: Remap): Img {
  const key = remapKey(remap);
  let img = images.get(key);
  if (!img) {
    if (images.size >= MAX_IMAGES) images.delete(images.keys().next().value!);
    img = makeImage(remap, key);
    images.set(key, img);
  }
  return img;
}

/** Like atlasImage, with the key precomputed (no string building per frame). Without a remap, only cached images are returned. */
export function atlasImageKeyed(remap: Remap, key: string): Img;
export function atlasImageKeyed(remap: null, key: string): Img | undefined;
export function atlasImageKeyed(remap: Remap | null, key: string): Img | undefined {
  const img = images.get(key);
  if (img || !remap) return img;
  if (images.size >= MAX_IMAGES) images.delete(images.keys().next().value!);
  const made = makeImage(remap, key);
  images.set(key, made);
  return made;
}

/** Converts the base atlas to an ImageBitmap at boot. */
export async function initSprites(identity: Remap): Promise<void> {
  const key = remapKey(identity);
  const c = makeImage(identity, key);
  images.set(key, typeof createImageBitmap === 'function' ? await createImageBitmap(c) : c);
}

export function drawSprite(ctx: CanvasRenderingContext2D, img: Img, id: number, x: number, y: number): void {
  const r = ATLAS.rects;
  const o = id * 4;
  ctx.drawImage(img, r[o]!, r[o + 1]!, r[o + 2]!, r[o + 3]!, x | 0, y | 0, r[o + 2]!, r[o + 3]!);
}

export function spriteSize(id: number): [number, number] {
  return [ATLAS.rects[id * 4 + 2]!, ATLAS.rects[id * 4 + 3]!];
}

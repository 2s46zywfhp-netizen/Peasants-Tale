import { NONE, W, H, pix } from './fb';
import { PALETTE } from './palette';

/** A sprite sheet as palette indices (NONE = transparent). */
interface Sheet {
  w: number;
  h: number;
  data: Uint8Array;
}

export interface AtlasJson {
  palette: string[];
  sheets: string[];
  frames: Record<string, [number, number, number, number, number]>;
  anims: Record<string, { frames: string[]; ms: number }>;
  meta: Record<string, unknown>;
}

export interface Anim {
  frames: Int32Array;
  ms: number;
}

let sheets: Sheet[] = [];
let names = new Map<string, number>();
let fSheet = new Int16Array(0);
let fX = new Int16Array(0);
let fY = new Int16Array(0);
let fW = new Int16Array(0);
let fH = new Int16Array(0);
let animsJson: AtlasJson['anims'] = {};
let metaJson: AtlasJson['meta'] = {};
const anims = new Map<string, Anim>();

/** Colour (0xRRGGBB) -> palette index. */
const INDEX = new Map(PALETTE.map((h, i) => [parseInt(h.slice(1), 16), i]));

/** Converts RGBA sheet pixels to palette indices. Any colour outside the palette is a hard error. */
export function toIndices(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, name = 'sheet'): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (rgba[i * 4 + 3]! < 128) {
      out[i] = NONE;
      continue;
    }
    const v = INDEX.get((rgba[i * 4]! << 16) | (rgba[i * 4 + 1]! << 8) | rgba[i * 4 + 2]!);
    if (v === undefined) throw new Error(`${name}: off-palette pixel at ${i % w},${(i / w) | 0}`);
    out[i] = v;
  }
  return out;
}

/** Installs a loaded atlas (used by the browser loader and by tests). */
export function installAtlas(json: AtlasJson, sheetData: { w: number; h: number; data: Uint8Array }[]): void {
  sheets = sheetData;
  const entries = Object.entries(json.frames);
  names = new Map(entries.map(([n], i) => [n, i]));
  fSheet = Int16Array.from(entries, ([, f]) => f[0]);
  fX = Int16Array.from(entries, ([, f]) => f[1]);
  fY = Int16Array.from(entries, ([, f]) => f[2]);
  fW = Int16Array.from(entries, ([, f]) => f[3]);
  fH = Int16Array.from(entries, ([, f]) => f[4]);
  animsJson = json.anims;
  metaJson = json.meta;
  anims.clear();
}

/** Loads /sprites/atlas.json and its sheets (browser). */
export async function loadSprites(base = '/sprites/'): Promise<AtlasJson> {
  const json = (await (await fetch(`${base}atlas.json`)).json()) as AtlasJson;
  const data = await Promise.all(
    json.sheets.map(async (s) => {
      const bmp = await createImageBitmap(await (await fetch(`${base}${s}`)).blob());
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(bmp, 0, 0);
      return { w: bmp.width, h: bmp.height, data: toIndices(g.getImageData(0, 0, bmp.width, bmp.height).data, bmp.width, bmp.height, s) };
    }),
  );
  installAtlas(json, data);
  return json;
}

export function spriteId(name: string): number {
  const id = names.get(name);
  if (id === undefined) throw new Error(`no sprite '${name}'`);
  return id;
}
export const hasSprite = (name: string): boolean => names.has(name);
export const spriteW = (id: number): number => fW[id]!;
export const spriteH = (id: number): number => fH[id]!;
export const spriteNames = (): string[] => [...names.keys()];
export const animNames = (): string[] => Object.keys(animsJson);
export const meta = <T>(key: string): T => metaJson[key] as T;

export function anim(name: string): Anim {
  let a = anims.get(name);
  if (!a) {
    const j = animsJson[name];
    if (!j) throw new Error(`no animation '${name}'`);
    a = { frames: Int32Array.from(j.frames, (f) => spriteId(f)), ms: j.ms };
    anims.set(name, a);
  }
  return a;
}
export const hasAnim = (name: string): boolean => name in animsJson;

/** The frame of `a` showing at time `now` (ms), offset to desynchronise identical animations. */
export function frameAt(a: Anim, now: number, offset = 0): number {
  return a.frames[(((now + offset) / a.ms) | 0) % a.frames.length]!;
}

/**
 * Draws sprite `id` with its top-left at (x, y): transparent pixels skipped, clipped to the frame.
 * `flip` mirrors it left-right. `remap` (optional) recolours indices.
 */
export function blit(id: number, x: number, y: number, flip = false, remap: Uint8Array | null = null): void {
  const s = sheets[fSheet[id]!]!;
  const sw = s.w, data = s.data;
  const w = fW[id]!, h = fH[id]!, sx = fX[id]!, sy = fY[id]!;
  x |= 0;
  y |= 0;
  const x0 = x < 0 ? -x : 0, y0 = y < 0 ? -y : 0;
  const x1 = x + w > W ? W - x : w, y1 = y + h > H ? H - y : h;
  for (let j = y0; j < y1; j++) {
    const src = (sy + j) * sw + sx;
    const dst = (y + j) * W + x;
    for (let i = x0; i < x1; i++) {
      const v = data[src + (flip ? w - 1 - i : i)]!;
      if (v !== NONE) pix[dst + i] = remap ? remap[v]! : v;
    }
  }
}

/** Draws a horizontal slice [u, u + w) of a sprite at (x, y) (parallax strips, 9-slice parts). */
export function blitPart(id: number, u: number, v: number, w: number, h: number, x: number, y: number): void {
  const s = sheets[fSheet[id]!]!;
  const sw = s.w, data = s.data;
  const sx = fX[id]! + u, sy = fY[id]! + v;
  x |= 0;
  y |= 0;
  for (let j = 0; j < h; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= H) continue;
    const src = (sy + j) * sw + sx;
    const dst = yy * W;
    for (let i = 0; i < w; i++) {
      const xx = x + i;
      if (xx < 0 || xx >= W) continue;
      const c = data[src + i]!;
      if (c !== NONE) pix[dst + xx] = c;
    }
  }
}

/* ── body-state, tool and carried-item layers ── */

/** Layers a frame may have, drawn over it in this order: `<frame>@<layer>` in the atlas. */
export const LAYERS = ['girth1', 'girth2', 'gaunt', 'skeletal', 'sick', 'cold', 'tool'] as const;
export type LayerName = (typeof LAYERS)[number];
export const LAYER_BIT: Readonly<Record<LayerName, number>> = { girth1: 1, girth2: 2, gaunt: 4, skeletal: 8, sick: 16, cold: 32, tool: 64 };
let layerIds = new Int32Array(0);
let layerFor = -1;

function buildLayers(): void {
  const n = fW.length;
  layerIds = new Int32Array(n * LAYERS.length).fill(-1);
  const byId = [...names.keys()];
  for (let id = 0; id < n; id++) {
    const base = byId[id]!;
    if (base.includes('@')) continue;
    for (let k = 0; k < LAYERS.length; k++) {
      const l = names.get(`${base}@${LAYERS[k]}`);
      if (l !== undefined) layerIds[id * LAYERS.length + k] = l;
    }
  }
  layerFor = n;
}

/** The layer sprite for frame `id`, or -1 if it has none. */
export function layerId(id: number, k: number): number {
  if (layerFor !== fW.length) buildLayers();
  return layerIds[id * LAYERS.length + k]!;
}

/** Draws a frame and, over it, the layers whose bits are set in `mask`. */
export function blitLayered(id: number, x: number, y: number, flip: boolean, mask: number, remap: Uint8Array | null = null): void {
  blit(id, x, y, flip, remap);
  if (!mask) return;
  for (let k = 0; k < LAYERS.length; k++) {
    if (!(mask & (1 << k))) continue;
    const l = layerId(id, k);
    if (l >= 0) blit(l, x, y, flip, remap);
  }
}

/** Per column of a sprite, the first opaque row from the top (or -1): where snow settles. */
const tops = new Map<number, Int16Array>();
export function topProfile(id: number): Int16Array {
  let t = tops.get(id);
  if (t) return t;
  const s = sheets[fSheet[id]!]!;
  const w = fW[id]!, h = fH[id]!;
  t = new Int16Array(w).fill(-1);
  for (let x = 0; x < w; x++)
    for (let y = 0; y < h; y++)
      if (s.data[(fY[id]! + y) * s.w + fX[id]! + x] !== NONE) {
        t[x] = y;
        break;
      }
  tops.set(id, t);
  return t;
}

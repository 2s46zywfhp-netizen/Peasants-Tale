import { PLAGUE_YEARS, REAL_DAY_MS, BLOCKS_PER_REAL_DAY } from '../sim/balance';
import { dayInfo, type Season } from '../sim/calendar';
import { Rng } from '../sim/rng';
import type { SimState } from '../sim/sim';
import { weatherFor, type Weather } from '../sim/weather';
import { anim, atlasImageKeyed, drawSprite, frameAt, spriteId, spriteSize, type Anim } from './atlas';
import { cameraX, darknessOf, drawCottage } from './cottage';
import { ditherFill, rect } from './draw';
import { drawText } from './font';
import { C, dmgOn, hex, remapKey, setRemap, useUiRemap, worldRemap, type Ci, type Remap } from './palette';
import { SCENES, TILE, COLS, originY, type SceneDef, type SceneId } from './scenes/maps';
import { drawWeather, setWeather } from './weather';

/** Something standing in the world. The UI owns and reuses these objects; the renderer only reads them. */
export interface Actor {
  anim: Anim;
  x: number;
  y: number;
  /** Desynchronises identical animations. */
  offset: number;
  /** Glowing eyes (the black dog) at this offset inside the sprite, or -1. */
  eyeX: number;
  eyeY: number;
  visible: boolean;
}

export interface WorldView {
  scene: SceneDef;
  /** Player position (sprite top-left) for parallax. */
  px: number;
  /** All actors including the player; drawn in y order. */
  actors: Actor[];
  /** Short text at the bottom right (what A would do here). */
  prompt: string;
}

/** Sorts actors by y in place (insertion sort: no allocation). */
function sortActors(act: Actor[]): void {
  for (let i = 1; i < act.length; i++) {
    const v = act[i]!;
    let j = i - 1;
    while (j >= 0 && act[j]!.y > v.y) {
      act[j + 1] = act[j]!;
      j--;
    }
    act[j + 1] = v;
  }
}

/* ── remaps, indexed numerically so the frame loop never builds strings ── */

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const remaps: ({ r: Remap; key: string } | undefined)[] = [];

function slot(season: Season, plague: boolean, bod: number, dmg: boolean, lit: boolean): { r: Remap; key: string } {
  const i = (((SEASONS.indexOf(season) * 2 + (plague ? 1 : 0)) * 6 + bod) * 2 + (dmg ? 1 : 0)) * 2 + (lit ? 1 : 0);
  let s = remaps[i];
  if (!s) {
    const r = worldRemap(season, plague, bod, dmg, lit);
    s = { r, key: remapKey(r) };
    remaps[i] = s;
  }
  return s;
}

export function isPlagueYear(year: number): boolean {
  return PLAGUE_YEARS.includes(year);
}

/* ── compiled scenes: sprite numbers per tile ── */

interface Compiled {
  ids: Int32Array;
  anims: (Anim | null)[];
  fields: Int8Array;
  lights: { x: number; y: number; glow: number; tile: number }[];
}
const compiled = new Map<SceneId, Compiled>();

function compile(s: SceneDef): Compiled {
  let c = compiled.get(s.id);
  if (c) return c;
  const n = s.rows.length * COLS;
  c = { ids: new Int32Array(n).fill(-1), anims: new Array<Anim | null>(n).fill(null), fields: new Int8Array(n).fill(-1), lights: [] };
  const oy = originY(s);
  for (let r = 0; r < s.rows.length; r++) {
    for (let col = 0; col < COLS; col++) {
      const t = s.legend[s.rows[r]![col]!]!;
      const i = r * COLS + col;
      if (t.sprite.startsWith('anim:')) c.anims[i] = anim(t.sprite.slice(5));
      else c.ids[i] = spriteId(t.sprite);
      if (t.field !== undefined) c.fields[i] = t.field;
      if (t.light) {
        const glow = spriteId(`glow.${t.light}`);
        const [gw, gh] = spriteSize(glow);
        c.lights.push({ x: col * TILE + 8 - (gw >> 1), y: oy + r * TILE + 8 - (gh >> 1), glow, tile: i });
      }
    }
  }
  compiled.set(s.id, c);
  return c;
}

const CROP = {
  fallow: () => spriteId('tile.grass'),
  unsown: () => spriteId('tile.soil'),
  sprout: () => spriteId('tile.crop.sprout'),
  growing: () => spriteId('tile.crop.growing'),
  ripe: () => spriteId('tile.crop.ripe'),
  stubble: () => spriteId('tile.crop.stubble'),
};
let cropIds: Record<keyof typeof CROP, number> | null = null;

function fieldSprite(s: SimState, n: number): number {
  cropIds ??= { fallow: CROP.fallow(), unsown: CROP.unsown(), sprout: CROP.sprout(), growing: CROP.growing(), ripe: CROP.ripe(), stubble: CROP.stubble() };
  const f = s.fields[n];
  if (!f || f.acres === 0) return cropIds.fallow;
  switch (f.stage) {
    case 'fallow': return cropIds.fallow;
    case 'unsown': return cropIds.unsown;
    case 'growing': return f.weatherDays < 45 ? cropIds.sprout : cropIds.growing;
    case 'ripe': return cropIds.ripe;
    case 'harvested': return cropIds.stubble;
  }
}

/* ── sky ── */

const SKY_BANDS: readonly (readonly [Ci, Ci, Ci])[] = [
  [C.navy, C.gore, C.ember], // dawn
  [C.teal, C.sea, C.sea], // morning
  [C.sea, C.sea, C.mist], // midday
  [C.teal, C.sea, C.parchment], // afternoon
  [C.night, C.gore, C.ember], // dusk: ember-red skies
  [C.black, C.night, C.navy], // night
];
const skyCache = new Map<string, (HTMLCanvasElement | undefined)[]>();

function skyCanvas(bod: number, lit: { r: Remap; key: string }): HTMLCanvasElement {
  let byBlock = skyCache.get(lit.key);
  if (!byBlock) {
    byBlock = [];
    skyCache.set(lit.key, byBlock);
  }
  let c = byBlock[bod];
  if (!c) {
    c = document.createElement('canvas');
    c.width = 160;
    c.height = 40;
    const g = c.getContext('2d')!;
    setRemap(lit.r);
    const [a, b, d] = SKY_BANDS[bod]!;
    rect(g, 0, 0, 160, 40, a);
    ditherFill(g, 0.5, b, 0, 10, 160, 4);
    rect(g, 0, 14, 160, 12, b);
    ditherFill(g, 0.5, d, 0, 24, 160, 4);
    rect(g, 0, 28, 160, 12, d);
    byBlock[bod] = c;
  }
  return c;
}

const STARS = (() => {
  const r = new Rng(1345);
  const a = new Int16Array(60);
  for (let i = 0; i < 60; i += 2) {
    a[i] = Math.floor(r.next() * 160);
    a[i + 1] = Math.floor(r.next() * 26);
  }
  return a;
})();

const MOON_X = [128, 0, 0, 0, 24, 76];
let moonIds: Int32Array | null = null;
let skyIds: { sil: number; tree: number; cloud0: number; cloud1: number; fog: number } | null = null;

function drawSky(ctx: CanvasRenderingContext2D, bod: number, moonPhase: number, worldKey: string, lit: { r: Remap; key: string }, px: number, now: number): void {
  moonIds ??= Int32Array.from({ length: 8 }, (_, p) => spriteId(`moon.${p}`));
  skyIds ??= { sil: spriteId('sky.silhouette'), tree: spriteId('sky.treeline'), cloud0: spriteId('sky.clouds.0'), cloud1: spriteId('sky.clouds.1'), fog: spriteId('sky.fog') };
  ctx.drawImage(skyCanvas(bod, lit), 0, 0);
  const litImg = atlasImageKeyed(lit.r, lit.key);
  const worldImg = atlasImageKeyed(null, worldKey);
  if (!worldImg) return;
  // Layer 1: stars and the moon (calendar-synced phase).
  if (bod === 5 || bod === 0 || bod === 4) {
    setRemap(lit.r);
    ctx.fillStyle = hex(C.bone);
    const tw = now >> 9;
    for (let i = 0; i < STARS.length; i += 2) if (bod === 5 || i % 4 === 0) if ((i + tw) % 11 !== 0) ctx.fillRect(STARS[i]!, STARS[i + 1]!, 1, 1);
    drawSprite(ctx, litImg, moonIds[moonPhase]!, MOON_X[bod]! - ((px * 6) >> 7), 5);
  }
  // Layer 2: cloud bands drifting. Integer maths throughout: no doubles in the frame loop.
  const c0 = (((now * 3) >> 10) + ((px * 13) >> 7)) % 48;
  const c1 = (((now * 3) >> 11) + ((px * 8) >> 7)) % 48;
  // 0 - c, not -c: -0 is not a small integer and would turn x into a boxed double.
  for (let x = 0 - c1; x < 160; x += 48) drawSprite(ctx, worldImg, skyIds.cloud1, x, 2);
  for (let x = 0 - c0; x < 160; x += 48) drawSprite(ctx, worldImg, skyIds.cloud0, x, 11);
  // Layer 3: castle and church on the horizon.
  drawSprite(ctx, litImg, skyIds.sil, 60 - ((px * 19) >> 7), 18);
  // Layer 4: the treeline.
  const t = ((px * 45) >> 7) & 31;
  for (let x = 0 - t; x < 160; x += 32) drawSprite(ctx, worldImg, skyIds.tree, x, 30);
}

/* ── HUD strings, rebuilt only when they change ── */

const BLOCK_SHORT = ['DAWN', 'MORN', 'NOON', 'AFTN', 'DUSK', 'NGHT'] as const;
let hudSecond = -1;
let hudBod = -1;
let hudText = '';
let hudCheckAt = 0;

function hud(ctx: CanvasRenderingContext2D, s: SimState, bod: number, now: number, view: WorldView): void {
  useUiRemap();
  rect(ctx, 0, 136, 160, 8, C.black);
  // The wall clock is read once a second (when the shown second changes), not every frame.
  if (now >= hudCheckAt || bod !== hudBod) hudCheckAt = now + refreshCountdown(s, bod);
  drawText(ctx, hudText, 0, 136, C.gold);
  if (view.prompt) drawText(ctx, view.prompt, 160 - view.prompt.length * 8, 136, C.bone);
  if (!view.scene.outdoor) {
    rect(ctx, 0, 0, 160, 8, C.black);
    drawText(ctx, view.scene.name, 0, 0, C.parchment);
  }
}

/** Rebuilds the countdown text; returns ms until the displayed second changes. */
function refreshCountdown(s: SimState, bod: number): number {
  const end = s.anchorMs + ((s.block + 1) * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
  const left = Math.max(0, end - Date.now());
  const secs = Math.floor(left / 1000);
  if (secs !== hudSecond || bod !== hudBod) {
    hudSecond = secs;
    hudBod = bod;
    const m = Math.floor(secs / 60);
    const sec = secs % 60;
    hudText = `${BLOCK_SHORT[bod]} ${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  }
  return Math.max(16, Math.ceil(left - secs * 1000) + 1);
}

/* ── the frame ── */

let weatherDay = -1;
let weather: Weather | null = null;
/** Called once per new game day drawn (the UI uses it for test probes). */
let onDayChange: ((day: number, sky: string, moon: number, season: string) => void) | null = null;
export function setDayListener(fn: typeof onDayChange): void {
  onDayChange = fn;
}

/** Draw the world for the sim state at `now`. Reads sim state and the view only. */
export function drawWorld(ctx: CanvasRenderingContext2D, s: SimState, view: WorldView, now: number): void {
  const day = (s.block / 6) | 0;
  const bod = s.block % 6;
  const info = dayInfo(day);
  if (day !== weatherDay) {
    weatherDay = day;
    weather = weatherFor(s.seed, day);
    onDayChange?.(day, weather.sky, info.moon, info.season);
  }
  const plague = isPlagueYear(info.year);
  const dmg = dmgOn();
  const world = slot(info.season, plague, bod, dmg, false);
  const lit = slot(info.season, plague, bod, dmg, true);
  const img = atlasImageKeyed(world.r, world.key);
  const litImg = atlasImageKeyed(lit.r, lit.key);
  const scene = view.scene;
  setWeather(weather!.sky, info.season, scene.outdoor);

  // A side-view interior: the room pans with the peasant; people by the fire are firelit, the rest in the dark.
  if (scene.side) {
    const cam = cameraX(view.px);
    drawCottage(ctx, s, cam, bod, weather!.sky, dmg, now);
    const act = view.actors;
    sortActors(act);
    const night = darknessOf(bod) === 2;
    for (let i = 0; i < act.length; i++) {
      const a = act[i]!;
      if (!a.visible) continue;
      drawSprite(ctx, night && a.x > 90 && a.x < 160 ? img : litImg, frameAt(a.anim, now, a.offset), a.x - cam, a.y);
    }
    hud(ctx, s, bod, now, view);
    return;
  }

  setRemap(world.r);
  if (scene.outdoor) drawSky(ctx, bod, info.moon, world.key, lit, view.px, now);
  else rect(ctx, 0, 0, 160, 144, C.black);

  // Tiles.
  const c = compile(scene);
  const oy = originY(scene);
  const rows = scene.rows.length;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < COLS; col++) {
      const i = r * COLS + col;
      const a = c.anims[i];
      const id = c.fields[i]! >= 0 ? fieldSprite(s, c.fields[i]!) : a ? frameAt(a, now, i * 97) : c.ids[i]!;
      drawSprite(ctx, img, id, col * TILE, oy + r * TILE);
    }
  }

  // Firelight: indoors always, outdoors from dusk to dawn. The light sources themselves are drawn unlit by the night.
  const dark = bod >= 4 || bod === 0;
  if (!scene.outdoor || dark) {
    for (let k = 0; k < c.lights.length; k++) {
      const L = c.lights[k]!;
      const ti = L.tile;
      const a = c.anims[ti];
      drawSprite(ctx, litImg, a ? frameAt(a, now, ti * 97) : c.ids[ti]!, (ti % COLS) * TILE, oy + ((ti / COLS) | 0) * TILE);
      const flick = (now >> 7) % 3 === 0 ? 1 : 0;
      drawSprite(ctx, litImg, L.glow, L.x + flick, L.y);
    }
  }

  // Actors in depth order.
  const act = view.actors;
  sortActors(act);
  setRemap(lit.r);
  const ember = hex(C.ember);
  for (let i = 0; i < act.length; i++) {
    const a = act[i]!;
    if (!a.visible) continue;
    drawSprite(ctx, img, frameAt(a.anim, now, a.offset), a.x, a.y);
    if (a.eyeX >= 0) {
      ctx.fillStyle = ember;
      ctx.fillRect((a.x | 0) + a.eyeX, (a.y | 0) + a.eyeY, 1, 1);
    }
  }

  // Fog drifting over the ground (fog days, and every dawn outdoors).
  if (scene.outdoor && (weather!.sky === 'fog' || bod === 0)) {
    const off = ((now >> 7) + (view.px >> 1)) & 63;
    const y0 = weather!.sky === 'fog' ? 56 : 104;
    for (let y = y0; y < 136; y += 32) for (let x = 0 - off; x < 160; x += 64) drawSprite(ctx, img, skyIds!.fog, x, y);
  }

  setRemap(world.r);
  drawWeather(ctx);
  hud(ctx, s, bod, now, view);
}

export { SCENES };

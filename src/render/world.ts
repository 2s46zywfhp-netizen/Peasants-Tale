import { BLOCKS_PER_REAL_DAY, REAL_DAY_MS } from '../sim/balance';
import { dayInfo } from '../sim/calendar';
import { plagueTint } from '../sim/plague';
import { hearthOf, type SimState } from '../sim/sim';
import { weatherFor, type Weather } from '../sim/weather';
import { anim, blit, blitLayered, frameAt, hasAnim, meta, spriteH, spriteId, spriteW, topProfile, type Anim } from './atlas';
import { darkPanel, bubble, rect } from './draw';
import { H, LOCK, LOCKED, W, addLight, ambientRemap, ambientSteps, bayer, dither, finishWorld, haze, pix, plot, resetLight } from './fb';
import { GLYPH, drawText, drawTextRight } from './font';
import { AMBIENT, C, FOG_LUT, LIGHTER, type SeasonName } from './palette';
import { COLS, GROUND_H, GROUND_ROWS, GROUND_Y, PRIORITY, TERRAIN_OF, TILE, terrainAt, type Obj, type SceneDef, type SceneId, type Terrain } from './scenes/maps';
import { drawSky, moonScreenX } from './sky';
import { drawWeather, lightning, setWeather, snowCover, windFor } from './weather';

/* ───────────── what the UI hands the renderer ───────────── */

/** Something standing in the world. The UI owns and reuses these; the renderer only reads them. */
export interface Actor {
  anim: Anim;
  /** Feet: x centre, y base (ground y outdoors, room y in a room). */
  x: number;
  y: number;
  flip: boolean;
  /** Layer bits (atlas LAYER_BIT): body state, tool. */
  layers: number;
  /** Desynchronises identical animations. */
  offset: number;
  visible: boolean;
  /** Glowing eyes (the black dog). */
  eyes: boolean;
  /** The player: a little light of their own outdoors so they always read against the ground. */
  glow?: boolean;
}

export interface WorldView {
  scene: SceneDef;
  /** Camera x (fractional; eased by the UI). */
  cam: number;
  actors: Actor[];
  /** Floating prompt ("A: CHOP") above the world point (promptX, promptY); '' for none. */
  prompt: string;
  promptX: number;
  promptY: number;
  /** Pending needs, pulsing in the HUD: icon names. */
  needs: string[];
  /** Belt tool icon and the number of tasks queued. */
  belt: string;
  queued: number;
  /** A line of text over the HUD (what just happened), '' for none. */
  message: string;
}

/** Screen height of the HUD strip at the bottom. */
export const HUD_Y = GROUND_Y + GROUND_H;
/** Rooms are drawn from this screen y. */
export const ROOM_Y = 16;

export interface RoomMeta {
  w: number;
  h: number;
  floor: number;
  glass?: { x: number; y: number; w: number; h: number };
  fire?: { x: number; y: number };
  candle?: { x: number; y: number };
  candles?: { x: number; y: number }[];
  windows?: { x: number; y: number }[];
  door: { x: number; w: number };
  spots: { x0: number; x1: number; label: string }[];
  bed?: { x: number; y: number };
}
export const roomMeta = (room: 'cottage' | 'church'): RoomMeta => meta<Record<string, RoomMeta>>('rooms')[room]!;

/* ───────────── the day: weather, plague, snow, wind ───────────── */

export interface Day {
  day: number;
  bod: number;
  season: SeasonName;
  weather: Weather;
  plague: boolean;
  moon: number;
  snow: number;
  wind: number;
  /** Wind x 64, as an integer (for the frame loop). */
  windQ: number;
}
const today: Day = { day: -1, bod: 0, season: 'spring', weather: { tempC: 10, sky: 'fair', cropQuality: 0, morale: 0 }, plague: false, moon: 0, snow: 0, wind: 0, windQ: 0 };
let todaySeed = -1;
let onDayChange: ((d: Day) => void) | null = null;
/** Called once per new game day drawn (the UI uses it for test probes). */
export function setDayListener(fn: typeof onDayChange): void {
  onDayChange = fn;
}

/** The day's look, recomputed only when the day changes. */
export function dayOf(s: SimState): Day {
  const day = (s.block / 6) | 0;
  today.bod = s.block % 6;
  today.plague = plagueTint(s);
  if (day !== today.day || s.seed !== todaySeed) {
    const info = dayInfo(day);
    today.day = day;
    todaySeed = s.seed;
    today.season = info.season;
    today.weather = weatherFor(s.seed, day);
    today.moon = info.moon;
    today.snow = info.season === 'winter' || info.season === 'autumn' || info.season === 'spring' ? snowCover(s.seed, day) : 0;
    today.wind = windFor(s.seed, day, today.weather.sky);
    today.windQ = Math.round(today.wind * 64);
    onDayChange?.(today);
  }
  return today;
}

/* ───────────── compiled scenes: tiles, fringes, tufts ───────────── */

const SIDES = ['N', 'E', 'S', 'W', 'NE', 'NW', 'SE', 'SW'] as const;
const NEIGH = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]] as const;
const MAXF = 8;

interface Compiled {
  /** Base tile sprite per tile (-1: water or a field, drawn live). */
  base: Int32Array;
  /** Up to MAXF fringe overlays per tile (-1 = none). */
  fringe: Int32Array;
  /** Field index per tile (0..2), 3 = the lord's demesne, -1 none. */
  field: Int8Array;
  water: Uint8Array;
  /** Grass tufts: x, y (ground), phase. */
  tufts: Int16Array;
  /** Objects' sprite or animation. */
  objSprite: Int32Array;
  objAnim: (Anim | null)[];
  objLit: Int32Array;
}
/** Per scene: [plain, snowy]. */
const compiled = new Map<SceneDef, [Compiled | null, Compiled | null]>();
let lastSc: SceneDef | null = null;
let lastSnowy = false;
let lastC: Compiled | null = null;

const hash = (x: number, y: number, s: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

function terrainOf(sc: SceneDef, c: number, r: number, snowy: boolean): Terrain | null {
  const ch = terrainAt(sc, c, r);
  if (!ch) return null;
  const t = TERRAIN_OF[ch]!;
  if (snowy && (t === 'grass' || t === 'mud' || t === 'path')) return 'snow' as Terrain;
  return t;
}
const prio = (t: Terrain | 'snow'): number => (t === 'snow' ? 5 : PRIORITY[t as Terrain]);

/** Compiles a scene's terrain to sprite numbers, with autotiled fringes (once per scene and snow state). */
export function compile(sc: SceneDef, snowy: boolean): Compiled {
  let pair = compiled.get(sc);
  if (!pair) compiled.set(sc, (pair = [null, null]));
  let c = pair[snowy ? 1 : 0];
  if (c) {
    lastSc = sc;
    lastSnowy = snowy;
    lastC = c;
    return c;
  }
  const n = COLS * GROUND_ROWS;
  c = {
    base: new Int32Array(n).fill(-1), fringe: new Int32Array(n * MAXF).fill(-1), field: new Int8Array(n).fill(-1), water: new Uint8Array(n),
    tufts: new Int16Array(0), objSprite: new Int32Array(sc.objs.length), objAnim: [], objLit: new Int32Array(sc.objs.length).fill(-1),
  };
  const tufts: number[] = [];
  for (let r = 0; r < GROUND_ROWS; r++)
    for (let col = 0; col < COLS; col++) {
      const i = r * COLS + col;
      const ch = terrainAt(sc, col, r);
      const t = terrainOf(sc, col, r, snowy)!;
      if (ch >= '1' && ch <= '3') c.field[i] = ch.charCodeAt(0) - 49;
      else if (ch === 'd') c.field[i] = 3;
      if (t === 'water') c.water[i] = 1;
      else if (c.field[i]! < 0) c.base[i] = spriteId(`t.${t}.${t === 'soil' ? 0 : Math.floor(hash(col, r, 3) * 4)}`);
      // Fringes: each higher neighbour spills over this tile's edge or corner.
      let k = 0;
      for (let d = 0; d < 8 && k < MAXF; d++) {
        const nt = terrainOf(sc, col + NEIGH[d]![0], r + NEIGH[d]![1], snowy);
        if (!nt || nt === 'water' || prio(nt) <= prio(t)) continue;
        // A corner only when neither of its edges already spills the same terrain.
        if (d >= 4) {
          const ex = terrainOf(sc, col + NEIGH[d]![0], r, snowy), ey = terrainOf(sc, col, r + NEIGH[d]![1], snowy);
          if (ex === nt || ey === nt) continue;
        }
        c.fringe[i * MAXF + k++] = spriteId(`t.${nt}.${SIDES[d]}`);
      }
      if (t === 'grass' && hash(col, r, 9) < 0.55) tufts.push(col * TILE + 2 + Math.floor(hash(col, r, 10) * 12), r * TILE + 4 + Math.floor(hash(col, r, 11) * 11), Math.floor(hash(col, r, 12) * 64));
    }
  c.tufts = Int16Array.from(tufts);
  sc.objs.forEach((o, i) => {
    if (hasAnim(o.s)) {
      c!.objAnim[i] = anim(o.s);
      c!.objSprite[i] = c!.objAnim[i]!.frames[0]!;
    } else {
      c!.objAnim[i] = null;
      c!.objSprite[i] = spriteId(o.s);
    }
    if (o.lit) c!.objLit[i] = spriteId(o.lit);
  });
  pair[snowy ? 1 : 0] = c;
  lastSc = sc;
  lastSnowy = snowy;
  lastC = c;
  return c;
}

let cropIds: Int32Array | null = null;
/** Crop tiles: soil, sprout, growing, ripe, stubble, fallow (grass). */
function crops(): Int32Array {
  return (cropIds ??= Int32Array.from(['t.soil.0', 't.crop.sprout', 't.crop.growing', 't.crop.ripe', 't.crop.stubble', 't.grass.1'], (n) => spriteId(n)));
}

function fieldTile(s: SimState, n: number, season: SeasonName): number {
  const k = crops();
  if (n === 3) return season === 'winter' ? k[0]! : season === 'spring' ? k[1]! : season === 'summer' ? k[3]! : k[4]!;
  const f = s.fields[n];
  if (!f || f.acres === 0) return k[5]!;
  switch (f.stage) {
    case 'fallow': return k[5]!;
    case 'unsown': return k[0]!;
    case 'growing': return f.weatherDays < 45 ? k[1]! : k[2]!;
    case 'ripe': return k[3]!;
    case 'harvested': return k[4]!;
  }
}

/* ───────────── small life: smoke, sparks, fireflies, tufts ───────────── */

/** sin in 64 steps, scaled to ±64: integer maths in the frame loop (no boxed doubles). */
const SIN = Int8Array.from({ length: 64 }, (_, i) => Math.round(Math.sin((i / 64) * Math.PI * 2) * 64));

/** Woodsmoke from a chimney at screen (x, y), leaning with the wind (windQ: wind x 64), puffs growing as they rise. */
function smoke(x: number, y: number, windQ: number, now: number, seed: number): void {
  for (let p = 0; p < 7; p++) {
    const t = (((now / 70) | 0) + p * 9 + seed * 5) % 60;
    if (t > 52) continue;
    const lean = (t * (16 + ((windQ * 58) >> 6))) >> 6;
    const wob = SIN[(t * 2 + seed) & 63]! >> 5;
    const px = x + lean + wob;
    const py = y - (t >> 1) - 1;
    const size = t < 10 ? 2 : t < 30 ? 3 : 4;
    const v = t < 18 ? C.mist : t < 36 ? C.stone : C.slate;
    // A ragged puff: a dithered disc.
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) if (t < 36 || bayer(px + dx, py + dy) < 10) plot(px + dx, py + dy, v);
  }
}

/** Sparks rising from a fire at screen (x, y). Locked colours: they glow in any dark. */
function sparks(x: number, y: number, now: number, n: number): void {
  for (let p = 0; p < n; p++) {
    const life = 900 + p * 137;
    const t = (now + p * 401) % life;
    const k = ((t * 64) / life) | 0; // 0..63
    const sx = x + ((SIN[(p * 11 + (t >> 6)) & 63]! * (3 + ((k * 6) >> 6))) >> 6) + ((p * 7) % 9) - 4;
    const sy = y - ((k * 46) >> 6);
    plot(sx, sy, (k < 32 ? C.spark : k < 51 ? C.flame : C.ember) | LOCK);
  }
}

const FLIES = (() => {
  const a = new Int16Array(60);
  for (let i = 0; i < 60; i += 3) {
    a[i] = Math.floor(hash(i, 1, 77) * 512);
    a[i + 1] = 10 + Math.floor(hash(i, 2, 77) * 120);
    a[i + 2] = Math.floor(hash(i, 3, 77) * 64);
  }
  return a;
})();

function fireflies(cam: number, now: number): void {
  for (let i = 0; i < FLIES.length; i += 3) {
    const ph = FLIES[i + 2]!;
    const x = FLIES[i]! + ((SIN[((now >> 6) + ph) & 63]! * 14) >> 6) - cam;
    if (x < 0 || x >= W) continue;
    const y = GROUND_Y + FLIES[i + 1]! + (SIN[((now >> 5) + ph * 3) & 63]! >> 4);
    const blink = ((now >> 8) + ph) % 7;
    if (blink === 0) continue;
    plot(x, y, (blink < 3 ? C.spark : C.gold) | LOCK);
    if (blink === 3) addLight(x, y, 6, 12, true);
  }
}

/** Grass blades that bend with the wind (windQ: wind x 64). */
function drawTufts(t: Int16Array, cam: number, windQ: number, now: number): void {
  const gust = 26 + (windQ < 0 ? -windQ : windQ);
  for (let i = 0; i < t.length; i += 3) {
    const x = t[i]! - cam;
    if (x < -2 || x > W + 2) continue;
    const y = GROUND_Y + t[i + 1]!;
    // Sway in 1/64 px.
    const sway = ((windQ * 102) >> 6) + ((SIN[(((now / 90) | 0) + t[i + 2]!) & 63]! * gust) >> 6);
    plot(x, y, C.moss);
    plot(x + (sway >> 7), y - 1, C.grass);
    plot(x + (sway >> 6), y - 2, C.leaf);
    plot(x + 2, y, C.moss);
    plot(x + 2 + ((sway * 45) >> 12), y - 1, C.grass);
  }
}

/* ───────────── depth-sorted drawing of objects and actors ───────────── */

const order = new Int32Array(512);
const keys = new Int32Array(512);

function sortDraw(n: number): void {
  for (let i = 1; i < n; i++) {
    const k = keys[i]!, o = order[i]!;
    let j = i - 1;
    while (j >= 0 && keys[j]! > k) {
      keys[j + 1] = keys[j]!;
      order[j + 1] = order[j]!;
      j--;
    }
    keys[j + 1] = k;
    order[j + 1] = o;
  }
}

/** The player's colours outdoors: the hour's look one step lighter than the dark around them, locked. */
let playerRemap: Uint8Array | null = null;

function drawActor(a: Actor, cam: number, oy: number, now: number, night: boolean): void {
  const id = frameAt(a.anim, now, a.offset);
  const w = spriteW(id), h = spriteH(id);
  const x = Math.round(a.x - cam) - (w >> 1);
  const y = Math.round(oy + a.y) - h;
  // A soft shadow at the feet.
  dither(x + (w >> 1) - 5, y + h - 2, 10, 2, C.ink, 8);
  blitLayered(id, x, y, a.flip, a.layers, a.glow ? playerRemap : null);
  if (a.eyes && night) {
    const ex = a.flip ? x + 4 : x + w - 6;
    plot(ex, y + 5, C.ember | LOCK);
    plot(ex + 2, y + 5, C.ember | LOCK);
  }
}

/** Snow lying on a sprite's top edge, `depth` pixels. */
function snowCap(id: number, x: number, y: number, depth: number): void {
  const t = topProfile(id);
  for (let i = 0; i < t.length; i++) {
    const top = t[i]!;
    if (top < 0) continue;
    // Only where the top is flat enough to hold snow.
    const l = t[i - 1] ?? top, r = t[i + 1] ?? top;
    if (Math.abs(l - top) > 2 && Math.abs(r - top) > 2) continue;
    for (let d = 0; d < depth; d++) plot(x + i, y + top + d, d === depth - 1 && bayer(x + i, y + top + d) < 8 ? C.frost : C.moon);
  }
}

/* ───────────── things that want seeing to pulse ───────────── */

const PULSE_MAX = 8;
const pulseRects = new Int16Array(PULSE_MAX * 4);
let pulseN = 0;
function wantPulse(x: number, y: number, w: number, h: number): void {
  if (pulseN >= PULSE_MAX) return;
  const k = pulseN++ * 4;
  pulseRects[k] = x;
  pulseRects[k + 1] = y;
  pulseRects[k + 2] = w;
  pulseRects[k + 3] = h;
}
/** A slow glow over each (after lighting, so it shows in the dark too). */
function drawPulses(now: number): void {
  const ph = (now % 1400) / 700;
  const amt = Math.round((ph < 1 ? ph : 2 - ph) * 7);
  if (amt > 0) for (let i = 0; i < pulseN; i++) haze(pulseRects[i * 4]!, pulseRects[i * 4 + 1]!, pulseRects[i * 4 + 2]!, pulseRects[i * 4 + 3]!, LIGHTER, amt);
  pulseN = 0;
}

/** Does this object want seeing to? Hens and the pig with nothing to eat; the woodpile when the fire is dying. */
function needsCare(s: SimState, o: Obj): boolean {
  const w = s.wealth;
  if (o.s === 'o.coop') return w.hens > 0 && w.grain < 1;
  if (o.s === 'o.sty') return w.pig > 0 && w.grain < 1 && w.pottage < 1;
  if (o.s === 'o.woodpile') return w.firewood <= FIRE_LOW;
  return false;
}
/** Firewood at or below this: the hearth is dying (it pulses, as does the woodpile). */
const FIRE_LOW = 2;

/* ───────────── outdoors ───────────── */

let lanternId = -1;

function drawOutdoor(s: SimState, view: WorldView, d: Day, now: number): void {
  const sc = view.scene;
  const cam = view.cam;
  const icam = Math.round(cam);
  const bod = d.bod;
  const night = bod >= 4 || bod === 0;
  const sky = d.weather.sky;
  setWeather(sky, d.season, true, d.wind, GROUND_Y, HUD_Y);
  resetLight();
  // The light of the hour (and the moon) where no lamp reaches.
  let amb = bod === 5 ? 8 + (d.moon >= 3 && d.moon <= 5 && (sky === 'fair' || sky === 'cloud') ? 2 : d.moon === 0 ? 0 : 1) : AMBIENT[bod]!;
  if (sky === 'fog' && bod >= 1 && bod <= 3) amb = 12;
  if (lightning()) amb = 15;
  playerRemap = ambientRemap(d.season, d.plague, bod, ambientSteps(amb) - 1);

  drawSky(bod, sky, d.moon, icam, d.windQ, now, GROUND_Y);

  // Ground: base tiles, fringes, crops and water; snow over it as it lies.
  const snowy = d.snow >= 2;
  if (sc !== lastSc || snowy !== lastSnowy) compile(sc, snowy);
  const c = lastC!;
  const c0 = icam >> 4;
  const c1 = Math.min(COLS, c0 + 17);
  const waterAnim = anim('t.water');
  const moonAnim = anim('t.water.moon');
  for (let r = 0; r < GROUND_ROWS; r++) {
    const y = GROUND_Y + r * TILE;
    for (let col = c0; col < c1; col++) {
      const i = r * COLS + col;
      const x = col * TILE - icam;
      if (c.water[i]) {
        blit(frameAt(waterAnim, now, (col * 7 + r * 3) * 113), x, y);
        if (night && moonScreenX > -999 && Math.abs(x + 8 - moonScreenX) < 14) blit(frameAt(moonAnim, now, col * 97), x, y, false, LOCKED);
      } else if (c.field[i]! >= 0) blit(fieldTile(s, c.field[i]!, d.season), x, y);
      else blit(c.base[i]!, x, y);
      for (let k = 0; k < MAXF; k++) {
        const f = c.fringe[i * MAXF + k]!;
        if (f < 0) break;
        blit(f, x, y);
      }
      if (d.snow === 1 && !c.water[i]) dither(x, y, TILE, TILE, C.moon, 6);
    }
  }
  if (!snowy) drawTufts(c.tufts, icam, d.windQ, now);

  // Objects and actors, back to front.
  const objs = sc.objs;
  let n = 0;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i]!;
    const w = spriteW(c.objSprite[i]!);
    if (o.x - icam > W || o.x + w - icam < 0) continue;
    order[n] = i;
    keys[n++] = o.y * 2;
  }
  const act = view.actors;
  for (let i = 0; i < act.length; i++) {
    if (!act[i]!.visible) continue;
    order[n] = 1000 + i;
    keys[n++] = Math.round(act[i]!.y) * 2 + 1;
  }
  sortDraw(n);
  for (let k = 0; k < n; k++) {
    const i = order[k]!;
    if (i >= 1000) {
      drawActor(act[i - 1000]!, cam, GROUND_Y, now, night);
      continue;
    }
    const o = objs[i]!;
    const a = c.objAnim[i];
    const id = a ? frameAt(a, now, i * 211) : night && c.objLit[i]! >= 0 ? c.objLit[i]! : c.objSprite[i]!;
    const h = spriteH(id);
    const x = o.x - icam, y = GROUND_Y + o.y - h;
    blit(id, x, y);
    if (o.snow && d.snow > 0) snowCap(id, x, y, d.snow + 1);
    if (needsCare(s, o)) wantPulse(x, y, spriteW(id), h);
    if (o.smoke && (bod <= 1 || night || d.weather.tempC < 8)) smoke(x + o.smoke[0], y + o.smoke[1], d.windQ, now, i);
    if (o.light && (!o.light.night || night)) {
      const flick = (now >> 7) % 4 === 0 ? 2 : 0;
      addLight(x + o.light.dx, y + o.light.dy, o.light.radius + flick, o.light.level, true, 0.7);
    }
    if (o.home) {
      // Our door: a lantern on an iron bracket, lit from dusk to dawn.
      lanternId = lanternId < 0 ? spriteId('icon.candle') : lanternId;
      const lx = x + 26, ly = y + h - 26;
      rect(lx - 2, ly - 2, 6, 1, C.black);
      rect(lx + 1, ly - 1, 1, 2, C.black);
      rect(lx - 1, ly + 1, 5, 1, C.black);
      rect(lx - 1, ly + 6, 5, 1, C.black);
      rect(lx, ly + 2, 3, 4, night ? ((now >> 7) % 3 === 0 ? C.flame : C.gold) | LOCK : C.slate);
      if (night) addLight(lx + 1, ly + 4, 38 + ((now >> 7) % 3), 14, true, 0.8);
    }
  }

  if (sc.id === 'camp' || (d.season !== 'winter' && night && bod >= 4 && sky === 'fair')) fireflies(icam, now);

  // Light: the hour and the moon outdoors, lamps and fires where they reach.
  finishWorld(d.season, d.plague, bod, 0, HUD_Y, amb);
  drawPulses(now);
  // Rolling fog: on fog days, and low over the ground at dawn. It pales what it covers, never hides it.
  if (sky === 'fog' || bod === 0) {
    const fogDay = sky === 'fog';
    const top = fogDay ? GROUND_Y - 30 : GROUND_Y + 50;
    for (let x = 0; x < W; x += 8) {
      const roll = SIN[((((x + ((icam * 7) / 10) | 0) / 6) | 0) + ((now / 140) | 0)) & 63]!;
      const roll2 = SIN[((((x - ((icam * 3) / 10) | 0) / 9) | 0) + ((now / 230) | 0)) & 63]!;
      const amt = (fogDay ? 5 : 3) + (roll >> 5);
      haze(x, top + ((roll2 * 6) >> 6), 8, HUD_Y - top, FOG_LUT, amt);
      if (fogDay) haze(x, top + 30 + (roll >> 3), 8, 26, FOG_LUT, amt + 3);
    }
  }
  drawWeather();
}

/* ───────────── rooms ───────────── */

let roomIds: Record<string, number> | null = null;
/** Daylight indoors per block: dim, and dark at night but for the fire and the candle. */
const COTTAGE_AMBIENT = [7, 10, 11, 10, 7, 4] as const;
const CHURCH_AMBIENT = [8, 11, 12, 11, 8, 5] as const;

/** Where the rushlight stands on the cottage table (room coordinates). */
const RUSHLIGHT = { x: 200, y: 103 } as const;

/** A rushlight: a peeled rush dipped in fat, held slanting in an iron nip; a small, smoky, yellow light. */
function rushlight(x: number, y: number, now: number): void {
  rect(x, y, 1, 8, C.black); // the stand
  rect(x - 2, y + 8, 5, 1, C.black);
  plot(x + 1, y - 1, C.ink);
  plot(x + 2, y - 2, C.mud); // the rush, slanting
  plot(x + 3, y - 3, C.mud);
  const f = (now >> 7) % 3;
  plot(x + 4, y - 4, (f ? C.gold : C.flame) | LOCK);
  plot(x + 4 + (f === 2 ? 1 : 0), y - 5, C.spark | LOCK);
  addLight(x + 4, y - 4, 40 + f, 12, true, 0.8);
}

/** A candle flame at screen (x, y), and its light. */
function flame(x: number, y: number, now: number): void {
  plot(x, y - 1, C.spark | LOCK);
  plot(x, y, ((now >> 7) % 3 === 0 ? C.flame : C.gold) | LOCK);
  plot(x + ((now >> 8) % 2), y - 2, C.gold | LOCK);
  addLight(x, y, 54 + ((now >> 7) % 3), 13, true, 0.8);
}

function drawRoom(s: SimState, view: WorldView, d: Day, now: number): void {
  const sc = view.scene;
  const m = roomMeta(sc.room!);
  const cam = Math.round(view.cam);
  const bod = d.bod;
  const night = bod >= 4 || bod === 0;
  roomIds ??= { cottage: spriteId('room.cottage'), church: spriteId('room.church') };
  setWeather(d.weather.sky, d.season, false, d.wind);
  resetLight();
  rect(0, 0, W, H, C.black);

  // The sky through the window: the hour's bands, rain on the glass.
  if (m.glass) {
    const g = m.glass;
    const gx = g.x - cam, gy = ROOM_Y + g.y;
    const sky = d.weather.sky;
    drawSky(bod, sky, d.moon, (cam / 5) | 0, d.windQ, now, gy + g.h);
    // Only the glass shows it: clear everything above and beside, keep the rows of the glass.
    rect(0, 0, W, gy, C.black);
    rect(0, gy, Math.max(0, gx), g.h, C.black);
    rect(gx + g.w, gy, W, g.h, C.black);
    if (sky === 'rain' || sky === 'storm') for (let k = 0; k < 12; k++) {
      const rx = gx + ((k * 23 + (now >> 4)) % g.w), ry = gy + ((k * 37 + (now >> 2)) % g.h);
      plot(rx, ry, C.sea | LOCK);
      plot(rx, ry + 1, C.sea | LOCK);
    }
    if (sky === 'snow') for (let k = 0; k < 14; k++) plot(gx + ((k * 29 + (now >> 6)) % g.w), gy + ((k * 17 + (now >> 5)) % g.h), C.moon | LOCK);
    // Daylight falls in through it.
    if (!night) addLight(gx + g.w / 2, gy + g.h + 30, 90, bod === 2 ? 14 : 12, false, 0.6);
    else if (d.moon >= 3 && d.moon <= 5) addLight(gx + g.w / 2, gy + g.h + 30, 60, 9, false, 0.5);
  }
  if (m.windows && !night) for (let i = 0; i < m.windows.length; i++) addLight(m.windows[i]!.x - cam + 16, ROOM_Y + m.windows[i]!.y + 50, 54, 13, false, 0.8);
  blit(roomIds[sc.room!]!, -cam, ROOM_Y);

  // The hearth: blazing, banked or out, as the sim says; its light fills the room.
  if (m.fire) {
    const h = hearthOf(s, d.weather.tempC);
    const fx = m.fire.x - cam, fy = ROOM_Y + m.fire.y + 4;
    const a = h === 'blazing' ? anim('fire.blazing') : h === 'banked' ? anim('fire.banked') : null;
    blit(a ? frameAt(a, now) : spriteId('fire.out'), fx - 16, fy - 28);
    if (s.wealth.firewood <= FIRE_LOW) wantPulse(fx - 22, fy - 34, 44, 36);
    if (h !== 'out') {
      const flick = ((now >> 6) * 2654435761) >>> 29; // 0..7, a cheap jitter
      const big = h === 'blazing';
      addLight(fx, fy - 12, (big ? 150 : 90) + flick * 2, big ? 15 : 13, true, 0.75);
      sparks(fx, fy - 16, now, big ? 7 : 3);
    }
  }
  // Candles at night (and in the church, always).
  if (m.candle && night) flame(m.candle.x - cam - 1, ROOM_Y + m.candle.y - 12, now);
  // A rushlight in its iron holder on the table, lit at dusk.
  if (sc.room === 'cottage' && (bod === 4 || bod === 5)) rushlight(RUSHLIGHT.x - cam, ROOM_Y + RUSHLIGHT.y, now);
  if (m.candles) for (let i = 0; i < m.candles.length; i++) flame(m.candles[i]!.x - cam - 1, ROOM_Y + m.candles[i]!.y + 1, now);

  // People.
  const act = view.actors;
  let n = 0;
  for (let i = 0; i < act.length; i++) {
    if (!act[i]!.visible) continue;
    order[n] = i;
    keys[n++] = Math.round(act[i]!.y);
  }
  sortDraw(n);
  playerRemap = null;
  for (let k = 0; k < n; k++) drawActor(act[order[k]!]!, cam, ROOM_Y, now, night);

  const ambient = sc.room === 'church' ? CHURCH_AMBIENT[bod]! : COTTAGE_AMBIENT[bod]!;
  finishWorld(d.season, d.plague, bod, 0, HUD_Y, ambient);
  drawPulses(now);
}

/* ───────────── HUD and prompts (after lighting: never darkened) ───────────── */

const BLOCK_SHORT = ['DAWN', 'MORN', 'NOON', 'AFTN', 'DUSK', 'NIGHT'] as const;
let hudSecond = -1;
let hudBod = -1;
let hudText = '';
let hudCheckAt = 0;

/** Rebuilds the countdown text; returns ms until the displayed second changes. */
function refreshCountdown(s: SimState, bod: number, wall: number): number {
  const end = s.anchorMs + ((s.block + 1) * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
  const left = Math.max(0, end - wall);
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

const iconIds = new Map<string, number>();
const icon = (name: string): number => {
  let id = iconIds.get(name);
  if (id === undefined) {
    id = spriteId(`icon.${name}`);
    iconIds.set(name, id);
  }
  return id;
};

function hud(s: SimState, view: WorldView, bod: number, now: number, wall: () => number): void {
  darkPanel(0, HUD_Y - 2, W, H - HUD_Y + 2);
  if (now >= hudCheckAt || bod !== hudBod) hudCheckAt = now + refreshCountdown(s, bod, wall());
  drawText(hudText, 6, HUD_Y + 4, C.gold);
  // Pending needs pulse.
  const on = (now >> 9) % 2 === 0;
  for (let i = 0; i < view.needs.length && i < 4; i++) {
    if (on) blit(icon(view.needs[i]!), 112 + i * 18, HUD_Y);
    else plot(112 + i * 18 + 8, HUD_Y + 8, C.blood);
  }
  // The belt tool (L) and the queue (R).
  blit(icon(view.belt), 196, HUD_Y);
  drawText('L', 186, HUD_Y + 4, C.stone);
  drawText(view.queued ? `R${view.queued}` : 'R', 216, HUD_Y + 4, view.queued ? C.flame : C.stone);
  if (view.scene.room) {
    // The room's name on the ceiling beam.
    rect(0, 0, W, ROOM_Y, C.black);
    drawText(view.scene.name, 6, 4, C.parchment);
  }
}

function drawPrompt(view: WorldView, oy: number): void {
  if (!view.prompt) return;
  const w = view.prompt.length * GLYPH + 8;
  const ax = Math.round(view.promptX - view.cam);
  let x = ax - (w >> 1);
  if (x < 2) x = 2;
  if (x + w > W - 2) x = W - 2 - w;
  let y = Math.round(oy + view.promptY) - 18;
  if (y < 2) y = 2;
  bubble(x, y, w, 14, Math.max(x + 6, Math.min(x + w - 6, ax)));
  drawText(view.prompt, x + 4, y + 3, C.bone);
  // "A:" in the button's colour.
  if (view.prompt.charCodeAt(0) === 65 && view.prompt.charCodeAt(1) === 58) drawText('A', x + 4, y + 3, C.rust);
}

function drawMessage(view: WorldView): void {
  if (!view.message) return;
  const w = view.message.length * GLYPH + 12;
  const x = (W - w) >> 1;
  darkPanel(x, HUD_Y - 26, w, 20);
  drawText(view.message, x + 6, HUD_Y - 20, C.bone);
}

/* ───────────── the frame ───────────── */

/** Draws the world for the sim state at `now` (frame ms). `wall` reads the wall clock (for the countdown). */
export function drawWorld(s: SimState, view: WorldView, now: number, wall: () => number): void {
  const d = dayOf(s);
  if (view.scene.room) drawRoom(s, view, d, now);
  else drawOutdoor(s, view, d, now);
  drawPrompt(view, view.scene.room ? ROOM_Y : GROUND_Y);
  drawMessage(view);
  hud(s, view, d.bod, now, wall);
}

/** For tests and the gallery: the scenes in the order the e2e visits them. */
export const SCENE_IDS: readonly SceneId[] = ['cottage', 'green', 'fields', 'woods', 'churchyard', 'church', 'manor', 'town', 'camp'];
export type { Obj };
export { pix, drawTextRight };

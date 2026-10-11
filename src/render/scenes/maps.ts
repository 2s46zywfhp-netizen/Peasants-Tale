import type { Location } from '../../sim/balance';

/*
 * The places, at 256x224. An outdoor scene is a terrain grid (16x16 tiles, autotiled) two screens wide, under
 * a parallax sky, with objects standing on it (buildings, trees, the well...), each with a footprint you
 * cannot walk through and, if it does something, a hotspot and a verb for the floating prompt ("A: CHOP").
 * The cottage and the church are side-view rooms instead.
 *
 * Coordinates on the ground: x from the scene's left edge, y down from the horizon (0) to the bottom of the
 * ground (GROUND_H). Objects and people stand on their base line: (x, y) is the left edge and the feet.
 */

export type SceneId = 'cottage' | 'green' | 'fields' | 'woods' | 'churchyard' | 'church' | 'manor' | 'town' | 'camp';
export type Dir = 'west' | 'east';

export const TILE = 16;
/** Screen y of the horizon: the sky above, the ground below. */
export const GROUND_Y = 64;
export const GROUND_ROWS = 9;
export const GROUND_H = GROUND_ROWS * TILE;
/** Columns in an outdoor scene: two screens, the camera pans. */
export const COLS = 32;
export const SCENE_W = COLS * TILE;
export const VIEW_W = 256;

export type Terrain = 'grass' | 'mud' | 'path' | 'cobble' | 'flagstone' | 'rushes' | 'soil' | 'water';
/** Terrain letters; '1'..'3' are the family's strips (soil showing the crop of sim field n), 'd' the lord's. */
export const TERRAIN_OF: Readonly<Record<string, Terrain>> = {
  g: 'grass', m: 'mud', p: 'path', c: 'cobble', f: 'flagstone', r: 'rushes', o: 'soil', w: 'water', '1': 'soil', '2': 'soil', '3': 'soil', d: 'soil',
};
/** Which terrain spills its edge over which (higher over lower): soft ground under hard, all over water. */
export const PRIORITY: Readonly<Record<Terrain, number>> = { water: -1, soil: 0, grass: 1, mud: 2, path: 3, cobble: 4, flagstone: 6, rushes: 6 };

export interface Light {
  /** Offset from the sprite's top-left. */
  dx: number;
  dy: number;
  radius: number;
  level: number;
  /** Lit only from dusk to dawn (windows, lanterns); otherwise always (fires). */
  night?: boolean;
}

export interface Obj {
  /** Sprite or animation name in the atlas. */
  s: string;
  x: number;
  /** Base line (feet). The sprite is drawn with its bottom edge here. */
  y: number;
  /** Footprint you cannot walk through, from the sprite's left edge and up from the base: [x0, x1, depth]. Null: walk over it. */
  foot?: readonly [number, number, number] | null;
  /** A here opens the actions of this place... */
  hot?: Location;
  /** ...and the prompt names it: "A: CHOP". */
  verb?: string;
  /** Walking up into [x0, x1] of its front goes inside. */
  door?: { to: SceneId; x0: number; x1: number };
  /** Our own cottage: the lantern by the door, UP: HOME. */
  home?: boolean;
  /** At night, this sprite instead (lit windows). */
  lit?: string;
  light?: Light;
  /** Woodsmoke from the chimney at this offset. */
  smoke?: readonly [number, number];
  /** Snow settles on its top in winter. */
  snow?: boolean;
}

export interface Npc {
  who: string;
  /** Stands for this villager (by id): shown only while they live in the village. */
  villager?: string;
  x: number;
  y: number;
  /** Wander this many pixels left and right. */
  wander?: number;
  when?: 'day' | 'night' | 'sundayMorning' | 'weekWork' | 'feast';
  talk?: string;
  /** Indoors: seated (in a pew), facing the altar. */
  sit?: boolean;
}

export interface SceneDef {
  id: SceneId;
  name: string;
  /** Outdoor scenes: GROUND_ROWS strings of COLS terrain letters. Rooms: empty. */
  terrain: string[];
  objs: Obj[];
  exits: Partial<Record<Dir, SceneId>>;
  /** Location used when A is pressed with nothing in reach. */
  ambient?: Location;
  npcs: Npc[];
  pens?: { kind: 'hen' | 'pig' | 'cow' | 'ox'; x: number; y: number }[];
  /** A side-view room (atlas room.<room>, its layout in atlas meta.rooms) instead of terrain. */
  room?: 'cottage' | 'church';
  /** Leaving a room through its door comes out here. */
  out?: { to: SceneId; x: number; y: number };
  /** Where you appear when the sim puts you here (a new life, flight, a fast-forward). */
  spawn: readonly [number, number];
}

const row = (s: string): string => s.padEnd(COLS, s[s.length - 1]).slice(0, COLS);
const grass = (): string => 'g'.repeat(COLS);

/* Sprites' footprints and their common furniture. */
const COTTAGE_FOOT = [3, 61, 14] as const;
const house = (x: number, y: number, extra: Partial<Obj> = {}): Obj => ({
  s: 'o.house', lit: 'o.house.lit', x, y, foot: COTTAGE_FOOT, light: { dx: 46, dy: 41, radius: 30, level: 13, night: true }, smoke: [45, 0], snow: true, ...extra,
});
const tree = (x: number, y: number, extra: Partial<Obj> = {}): Obj => ({ s: 'o.tree', x, y, foot: [11, 21, 6], snow: true, ...extra });
const pine = (x: number, y: number, extra: Partial<Obj> = {}): Obj => ({ s: 'o.pine', x, y, foot: [11, 21, 6], snow: true, ...extra });
const yew = (x: number, y: number): Obj => ({ s: 'o.yew', x, y, foot: [10, 22, 6], snow: true });
const bush = (x: number, y: number): Obj => ({ s: 'o.bush', x, y, foot: [2, 14, 6], snow: true });
const tomb = (x: number, y: number, cross = false): Obj => ({ s: cross ? 'o.cross' : 'o.tomb', x, y, foot: [3, 13, 5], snow: true });
const fence = (x: number, y: number, n: number): Obj[] => Array.from({ length: n }, (_, i) => ({ s: 'o.fence', x: x + i * 16, y, foot: [0, 16, 4] as const, snow: true }));

export const SCENES: Record<SceneId, SceneDef> = {
  cottage: {
    id: 'cottage', name: 'YOUR COTTAGE', terrain: [], objs: [], exits: {}, ambient: 'home', room: 'cottage',
    out: { to: 'green', x: 25, y: 62 }, spawn: [270, 0],
    npcs: [],
  },
  green: {
    id: 'green', name: 'VILLAGE GREEN', exits: { west: 'fields', east: 'churchyard' }, ambient: 'green', spawn: [25, 62],
    terrain: [
      grass(), grass(), grass(),
      row('gpggggggpggggggggggpggggggpggggg'),
      row('pppppppppppppppppppppppppppppppp'),
      row('pppppppppppppppppppppppppppppppp'),
      row('ggggggggggggggggggggggggggggggggg'),
      row('ggggggggggggmmmggggggggggggggggg'),
      grass(),
    ],
    objs: [
      { s: 'o.cottage', lit: 'o.cottage.lit', x: 8, y: 52, foot: COTTAGE_FOOT, home: true, door: { to: 'cottage', x0: 10, x1: 24 }, hot: 'home', verb: 'HOME',
        light: { dx: 46, dy: 41, radius: 30, level: 13, night: true }, smoke: [45, 0], snow: true },
      { s: 'o.alehouse', lit: 'o.alehouse.lit', x: 112, y: 52, foot: [3, 69, 14], hot: 'tavern', verb: 'ALEHOUSE',
        light: { dx: 54, dy: 41, radius: 34, level: 14, night: true }, smoke: [53, 0], snow: true },
      house(290, 52),
      house(400, 52),
      tree(200, 50), pine(232, 44), tree(476, 46), tree(360, 30),
      { s: 'o.well', x: 236, y: 124, foot: [3, 29, 10], hot: 'green', verb: 'GOSSIP', snow: true },
      { s: 'o.coop', x: 60, y: 118, foot: [2, 30, 10], snow: true },
      { s: 'o.sty', x: 4, y: 142, foot: [0, 48, 10], snow: true },
      { s: 'o.haystack', x: 152, y: 132, foot: [3, 29, 10], snow: true },
      { s: 'o.cart', x: 330, y: 138, foot: [2, 38, 8], snow: true },
      bush(186, 138), bush(430, 120), bush(470, 140),
      { s: 'o.sign', x: 190, y: 58, foot: [6, 10, 4], hot: 'tavern', verb: 'ALEHOUSE' },
    ],
    npcs: [
      { who: 'smith', villager: 'smith', x: 210, y: 82, wander: 8, when: 'day', talk: 'villager' },
      { who: 'goodwife', villager: 'margery', x: 270, y: 104, wander: 20, when: 'day', talk: 'villager' },
      { who: 'goodwife', villager: 'brewster', x: 150, y: 64, wander: 4, when: 'night', talk: 'villager' },
      { who: 'maid', villager: 'emma', x: 90, y: 100, wander: 18, when: 'feast', talk: 'villager' },
      { who: 'reeve', villager: 'thomas', x: 420, y: 100, wander: 18, when: 'feast', talk: 'villager' },
      { who: 'child', x: 170, y: 110, wander: 30, when: 'day', talk: 'child' },
      { who: 'elder', villager: 'godric', x: 176, y: 66, wander: 4, talk: 'villager' },
      { who: 'beggar', villager: 'nicholas', x: 340, y: 66, wander: 2, talk: 'villager' },
    ],
    pens: [{ kind: 'hen', x: 96, y: 128 }, { kind: 'pig', x: 22, y: 136 }],
  },
  fields: {
    id: 'fields', name: 'THE STRIP FIELDS', exits: { west: 'woods', east: 'green' }, ambient: 'strips', spawn: [480, 72],
    terrain: [
      grass(),
      row('1111111111111pp2222222222222222g'),
      row('1111111111111pp2222222222222222g'),
      row('1111111111111pp2222222222222222g'),
      row('pppppppppppppppppppppppppppppppp'),
      row('3333333333333pp3333333333333gggg'),
      row('3333333333333pp3333333333333gggg'),
      row('3333333333333pp3333333333333gggg'),
      grass(),
    ],
    objs: [
      ...fence(0, 14, 13), ...fence(240, 14, 16),
      tree(212, 10), pine(150, 8), tree(20, 6), tree(460, 8),
      { s: 'o.haystack', x: 470, y: 140, foot: [3, 29, 10], snow: true },
      ...fence(448, 82, 4),
      { s: 'o.cart', x: 8, y: 142, foot: [2, 38, 8], snow: true },
    ],
    npcs: [
      { who: 'reeve', villager: 'reeve', x: 150, y: 72, wander: 40, when: 'day', talk: 'villager' },
      { who: 'shepherd', villager: 'shepherd', x: 320, y: 140, wander: 30, when: 'day', talk: 'villager' },
      { who: 'shepherd', villager: 'peter', x: 90, y: 140, wander: 30, when: 'day', talk: 'villager' },
    ],
    pens: [{ kind: 'cow', x: 462, y: 108 }, { kind: 'ox', x: 462, y: 128 }],
  },
  woods: {
    id: 'woods', name: 'THE WOODS EDGE', exits: { east: 'fields' }, ambient: 'woods', spawn: [480, 56],
    terrain: [
      grass(), grass(),
      row('gggggggggggggggggggpppppppppppppp'),
      row('gggggggggggggggggppppppppppppppp'),
      row('ggggggggggggggggggggggggggggggpp'),
      row('gggggggggggggggggggggggggggggggg'),
      row('wwwwwwwwwwwwwwwwwwwwwwwwwwwwwggg'),
      row('wwwwwwwwwwwwwwwwwwwwwwwwwwwwwggg'),
      row('mggggggggggggggggggggggggggggggg'),
    ],
    objs: [
      pine(0, 18), tree(28, 14), pine(130, 12), tree(196, 16), pine(236, 10), tree(300, 20), pine(352, 12), tree(410, 16), pine(470, 22),
      { s: 'o.barrow', x: 44, y: 46, foot: [4, 76, 14], hot: 'barrow', verb: 'OFFER', snow: true },
      { s: 'o.standingStone', x: 150, y: 76, foot: [3, 13, 6], hot: 'barrow', verb: 'OFFER', snow: true },
      { s: 'o.fairyRing', x: 104, y: 92, foot: null, hot: 'barrow', verb: 'OFFER' },
      tree(204, 70, { hot: 'woods', verb: 'CHOP' }),
      tree(256, 92, { hot: 'woods', verb: 'CHOP' }),
      pine(430, 70, { hot: 'woods', verb: 'CHOP' }),
      { s: 'o.woodpile', x: 330, y: 84, foot: [2, 30, 8], hot: 'woods', verb: 'CHOP', snow: true },
      { s: 'o.block', x: 372, y: 88, foot: [3, 13, 5], hot: 'woods', verb: 'CHOP' },
      bush(170, 140), bush(380, 142), pine(20, 144), tree(250, 146),
    ],
    npcs: [
      { who: 'dog', x: 270, y: 72, wander: 10, when: 'night', talk: 'dog' },
      { who: 'goodwife', villager: 'matilda', x: 104, y: 70, wander: 6, when: 'day', talk: 'villager' },
    ],
  },
  churchyard: {
    id: 'churchyard', name: 'THE CHURCHYARD', exits: { west: 'green', east: 'manor' }, spawn: [101, 66],
    terrain: [
      grass(), grass(), grass(),
      row('gggggpggggggggggggggggggggggggggg'),
      row('pppppppppppppppppppppppppppppppp'),
      row('pppppppppppppppppppppppppppppppp'),
      grass(), grass(), grass(),
    ],
    objs: [
      { s: 'o.church', x: 40, y: 56, foot: [0, 112, 16], door: { to: 'church', x0: 52, x1: 70 }, hot: 'church', verb: 'CHURCH',
        light: { dx: 61, dy: 80, radius: 26, level: 12, night: true }, snow: true },
      yew(200, 42), yew(300, 48), yew(470, 40), yew(10, 140),
      tomb(30, 118), tomb(70, 132, true), tomb(110, 116), tomb(150, 138), tomb(196, 120, true), tomb(240, 140), tomb(290, 118),
      tomb(330, 134, true), tomb(380, 120), tomb(420, 140), tomb(460, 118, true), tomb(490, 138),
      { s: 'o.cross', x: 176, y: 58, foot: [3, 13, 5], snow: true },
    ],
    npcs: [
      { who: 'priest', villager: 'priest', x: 240, y: 104, wander: 16, when: 'night', talk: 'villager' },
      { who: 'smith', villager: 'miller', x: 420, y: 100, wander: 16, when: 'day', talk: 'villager' },
    ],
  },
  church: {
    id: 'church', name: 'THE CHURCH', terrain: [], objs: [], exits: {}, ambient: 'church', room: 'church',
    out: { to: 'churchyard', x: 101, y: 66 }, spawn: [60, 0],
    npcs: [
      { who: 'priest', villager: 'priest', x: 296, y: 0, wander: 10, when: 'day', talk: 'villager' },
      { who: 'lord', x: 66, y: 0, when: 'sundayMorning', talk: 'lord', sit: true },
      { who: 'goodwife', villager: 'isabel', x: 146, y: 0, when: 'sundayMorning', talk: 'villager', sit: true },
    ],
  },
  manor: {
    id: 'manor', name: 'THE MANOR GATE', exits: { west: 'churchyard' }, spawn: [228, 70],
    terrain: [
      grass(), grass(), grass(),
      row('ggggggggggggggpggggggggggggggggg'),
      row('pppppppppppppppppppppppppppppppp'),
      row('ggggggggggggggpggggggggggggggggg'),
      row('ddddddddddddddddddddgggggggggggg'),
      row('ddddddddddddddddddddgggggggggggg'),
      row('ddddddddddddddddddddgggggggggggg'),
    ],
    objs: [
      { s: 'o.manorGate', x: 180, y: 56, foot: [0, 96, 14], hot: 'manor', verb: 'MANOR', light: { dx: 48, dy: 40, radius: 30, level: 12, night: true }, snow: true },
      tree(100, 46), pine(60, 40), tree(310, 44), pine(380, 36), tree(450, 48), tree(20, 50),
      ...fence(0, 94, 20),
      { s: 'o.cart', x: 360, y: 132, foot: [2, 38, 8], snow: true },
      { s: 'o.haystack', x: 420, y: 112, foot: [3, 29, 10], snow: true },
    ],
    npcs: [
      { who: 'steward', villager: 'steward', x: 240, y: 70, wander: 6, when: 'day', talk: 'villager' },
      { who: 'reeve', villager: 'reeve', x: 120, y: 120, wander: 10, when: 'weekWork', talk: 'villager' },
      { who: 'lord', x: 210, y: 66, when: 'feast', talk: 'lord' },
    ],
  },
  town: {
    id: 'town', name: 'THE TOWN', exits: {}, ambient: 'town', spawn: [256, 90],
    terrain: [
      row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'),
      row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'),
      row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'), row('cccccccccccccccccccccccccccccccc'),
    ],
    objs: [
      house(0, 52), house(66, 52),
      { s: 'o.alehouse', lit: 'o.alehouse.lit', x: 134, y: 52, foot: [3, 69, 14], hot: 'town', verb: 'TOWN', light: { dx: 54, dy: 41, radius: 34, level: 14, night: true }, smoke: [53, 0], snow: true },
      { s: 'o.church', x: 216, y: 56, foot: [0, 112, 16], hot: 'town', verb: 'TOWN', snow: true },
      house(336, 52), house(404, 52), house(470, 52),
      { s: 'o.stall', x: 90, y: 112, foot: [2, 46, 10], hot: 'town', verb: 'TRADE', snow: true },
      { s: 'o.stall', x: 300, y: 120, foot: [2, 46, 10], hot: 'town', verb: 'TRADE', snow: true },
      { s: 'o.marketCross', x: 220, y: 110, foot: [3, 13, 6], snow: true },
      { s: 'o.well', x: 400, y: 128, foot: [3, 29, 10], hot: 'town', verb: 'TOWN', snow: true },
      { s: 'o.cart', x: 20, y: 140, foot: [2, 38, 8], snow: true },
    ],
    npcs: [
      { who: 'steward', x: 200, y: 96, wander: 30, when: 'day', talk: 'townsman' },
      { who: 'goodwife', x: 80, y: 130, wander: 20, when: 'day', talk: 'townsman' },
      { who: 'smith', x: 330, y: 80, wander: 6, when: 'day', talk: 'townsman' },
      { who: 'maid', x: 440, y: 100, wander: 12, when: 'day', talk: 'townsman' },
      { who: 'beggar', x: 260, y: 140, wander: 2, talk: 'beggar' },
    ],
  },
  camp: {
    id: 'camp', name: 'OUTLAW CAMP', exits: {}, ambient: 'camp', spawn: [256, 96],
    terrain: [
      grass(), grass(), grass(), grass(),
      row('ggggggggggggmmmmmmgggggggggggggg'),
      row('ggggggggggggmmmmmmgggggggggggggg'),
      grass(),
      row('wwwwwwwwwggggggggggggggggggggggg'),
      row('wwwwwwwwwwwggggggggggggggggggggg'),
    ],
    objs: [
      pine(0, 20), tree(40, 14), pine(90, 24), tree(140, 12), pine(300, 16), tree(350, 22), pine(410, 12), tree(470, 18),
      pine(480, 100), tree(440, 140), pine(170, 144),
      { s: 'o.tent', x: 180, y: 70, foot: [2, 46, 12], hot: 'camp', verb: 'CAMP', snow: true },
      { s: 'fire.camp', x: 232, y: 90, foot: [2, 14, 6], hot: 'camp', verb: 'WARM UP', light: { dx: 8, dy: 6, radius: 54, level: 15 } },
      { s: 'o.campfire', x: 232, y: 92, foot: null },
    ],
    npcs: [{ who: 'dog', x: 300, y: 80, wander: 6, when: 'night', talk: 'dog' }],
  },
};

/** The scene the sim's location belongs to. */
export const SCENE_OF: Record<Location, SceneId> = {
  home: 'cottage', green: 'green', tavern: 'green', strips: 'fields', demesne: 'manor', church: 'church', woods: 'woods', stream: 'woods',
  manor: 'manor', barrow: 'woods', town: 'town', camp: 'camp',
};

export const OPPOSITE: Record<Dir, Dir> = { west: 'east', east: 'west' };

export const isRoom = (s: SceneDef): boolean => s.room !== undefined;

/** Terrain letter at ground tile (col, row), or '' off the map. */
export function terrainAt(s: SceneDef, col: number, row: number): string {
  return s.terrain[row]?.[col] ?? '';
}

/** Width of a scene in pixels. */
export function widthOf(s: SceneDef, roomW = 384): number {
  return s.room ? roomW : SCENE_W;
}

/** Camera x for a point of interest at x, clamped to the scene. */
export function camFor(s: SceneDef, x: number, roomW = 384): number {
  const max = widthOf(s, roomW) - VIEW_W;
  const c = x - VIEW_W / 2;
  return c < 0 || max <= 0 ? 0 : c > max ? max : c;
}

/** Is the ground point (x, y) blocked (water, an object's footprint, out of bounds)? */
export function solidAt(s: SceneDef, x: number, y: number): boolean {
  if (y < 4 || y >= GROUND_H) return true;
  if (x < 0 || x >= SCENE_W) return false; // the edges are exits (or walls, handled by the walker)
  if (TERRAIN_OF[terrainAt(s, x >> 4, y >> 4)] === 'water') return true;
  for (let i = 0; i < s.objs.length; i++) {
    const o = s.objs[i]!;
    const f = o.foot === undefined ? DEFAULT_FOOT : o.foot;
    if (!f) continue;
    if (x >= o.x + f[0] && x < o.x + f[1] && y < o.y && y >= o.y - f[2]) return true;
  }
  return false;
}
const DEFAULT_FOOT = [0, 16, 6] as const;

/** The object whose hotspot covers the point (x, y), or null: its footprint widened by `reach`. */
export function objAt(s: SceneDef, x: number, y: number, reach = 8): Obj | null {
  let best: Obj | null = null;
  for (let i = 0; i < s.objs.length; i++) {
    const o = s.objs[i]!;
    if (!o.hot) continue;
    const f = o.foot ?? [0, 16, 12];
    if (x >= o.x + f[0] - reach && x < o.x + f[1] + reach && y < o.y + reach && y >= o.y - f[2] - reach) best = o;
  }
  return best;
}

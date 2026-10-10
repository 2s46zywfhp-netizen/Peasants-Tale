import type { Location } from '../../sim/balance';

export type SceneId = 'cottage' | 'green' | 'fields' | 'woods' | 'churchyard' | 'church' | 'manor';
export type Dir = 'west' | 'east';

export const TILE = 16;
export const COLS = 10;

export interface TileDef {
  /** Sprite (tile.*) or animation (anim:tile.*) name. */
  sprite: string;
  solid?: boolean;
  /** A or the action menu here acts at this sim location. */
  hotspot?: Location;
  /** Walking onto this tile goes through a door. */
  door?: { to: SceneId; col: number; row: number };
  /** Strip-field tile showing the crop of sim field n. */
  field?: number;
  /** Light source at night (hearth, candle, window). */
  light?: 'hearth' | 'candle' | 'window';
}

const T = (sprite: string, extra: Partial<TileDef> = {}): TileDef => ({ sprite, ...extra });

const OUTDOOR: Record<string, TileDef> = {
  '.': T('tile.grass'),
  ',': T('tile.grass2'),
  '=': T('tile.path'),
  '#': T('tile.cobble'),
  T: T('tile.tree', { solid: true, hotspot: 'woods' }),
  D: T('tile.darkTree', { solid: true, hotspot: 'woods' }),
  b: T('tile.bush', { solid: true }),
  f: T('tile.fence', { solid: true }),
  '<': T('tile.thatch.l', { solid: true }),
  '^': T('tile.thatch', { solid: true }),
  '>': T('tile.thatch.r', { solid: true }),
  w: T('tile.daub', { solid: true }),
  o: T('tile.window', { solid: true, light: 'window' }),
  d: T('tile.door', { door: { to: 'cottage', col: 4, row: 6 } }),
  W: T('tile.well', { solid: true, hotspot: 'green' }),
  s: T('tile.sign', { solid: true, hotspot: 'tavern', light: 'window' }),
  a: T('tile.door', { solid: true, hotspot: 'tavern' }),
  S: T('tile.stone', { solid: true }),
  R: T('tile.slateRoof', { solid: true }),
  X: T('tile.towerTop', { solid: true }),
  C: T('tile.churchDoor', { door: { to: 'church', col: 4, row: 6 } }),
  G: T('tile.stained', { solid: true }),
  t: T('tile.tomb', { solid: true }),
  y: T('tile.yew', { solid: true }),
  M: T('tile.manorWall', { solid: true }),
  B: T('tile.banner', { solid: true }),
  P: T('tile.pillar', { solid: true, hotspot: 'demesne' }),
  g: T('tile.gate', { solid: true, hotspot: 'demesne' }),
  '(': T('tile.barrow.l', { solid: true }),
  O: T('tile.barrow.door', { solid: true }),
  ')': T('tile.barrow.r', { solid: true }),
  I: T('tile.standingStone', { solid: true }),
  r: T('tile.fairyRing'),
  '~': T('anim:tile.water', { solid: true, hotspot: 'stream' }),
  '1': T('tile.soil', { field: 0, hotspot: 'strips' }),
  '2': T('tile.soil', { field: 1, hotspot: 'strips' }),
  '3': T('tile.soil', { field: 2, hotspot: 'strips' }),
};

const INDOOR: Record<string, TileDef> = {
  _: T('tile.rushes'),
  H: T('tile.wallIn', { solid: true }),
  h: T('anim:tile.hearth', { solid: true, hotspot: 'home', light: 'hearth' }),
  L: T('tile.bed.l', { solid: true, hotspot: 'home' }),
  J: T('tile.bed.r', { solid: true, hotspot: 'home' }),
  p: T('tile.pot', { solid: true, hotspot: 'home' }),
  k: T('tile.table', { solid: true, hotspot: 'home' }),
  E: T('tile.doorIn', { door: { to: 'green', col: 1, row: 2 } }),
  F: T('tile.flagstone'),
  S: T('tile.stone', { solid: true }),
  G: T('tile.stained', { solid: true }),
  x: T('tile.rood', { solid: true, hotspot: 'church' }),
  A: T('tile.altar', { solid: true, hotspot: 'church' }),
  c: T('anim:tile.candle', { solid: true, light: 'candle' }),
  q: T('tile.pew', { solid: true, hotspot: 'church' }),
  K: T('tile.doorIn', { door: { to: 'churchyard', col: 4, row: 2 } }),
};

export interface Npc {
  who: string;
  /** Position in pixels relative to the scene's tile map. */
  x: number;
  y: number;
  /** Wander this many pixels left and right. */
  wander?: number;
  when?: 'day' | 'night' | 'sundayMorning' | 'weekWork' | 'feast' | 'spouse';
  talk?: string;
}

export interface SceneDef {
  id: SceneId;
  name: string;
  outdoor: boolean;
  rows: string[];
  legend: Record<string, TileDef>;
  exits: Partial<Record<Dir, SceneId>>;
  /** Location used when A is pressed with no tile hotspot in reach. */
  ambient?: Location;
  npcs: Npc[];
  /** Livestock pens: [kind, x, y]. */
  pens?: { kind: 'hen' | 'pig' | 'cow' | 'ox'; x: number; y: number }[];
}

export const SCENES: Record<SceneId, SceneDef> = {
  cottage: {
    id: 'cottage', name: 'COTTAGE', outdoor: false, legend: INDOOR, exits: {}, ambient: 'home',
    rows: [
      'HHHHHHHHHH',
      'HhH_k_LJ_H',
      'H_p______H',
      'H________H',
      'H________H',
      'H________H',
      'H________H',
      'HHHHEHHHHH',
    ],
    npcs: [{ who: 'wife', x: 56, y: 36, wander: 24, when: 'spouse', talk: 'wife' }],
  },
  green: {
    id: 'green', name: 'VILLAGE GREEN', outdoor: true, legend: OUTDOOR, exits: { west: 'fields', east: 'churchyard' }, ambient: 'green',
    rows: [
      '<^>.T.<^^>',
      'wdo.b.wsaw',
      '==========',
      '.,..W...,.',
      '..,....,..',
      '.....,....',
    ],
    npcs: [
      { who: 'smith', x: 92, y: 44, wander: 8, when: 'day', talk: 'villager' },
      { who: 'goodwife', x: 120, y: 64, wander: 20, when: 'day', talk: 'villager' },
      { who: 'child', x: 40, y: 72, wander: 30, when: 'day', talk: 'child' },
      { who: 'elder', x: 112, y: 30, wander: 4, talk: 'elder' },
      { who: 'beggar', x: 144, y: 64, wander: 2, talk: 'beggar' },
    ],
    pens: [{ kind: 'hen', x: 4, y: 52 }, { kind: 'pig', x: 30, y: 70 }],
  },
  fields: {
    id: 'fields', name: 'STRIP FIELDS', outdoor: true, legend: OUTDOOR, exits: { west: 'woods', east: 'green' }, ambient: 'strips',
    rows: [
      'ffffffffff',
      '1111=22222',
      '==========',
      '3333=33333',
      '3333=33333',
      'fffff..fff',
    ],
    npcs: [
      { who: 'reeve', x: 72, y: 26, wander: 40, when: 'day', talk: 'reeve' },
      { who: 'shepherd', x: 104, y: 76, wander: 30, when: 'day', talk: 'villager' },
    ],
    pens: [{ kind: 'cow', x: 88, y: 76 }, { kind: 'ox', x: 112, y: 76 }],
  },
  woods: {
    id: 'woods', name: 'WOODS EDGE', outdoor: true, legend: OUTDOOR, exits: { east: 'fields' }, ambient: 'woods',
    rows: [
      'DDDTDDDTDD',
      'DT..,(O)DD',
      'D..r..,..=',
      '...I...,..',
      '~~~~~~~~..',
      'D,..D..TDD',
    ],
    npcs: [{ who: 'blackDog', x: 96, y: 52, wander: 10, when: 'night', talk: 'dog' }],
  },
  churchyard: {
    id: 'churchyard', name: 'CHURCHYARD', outdoor: true, legend: OUTDOOR, exits: { west: 'green', east: 'manor' },
    rows: [
      '..RRXRR.y.',
      '..SGCGS.y.',
      '==========',
      '.t.t..,.t.',
      '..,.t..t..',
      'y.t.....,y',
    ],
    npcs: [{ who: 'priest', x: 120, y: 64, wander: 16, when: 'night', talk: 'priest' }],
  },
  church: {
    id: 'church', name: 'CHURCH', outdoor: false, ambient: 'church', exits: {},
    legend: INDOOR,
    rows: [
      'SSGSxSGSSS',
      'FFFcAAcFFF',
      'FFFFFFFFFF',
      'qqqqFFqqqq',
      'FFFFFFFFFF',
      'qqqqFFqqqq',
      'FFFFFFFFFF',
      'SSSSKSSSSS',
    ],
    npcs: [
      { who: 'priest', x: 72, y: 26, wander: 12, when: 'day', talk: 'priest' },
      { who: 'lord', x: 24, y: 32, when: 'sundayMorning', talk: 'lord' },
      { who: 'goodwife', x: 120, y: 72, when: 'sundayMorning', talk: 'villager' },
    ],
  },
  manor: {
    id: 'manor', name: 'MANOR GATE', outdoor: true, legend: OUTDOOR, exits: { west: 'churchyard' },
    rows: [
      'MBMMMMMMBM',
      'MMMMPgPMMM',
      '======...T',
      'T.,..=....',
      '..,....,.T',
      '.T....,...',
    ],
    npcs: [
      { who: 'steward', x: 104, y: 30, wander: 6, when: 'day', talk: 'steward' },
      { who: 'reeve', x: 40, y: 52, wander: 10, when: 'weekWork', talk: 'reeve' },
      { who: 'lord', x: 76, y: 30, when: 'feast', talk: 'lord' },
    ],
  },
};

/** Where on screen a scene's tile map starts. Outdoor scenes leave the top 40 pixels to the sky. */
export function originY(s: SceneDef): number {
  return s.outdoor ? 40 : 8;
}

export function tileAt(s: SceneDef, col: number, row: number): TileDef | null {
  const ch = s.rows[row]?.[col];
  return ch === undefined ? null : (s.legend[ch] ?? null);
}

/** Opposite edge for an exit. */
export const OPPOSITE: Record<Dir, Dir> = { west: 'east', east: 'west' };

/** The scene the sim's location belongs to. */
export const SCENE_OF: Record<Location, SceneId> = {
  home: 'cottage', green: 'green', tavern: 'green', strips: 'fields', demesne: 'manor', church: 'church', woods: 'woods', stream: 'woods',
};

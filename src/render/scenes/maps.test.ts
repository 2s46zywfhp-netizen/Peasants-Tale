import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../sim/balance';
import { hasAnim, hasSprite } from '../atlas';
import { loadTestAtlas } from '../testAtlas';
import { COLS, GROUND_H, GROUND_ROWS, SCENES, SCENE_OF, SCENE_W, TERRAIN_OF, objAt, solidAt, type SceneDef, type SceneId } from './maps';

loadTestAtlas();
const STEP = 4;
const FOOT_W = 5;
const blocked = (s: SceneDef, x: number, y: number) => solidAt(s, x - FOOT_W, y) || solidAt(s, x + FOOT_W, y) || solidAt(s, x - FOOT_W, y - 3) || solidAt(s, x + FOOT_W, y - 3);

/** Every free point (on a 4px grid) the feet can reach from (x, y). */
function flood(s: SceneDef, x0: number, y0: number): Set<number> {
  const seen = new Set<number>();
  const key = (x: number, y: number) => y * 10000 + x;
  const q: [number, number][] = [[Math.round(x0 / STEP) * STEP, Math.round(y0 / STEP) * STEP]];
  while (q.length) {
    const [x, y] = q.pop()!;
    if (x < 0 || x > SCENE_W || y < 0 || y >= GROUND_H) continue;
    const k = key(x, y);
    if (seen.has(k) || blocked(s, x, y)) continue;
    seen.add(k);
    q.push([x + STEP, y], [x - STEP, y], [x, y + STEP], [x, y - STEP]);
  }
  return seen;
}
const outdoor = Object.values(SCENES).filter((s) => !s.room);
const points = (set: Set<number>) => [...set].map((k) => [k % 10000, Math.floor(k / 10000)] as const);

describe('scene maps at 256x224', () => {
  it('has every place, rooms for the cottage and the church, and well-formed terrain', () => {
    expect(Object.keys(SCENES).sort()).toEqual(['camp', 'church', 'churchyard', 'cottage', 'fields', 'green', 'manor', 'town', 'woods']);
    expect(SCENES.cottage.room).toBe('cottage');
    expect(SCENES.church.room).toBe('church');
    for (const s of outdoor) {
      expect(s.terrain, s.id).toHaveLength(GROUND_ROWS);
      for (const row of s.terrain) {
        expect(row, s.id).toHaveLength(COLS);
        for (const ch of row) expect(TERRAIN_OF[ch], `${s.id} '${ch}'`).toBeDefined();
      }
    }
  });

  it('every object, person and beast has its sprite in the atlas', () => {
    for (const s of Object.values(SCENES)) {
      for (const o of s.objs) {
        expect(hasSprite(o.s) || hasAnim(o.s), `${s.id} ${o.s}`).toBe(true);
        if (o.lit) expect(hasSprite(o.lit), o.lit).toBe(true);
      }
      for (const n of s.npcs) expect(hasAnim(n.who === 'dog' ? 'dog.idle' : `${n.who}.idle.down`), n.who).toBe(true);
      for (const p of s.pens ?? []) expect(hasAnim(`${p.kind}.idle`), p.kind).toBe(true);
    }
  });

  it('the spawn is free, and from it every exit, door and hotspot can be reached', () => {
    for (const s of outdoor) {
      const [sx, sy] = s.spawn;
      expect(blocked(s, sx, sy), `${s.id} spawn`).toBe(false);
      const reach = flood(s, sx, sy);
      const pts = points(reach);
      if (s.exits.west) expect(pts.some(([x]) => x <= 8), `${s.id} west`).toBe(true);
      if (s.exits.east) expect(pts.some(([x]) => x >= SCENE_W - 8), `${s.id} east`).toBe(true);
      for (const o of s.objs) {
        if (o.door) expect(pts.some(([x, y]) => x >= o.x + o.door!.x0 && x <= o.x + o.door!.x1 && y <= o.y + 12 && y >= o.y), `${s.id} door ${o.s}`).toBe(true);
        if (o.hot) expect(pts.some(([x, y]) => objAt(s, x, y - 2, 6) === o || objAt(s, x, y + 8, 6) === o), `${s.id} ${o.s} at ${o.x}`).toBe(true);
      }
    }
  });

  it('the family strips and the demesne are in the fields and at the manor', () => {
    const has = (id: SceneId, ch: string) => SCENES[id].terrain.join('').includes(ch);
    expect(['1', '2', '3'].every((c) => has('fields', c))).toBe(true);
    expect(has('manor', 'd')).toBe(true);
    expect(has('woods', 'w')).toBe(true);
    expect(SCENES.green.objs.some((o) => o.home && o.door?.to === 'cottage')).toBe(true);
    expect(SCENES.churchyard.objs.some((o) => o.door?.to === 'church')).toBe(true);
    expect(SCENES.woods.objs.some((o) => o.hot === 'barrow')).toBe(true);
  });

  it('scenes link both ways, and every location an action needs has a scene', () => {
    for (const s of outdoor)
      for (const [dir, to] of Object.entries(s.exits)) expect(SCENES[to!].exits[dir === 'west' ? 'east' : 'west'], `${s.id}->${to}`).toBe(s.id);
    for (const a of Object.values(ACTIONS)) if (a.location !== 'any') expect(SCENES[SCENE_OF[a.location]]).toBeDefined();
    expect(SCENES.cottage.out?.to).toBe('green');
    expect(SCENES.church.out?.to).toBe('churchyard');
  });
});

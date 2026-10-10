import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../../sim/balance';
import { ANIMS, SPRITES } from '../sprites';
import { COLS, OPPOSITE, SCENES, SCENE_OF, tileAt, type Dir, type SceneDef, type SceneId } from './maps';

const walkable = (s: SceneDef, c: number, r: number) => {
  const t = tileAt(s, c, r);
  return !!t && !t.solid;
};

/** Every walkable tile reachable from (c, r) inside a scene. */
function flood(s: SceneDef, c0: number, r0: number): Set<string> {
  const seen = new Set<string>();
  const q: [number, number][] = [[c0, r0]];
  while (q.length) {
    const [c, r] = q.pop()!;
    const k = `${c},${r}`;
    if (seen.has(k) || !walkable(s, c, r)) continue;
    seen.add(k);
    q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return seen;
}

/** Entrances/exits of a scene as tiles: door tiles, and walkable edge tiles for each exit. */
function portals(s: SceneDef): { tile: [number, number]; to: SceneId }[] {
  const out: { tile: [number, number]; to: SceneId }[] = [];
  s.rows.forEach((row, r) => [...row].forEach((_, c) => {
    const t = tileAt(s, c, r)!;
    if (t.door) out.push({ tile: [c, r], to: t.door.to });
  }));
  for (const [dir, to] of Object.entries(s.exits) as [Dir, SceneId][]) {
    const c = dir === 'west' ? 0 : COLS - 1;
    s.rows.forEach((_, r) => { if (walkable(s, c, r)) out.push({ tile: [c, r], to }); });
  }
  return out;
}

describe('scene maps', () => {
  it('have the required scenes, well-formed rows and defined tiles', () => {
    expect(Object.keys(SCENES).sort()).toEqual(['church', 'churchyard', 'cottage', 'fields', 'green', 'manor', 'woods']);
    for (const s of Object.values(SCENES)) {
      expect(s.rows).toHaveLength(s.outdoor ? 6 : 8);
      for (const row of s.rows) {
        expect(row).toHaveLength(COLS);
        for (const ch of row) {
          const t = s.legend[ch];
          expect(t, `${s.id} '${ch}'`).toBeDefined();
          const name = t!.sprite.replace(/^anim:/, '');
          expect(SPRITES[name] ?? ANIMS[name], `${s.id} ${name}`).toBeDefined();
        }
      }
      for (const n of s.npcs) expect(ANIMS[`${n.who}.idle`], n.who).toBeDefined();
    }
  });
  it('has cottage hearth/bed/pot/door, green cottages/well/alehouse, church inside and out, fields, manor gate, barrow and fairy ring', () => {
    const has = (id: SceneId, sprite: string) => Object.values(SCENES[id].legend).some((t) => t.sprite.endsWith(sprite) && SCENES[id].rows.join('').includes(Object.entries(SCENES[id].legend).find(([, v]) => v === t)![0]));
    expect(['hearth', 'bed.l', 'pot', 'doorIn'].every((t) => has('cottage', t))).toBe(true);
    expect(['thatch', 'well', 'sign', 'door'].every((t) => has('green', t))).toBe(true);
    expect(['churchDoor', 'stained', 'towerTop'].every((t) => has('churchyard', t))).toBe(true);
    expect(['altar', 'pew', 'candle', 'rood'].every((t) => has('church', t))).toBe(true);
    expect(has('manor', 'gate') && has('manor', 'pillar')).toBe(true);
    expect(['barrow.door', 'fairyRing', 'standingStone'].every((t) => has('woods', t))).toBe(true);
    expect(SCENES.fields.rows.join('').match(/[123]/g)!.length).toBeGreaterThan(10);
  });
});

describe('acceptance 3: all scenes are reachable and connected', () => {
  it('every scene is reachable from the cottage', () => {
    const seen = new Set<SceneId>(['cottage']);
    const q: SceneId[] = ['cottage'];
    while (q.length) for (const p of portals(SCENES[q.pop()!])) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); }
    expect([...seen].sort()).toEqual(Object.keys(SCENES).sort());
  });
  it('edge exits are two-way and line up on walkable ground', () => {
    for (const s of Object.values(SCENES)) {
      for (const [dir, to] of Object.entries(s.exits) as [Dir, SceneId][]) {
        const other = SCENES[to];
        expect(other.exits[OPPOSITE[dir]], `${s.id} ${dir} -> ${to}`).toBe(s.id);
        const c = dir === 'west' ? 0 : COLS - 1;
        const oc = dir === 'west' ? COLS - 1 : 0;
        const rows = s.rows.map((_, r) => r).filter((r) => walkable(s, c, r) && walkable(other, oc, r));
        expect(rows.length, `${s.id} ${dir}: no shared walkable row`).toBeGreaterThan(0);
      }
    }
  });
  it('doors lead to walkable ground, and back', () => {
    for (const s of Object.values(SCENES)) {
      for (const p of portals(s).filter((x) => tileAt(s, ...x.tile)!.door)) {
        const d = tileAt(s, ...p.tile)!.door!;
        expect(walkable(SCENES[d.to], d.col, d.row), `${s.id} door -> ${d.to}`).toBe(true);
        expect(portals(SCENES[d.to]).some((q) => q.to === s.id), `${d.to} has no way back to ${s.id}`).toBe(true);
      }
    }
  });
  it('within each scene, every entrance and exit can reach every other on foot', () => {
    for (const s of Object.values(SCENES)) {
      const ps = portals(s);
      const start = ps[0]!.tile;
      const area = flood(s, ...start);
      for (const p of ps) expect(area.has(p.tile.join(',')), `${s.id}: ${p.tile} cut off`).toBe(true);
    }
  });
  it('every sim location has a scene and something to act on there', () => {
    for (const loc of Object.keys(SCENE_OF) as (keyof typeof SCENE_OF)[]) {
      const s = SCENES[SCENE_OF[loc]];
      const tileSpot = Object.values(s.legend).some((t) => t.hotspot === loc);
      expect(tileSpot || s.ambient === loc, loc).toBe(true);
    }
    // ...and every action's location exists in the world.
    for (const a of Object.values(ACTIONS)) if (a.location !== 'any') expect(SCENE_OF[a.location]).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { DMG, PALETTE, PLAGUE, SEASON_REMAPS, TIME_REMAPS, worldRemap } from '../palette';
import { ANIMS, BODY_VARIANTS, SPRITES, VILLAGER_TYPES } from './index';

describe('acceptance 7: no colour outside the palette', () => {
  it('every sprite is made only of palette indices 0-f or transparency', () => {
    const bad: string[] = [];
    for (const [id, rows] of Object.entries(SPRITES)) for (const r of rows) if (!/^[0-9a-f.]+$/.test(r)) bad.push(`${id}: ${r}`);
    expect(bad).toEqual([]);
    expect(PALETTE).toHaveLength(16);
  });
  it('every remap maps palette indices to palette indices', () => {
    const all = [...Object.values(SEASON_REMAPS), PLAGUE, DMG, ...TIME_REMAPS, worldRemap('autumn', true, 5, true)];
    for (const r of all) {
      expect(r).toHaveLength(16);
      for (const v of r) expect(v).toBeLessThan(16);
    }
  });
});

describe('sprite data is well formed', () => {
  it('rows of each frame are equal width; characters, people, animals and tiles are 16x16', () => {
    for (const [id, rows] of Object.entries(SPRITES)) {
      const w = rows[0]!.length;
      expect(rows.every((r) => r.length === w), `${id} ragged`).toBe(true);
      if (/^(peasant|tile|wife|child|elder|priest|reeve|steward|lord|smith|shepherd|goodwife|beggar|hen|pig|cow|ox|blackDog)\./.test(id)) {
        expect([w, rows.length], id).toEqual([16, 16]);
      }
    }
  });
  it('animation frames all exist and differ from one another', () => {
    for (const [id, a] of Object.entries(ANIMS)) {
      expect(a.frames.length, id).toBeGreaterThanOrEqual(2);
      for (const f of a.frames) expect(SPRITES[f], f).toBeDefined();
      expect(SPRITES[a.frames[0]!]!.join(), `${id} frames identical`).not.toBe(SPRITES[a.frames[1]!]!.join());
    }
  });
});

describe('acceptance 1: every sprite, variant and animation exists', () => {
  it('peasant: 4-direction walk (2 frames), idle, work, eat, sleep, pray in all 7 body states', () => {
    expect(BODY_VARIANTS).toEqual(['stout', 'healthy', 'thin', 'gaunt', 'skeletal', 'sick', 'cold']);
    for (const v of BODY_VARIANTS) {
      for (const d of ['down', 'up', 'left', 'right']) expect(ANIMS[`peasant.${v}.walk.${d}`]?.frames).toHaveLength(2);
      for (const a of ['idle', 'work', 'eat', 'sleep', 'pray']) expect(ANIMS[`peasant.${v}.${a}`], `${v} ${a}`).toBeDefined();
    }
  });
  it('body states look different from healthy', () => {
    const healthy = SPRITES['peasant.healthy.idle.0']!.join();
    for (const v of BODY_VARIANTS.filter((x) => x !== 'healthy')) expect(SPRITES[`peasant.${v}.idle.0`]!.join(), v).not.toBe(healthy);
  });
  it('wife, child, elder, priest, reeve, steward, lord and 4 villager types each have idle and walk', () => {
    expect(VILLAGER_TYPES).toHaveLength(4);
    for (const who of ['wife', 'child', 'elder', 'priest', 'reeve', 'steward', 'lord', ...VILLAGER_TYPES]) {
      expect(ANIMS[`${who}.idle`], who).toBeDefined();
      expect(ANIMS[`${who}.walk`], who).toBeDefined();
    }
  });
  it('livestock (hens, pig, cow, ox) and the black dog', () => {
    for (const a of ['hen', 'pig', 'cow', 'ox', 'blackDog']) {
      expect(ANIMS[`${a}.idle`], a).toBeDefined();
      expect(ANIMS[`${a}.walk`], a).toBeDefined();
    }
  });
  it('scene tiles: hearth, bed, pot, door, well, alehouse, church, crops, manor gate, woods, barrow, fairy ring', () => {
    for (const t of [
      'hearth.0', 'bed.l', 'bed.r', 'pot', 'doorIn', 'door', 'well', 'sign', 'thatch', 'daub', 'stone', 'churchDoor', 'stained',
      'pew', 'altar', 'rood', 'soil', 'crop.sprout', 'crop.growing', 'crop.ripe', 'crop.stubble', 'gate', 'pillar', 'manorWall',
      'tree', 'darkTree', 'barrow.l', 'barrow.door', 'barrow.r', 'fairyRing', 'standingStone',
    ]) expect(SPRITES[`tile.${t}`], t).toBeDefined();
  });
  it('sky: eight moon phases, clouds, silhouette, treeline', () => {
    for (let p = 0; p < 8; p++) expect(SPRITES[`moon.${p}`]).toBeDefined();
    expect(new Set(Array.from({ length: 8 }, (_, p) => SPRITES[`moon.${p}`]!.join())).size).toBe(8);
    for (const k of ['sky.silhouette', 'sky.treeline', 'sky.clouds.0', 'sky.clouds.1']) expect(SPRITES[k]).toBeDefined();
  });
});

describe('atlas', () => {
  it('packs every sprite without overlap and reproduces its pixels', async () => {
    const { ATLAS, atlasRgba } = await import('../atlas');
    const { IDENTITY } = await import('../palette');
    const names = Object.keys(SPRITES);
    expect(ATLAS.names.length).toBe(names.length);
    const used = new Uint8Array(ATLAS.w * ATLAS.h);
    ATLAS.names.forEach((n, i) => {
      const [x, y, w, h] = ATLAS.rects.slice(i * 4, i * 4 + 4);
      for (let yy = y!; yy < y! + h!; yy++) for (let xx = x!; xx < x! + w!; xx++) {
        expect(used[yy * ATLAS.w + xx]).toBe(0);
        used[yy * ATLAS.w + xx] = 1;
      }
      const rows = SPRITES[n]!;
      const c = rows[3]?.[5];
      if (c && c !== '.') expect(ATLAS.idx[(y! + 3) * ATLAS.w + x! + 5]).toBe(parseInt(c, 16));
    });
    const rgba = atlasRgba(ATLAS, IDENTITY);
    expect(rgba.length).toBe(ATLAS.w * ATLAS.h * 4);
  });
});

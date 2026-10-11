import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SaveManager } from './saveManager';
import { SCHEMA_VERSION, SaveError, exportSave, importSave, loadSave, migrate, newSave } from './schema';

describe('migrations', () => {
  const registry = {
    1: (s: Record<string, unknown>) => ({ ...s, schema: 2, added: true }),
    2: (s: Record<string, unknown>) => ({ ...s, schema: 3, added: 'again' }),
  };
  it('chains migrations up to the target', () => {
    expect(migrate({ schema: 1 }, 3, registry)).toEqual({ schema: 3, added: 'again' });
  });
  it('rejects missing steps, future versions and junk', () => {
    expect(() => migrate({ schema: 1 }, 4, registry)).toThrow(SaveError);
    expect(() => migrate({ schema: 9 }, 3, registry)).toThrow(/newer/);
    expect(() => migrate('nope', 3, registry)).toThrow(SaveError);
    expect(() => migrate({}, 3, registry)).toThrow(SaveError);
  });
  it('migrates a real Phase 1 (schema 1) save to the current schema', () => {
    const v1 = {
      schema: 1, savedAt: 500,
      settings: { textSpeed: 'fast', sound: false, scanlines: true, dmg: false },
      sim: { seed: 77, rngState: 77, startedAt: 400, processedTo: 400, blocks: 0 },
    };
    const s = loadSave(v1);
    expect(s.schema).toBe(SCHEMA_VERSION);
    expect(s.settings.textSpeed).toBe('fast');
    expect(s.sim.seed).toBe(77);
    expect(s.sim.anchorMs).toBe(400);
    expect(s.sim.version).toBe(3);
    expect(s.seenBlock).toBe(0);
  });
  it('migrates a Phase 3 (schema 3, sim v2) life: household kept, village peopled, onboarding skipped', () => {
    const cur = newSave(9, 10).sim;
    const v2sim: Record<string, unknown> = {
      ...cur,
      version: 2,
      block: 600,
      members: cur.members.slice(0, 2).map((m) => ({ id: m.id, name: m.name, role: m.role, alive: true, body: m.body })),
      wealth: { ...cur.wealth, grain: 33 },
    };
    for (const k of ['familyName', 'generation', 'village', 'rumours', 'station', 'family', 'dark', 'plague', 'lordGrip', 'wageMult', 'lastHarvest', 'hallmote', 'chronicle', 'doom']) delete v2sim[k];
    const v3 = { schema: 3, savedAt: 1, settings: newSave(1, 1).settings, sim: v2sim, seenBlock: 500 };
    const s = loadSave(v3);
    expect(s.schema).toBe(SCHEMA_VERSION);
    expect(s.sim.version).toBe(3);
    expect(s.sim.block).toBe(600);
    expect(s.sim.wealth.grain).toBe(33);
    expect(s.sim.members.map((m) => [m.name, m.role, m.sex])).toEqual([[cur.members[0]!.name, 'peasant', 'm'], [cur.members[1]!.name, 'spouse', 'f']]);
    expect(s.sim.village).toHaveLength(15);
    expect(s.sim.chronicle).toHaveLength(1);
    expect(s.onboarded).toBe(true);
    expect(s.seenBlock).toBe(500);
  });
  it('migrates a schema 2 save, treating the log so far as read', () => {
    const v2 = { ...newSave(5, 10), schema: 2, sim: { ...newSave(5, 10).sim, block: 99 } } as Record<string, unknown>;
    delete v2.seenBlock;
    delete v2.onboarded;
    delete v2.tutorial;
    expect(loadSave(v2).seenBlock).toBe(99);
  });
  it('migrates a Phase 4 (schema 4) save: empty queue, axe on the belt, DMG kept unlocked if it was on', () => {
    const v4 = { ...newSave(7, 10), schema: 4 } as Record<string, unknown>;
    delete v4.belt;
    delete v4.queue;
    delete v4.dmgUnlocked;
    const s = loadSave({ ...v4, settings: { ...newSave(7, 10).settings, dmg: true } });
    expect(s.schema).toBe(SCHEMA_VERSION);
    expect(s.belt).toBe('axe');
    expect(s.queue).toEqual([]);
    expect(s.dmgUnlocked).toBe(true);
    expect(loadSave(v4).dmgUnlocked).toBe(false);
  });
  it('rejects a migration that forgets to bump the schema', () => {
    expect(() => migrate({ schema: 1 }, 2, { 1: (s) => s })).toThrow(/did not produce/);
  });
});

describe('export/import', () => {
  it('round-trips', () => {
    const s = newSave(123, 1000, { textSpeed: 'fast', sound: false, scanlines: true, dmg: true });
    expect(importSave(exportSave(s))).toEqual(s);
    expect(s.schema).toBe(SCHEMA_VERSION);
  });
  it('rejects malformed saves', () => {
    expect(() => importSave('{')).toThrow(SaveError);
    const bad = { ...newSave(1, 1), settings: { textSpeed: 'warp', sound: 1 } };
    expect(() => loadSave(bad)).toThrow(SaveError);
  });
});

describe('SaveManager', () => {
  it('persists settings across reopen and keeps them on wipe', async () => {
    const factory = new IDBFactory();
    const a = await SaveManager.open(1, 10, factory);
    a.data.settings.scanlines = true;
    await a.save(20);
    const b = await SaveManager.open(2, 30, factory);
    expect(b.data.settings.scanlines).toBe(true);
    expect(b.data.sim.seed).toBe(1);
    await b.wipe(5, 40);
    const c = await SaveManager.open(3, 50, factory);
    expect(c.data.sim.seed).toBe(5);
    expect(c.data.settings.scanlines).toBe(true);
  });
});

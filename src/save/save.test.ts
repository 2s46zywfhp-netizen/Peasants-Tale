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
    expect(s.sim.version).toBe(2);
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

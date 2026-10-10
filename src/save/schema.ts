import { createSim, type SimState } from '../sim/sim';

export const SCHEMA_VERSION = 1;

export type TextSpeed = 'slow' | 'normal' | 'fast';

export interface Settings {
  textSpeed: TextSpeed;
  sound: boolean;
  scanlines: boolean;
  dmg: boolean;
}

export interface SaveData {
  schema: number;
  savedAt: number;
  settings: Settings;
  sim: SimState;
}

export const DEFAULT_SETTINGS: Settings = { textSpeed: 'normal', sound: true, scanlines: false, dmg: false };

export function newSave(seed: number, now: number, settings: Settings = DEFAULT_SETTINGS): SaveData {
  return { schema: SCHEMA_VERSION, savedAt: now, settings: { ...settings }, sim: createSim(seed, now) };
}

/** migrations[n] upgrades a schema-n save to schema n+1. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
export type MigrationRegistry = Readonly<Record<number, Migration>>;

export const MIGRATIONS: MigrationRegistry = {
  // Add entries here when SCHEMA_VERSION is bumped, e.g. 1: (s) => ({ ...s, schema: 2, newField: x }).
};

export class SaveError extends Error {}

export function migrate(
  raw: unknown,
  target: number = SCHEMA_VERSION,
  registry: MigrationRegistry = MIGRATIONS,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) throw new SaveError('not an object');
  let data = raw as Record<string, unknown>;
  const found = data.schema;
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 1) throw new SaveError('missing schema version');
  let v = found;
  if (v > target) throw new SaveError(`save is from a newer version (${v})`);
  while (v < target) {
    const step = registry[v];
    if (!step) throw new SaveError(`no migration from schema ${v}`);
    data = step(data);
    if (data.schema !== v + 1) throw new SaveError(`migration ${v} did not produce schema ${v + 1}`);
    v = v + 1;
  }
  return data;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function validate(data: Record<string, unknown>): SaveData {
  const s = data.settings as Record<string, unknown> | undefined;
  const sim = data.sim as Record<string, unknown> | undefined;
  if (!s || !sim) throw new SaveError('missing settings or sim');
  if (!['slow', 'normal', 'fast'].includes(s.textSpeed as string)) throw new SaveError('bad textSpeed');
  for (const k of ['sound', 'scanlines', 'dmg']) if (typeof s[k] !== 'boolean') throw new SaveError(`bad ${k}`);
  for (const k of ['seed', 'rngState', 'startedAt', 'processedTo', 'blocks'])
    if (!isNum(sim[k])) throw new SaveError(`bad sim.${k}`);
  if (!isNum(data.savedAt)) throw new SaveError('bad savedAt');
  return data as unknown as SaveData;
}

/** Load any stored or imported save: migrate to the current schema, then validate. */
export function loadSave(raw: unknown, registry: MigrationRegistry = MIGRATIONS): SaveData {
  return validate(migrate(raw, SCHEMA_VERSION, registry));
}

export function exportSave(save: SaveData): string {
  return JSON.stringify(save);
}

export function importSave(json: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new SaveError('not JSON');
  }
  return loadSave(raw);
}

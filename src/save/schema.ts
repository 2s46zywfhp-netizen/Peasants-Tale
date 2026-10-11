import { createLife, migrateSim, type SimState } from '../sim/sim';
import type { LifeOptions } from '../sim/state';
import type { ActionId } from '../sim/balance';

export const SCHEMA_VERSION = 5;

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
  /** The block up to which the player has read the log (the Parchment Log shows what came after). */
  seenBlock: number;
  /** The new life has been named and the intro seen. */
  onboarded: boolean;
  /** Index of the next first-day tutorial hint; past the end = finished. */
  tutorial: number;
  /** The tool on the belt (L cycles it): picks the work at a place and how it looks. */
  belt: BeltTool;
  /** Tasks queued with R, done one after another as each ends. */
  queue: QueuedTask[];
  /** The old four-shade screen, earned by keeping a life going (see DMG_UNLOCK_DAYS). */
  dmgUnlocked: boolean;
}

export const BELT_TOOLS = ['axe', 'hoe', 'sickle', 'flail', 'seedbag', 'ladle', 'bucket'] as const;
export type BeltTool = (typeof BELT_TOOLS)[number];
export interface QueuedTask {
  action: ActionId;
  param: string | null;
}

export const DEFAULT_SETTINGS: Settings = { textSpeed: 'normal', sound: true, scanlines: false, dmg: false };

export function newSave(seed: number, now: number, settings: Settings = DEFAULT_SETTINGS, names: LifeOptions = {}): SaveData {
  return { schema: SCHEMA_VERSION, savedAt: now, settings: { ...settings }, sim: createLife(seed, now, names), seenBlock: 0, onboarded: false, tutorial: 0, belt: 'axe', queue: [], dmgUnlocked: settings.dmg };
}

/** migrations[n] upgrades a schema-n save to schema n+1. */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
export type MigrationRegistry = Readonly<Record<number, Migration>>;

export const MIGRATIONS: MigrationRegistry = {
  // v1 (Phase 1) only had a placeholder block counter: start a real life from the same seed and start time.
  1: (s) => {
    const old = s.sim as { seed?: unknown; startedAt?: unknown } | undefined;
    const seed = typeof old?.seed === 'number' ? old.seed : 1;
    const startedAt = typeof old?.startedAt === 'number' ? old.startedAt : typeof s.savedAt === 'number' ? s.savedAt : 0;
    return { ...s, schema: 2, sim: createLife(seed, startedAt) };
  },
  // v3 (Phase 3) remembers how much of the log the player has seen; treat everything so far as read.
  2: (s) => ({ ...s, schema: 3, seenBlock: (s.sim as { block?: number } | undefined)?.block ?? 0 }),
  // v4 (Phase 4): the village, family and bloodline (sim v3); a life already under way skips onboarding.
  3: (s) => ({ ...s, schema: 4, sim: migrateSim(s.sim as Record<string, unknown>), onboarded: true, tutorial: 99 }),
  // Phase 5: the belt, the task queue, and DMG mode becoming something earned (kept if already on).
  4: (s) => ({ ...s, schema: 5, belt: 'axe', queue: [], dmgUnlocked: (s.settings as { dmg?: unknown } | undefined)?.dmg === true }),
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
  if (sim.version !== 3) throw new SaveError('bad sim.version');
  for (const k of ['seed', 'rng', 'anchorMs', 'lastSimMs', 'block']) if (!isNum(sim[k])) throw new SaveError(`bad sim.${k}`);
  for (const k of ['members', 'fields', 'log', 'tags', 'village', 'rumours', 'chronicle']) if (!Array.isArray(sim[k])) throw new SaveError(`bad sim.${k}`);
  for (const k of ['soul', 'standing', 'wealth', 'obligations', 'habits', 'station', 'family', 'plague', 'hallmote', 'dark']) {
    if (typeof sim[k] !== 'object' || sim[k] === null) throw new SaveError(`bad sim.${k}`);
  }
  if (!isNum(data.savedAt)) throw new SaveError('bad savedAt');
  if (!isNum(data.seenBlock)) throw new SaveError('bad seenBlock');
  if (typeof data.onboarded !== 'boolean' || !isNum(data.tutorial)) throw new SaveError('bad onboarding flags');
  if (!BELT_TOOLS.includes(data.belt as BeltTool)) throw new SaveError('bad belt');
  if (!Array.isArray(data.queue) || typeof data.dmgUnlocked !== 'boolean') throw new SaveError('bad queue or dmgUnlocked');
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

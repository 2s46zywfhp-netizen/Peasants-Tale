import { BACKUP_TABLES, type BackupTable, type NorthPrepDB } from './db';

/** Bump when the backup file layout changes, and add a step to MIGRATIONS. */
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_APP_ID = 'northprep';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  exportedAt: string;
  tables: Partial<Record<BackupTable, unknown[]>>;
}

/** Blobs are not JSON; they travel as this marker object. */
interface EncodedBlob {
  __blob: true;
  type: string;
  base64: string;
}

/**
 * Upgrades an older backup to the current format, one version at a time.
 * MIGRATIONS[n] turns a version-n file into version n+1.
 */
const MIGRATIONS: Record<number, (file: BackupFile) => BackupFile> = {};

export class BackupError extends Error {}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function encodeValue(value: unknown): Promise<unknown> {
  if (value instanceof Blob) {
    const bytes = new Uint8Array(await value.arrayBuffer());
    const enc: EncodedBlob = { __blob: true, type: value.type, base64: bytesToBase64(bytes) };
    return enc;
  }
  if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encodeValue(v);
    return out;
  }
  return value;
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeValue);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.__blob === true && typeof obj.base64 === 'string') {
      const bytes = base64ToBytes(obj.base64);
      return new Blob([bytes], { type: typeof obj.type === 'string' ? obj.type : '' });
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = decodeValue(v);
    return out;
  }
  return value;
}

/** Reads every table into a plain JSON-safe object. */
export async function createBackup(database: NorthPrepDB, now: Date = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const name of BACKUP_TABLES) {
    const rows = await database.table(name).toArray();
    tables[name] = (await encodeValue(rows)) as unknown[];
  }
  return { app: BACKUP_APP_ID, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), tables };
}

/** Checks shape and upgrades old formats. Throws BackupError with a readable message. */
export function parseBackup(input: unknown): BackupFile {
  if (!input || typeof input !== 'object') throw new BackupError('File is not a NorthPrep backup.');
  const file = input as Partial<BackupFile>;
  if (file.app !== BACKUP_APP_ID) throw new BackupError('File is not a NorthPrep backup.');
  if (typeof file.formatVersion !== 'number' || !Number.isInteger(file.formatVersion) || file.formatVersion < 1) {
    throw new BackupError('Backup has no valid format version.');
  }
  if (file.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      `Backup was made by a newer NorthPrep (format ${file.formatVersion}). Update the app, then restore.`,
    );
  }
  if (!file.tables || typeof file.tables !== 'object') throw new BackupError('Backup has no data tables.');
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) throw new BackupError(`Unknown table "${name}".`);
    if (!Array.isArray(rows)) throw new BackupError(`Table "${name}" is not a list.`);
  }
  let current = file as BackupFile;
  while (current.formatVersion < BACKUP_FORMAT_VERSION) {
    const step = MIGRATIONS[current.formatVersion];
    if (!step) throw new BackupError(`No upgrade path from format ${current.formatVersion}.`);
    current = step(current);
  }
  return current;
}

export type RestoreMode = 'replace' | 'merge';

export interface RestoreResult {
  counts: Partial<Record<BackupTable, number>>;
}

/**
 * Writes a backup into the database in one transaction (all or nothing).
 * replace: wipes each table first. merge: upserts rows by primary key.
 */
export async function restoreBackup(
  database: NorthPrepDB,
  input: unknown,
  mode: RestoreMode = 'replace',
): Promise<RestoreResult> {
  const file = parseBackup(input);
  const counts: RestoreResult['counts'] = {};
  const tables = BACKUP_TABLES.map((n) => database.table(n));
  await database.transaction('rw', tables, async () => {
    for (const name of BACKUP_TABLES) {
      const rows = file.tables[name];
      if (!rows) continue;
      const table = database.table(name);
      if (mode === 'replace') await table.clear();
      await table.bulkPut(decodeValue(rows) as object[]);
      counts[name] = rows.length;
    }
  });
  return { counts };
}

export function backupFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `northprep-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// @vitest-environment node
// Node has a native Blob that IndexedDB clones correctly; jsdom's does not.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NorthPrepDB } from './db';
import { BACKUP_FORMAT_VERSION, BackupError, backupFileName, createBackup, parseBackup, restoreBackup } from './backup';

let n = 0;
let a: NorthPrepDB;
let b: NorthPrepDB;
const now = '2026-11-06T12:00:00.000Z';

beforeEach(async () => {
  a = new NorthPrepDB(`test-a-${n}`);
  b = new NorthPrepDB(`test-b-${n++}`);
  await a.open();
  await b.open();
});
afterEach(async () => {
  await a.delete();
  await b.delete();
});

async function seed(database: NorthPrepDB) {
  await database.settings.put({ key: 'theme', value: 'red' });
  await database.locationProfiles.add({ name: 'Home', postalCode: 'P3E 2C6', lat: 46.49, lon: -80.99, createdAt: now, updatedAt: now });
  await database.inventory.add({ name: 'Rolled oats', category: 'grains', quantity: 20, unit: 'kg', expiresOn: '2030-01-01', createdAt: now, updatedAt: now });
  const attId = await database.attachments.add({
    name: 'pin.jpg',
    type: 'image/jpeg',
    blob: new Blob([new Uint8Array([0, 1, 2, 250, 255])], { type: 'image/jpeg' }),
    createdAt: now,
  });
  await database.journal.add({
    date: '2026-11-06', type: 'water', title: 'Spring', body: 'Cold spring, north slope',
    tags: ['water', 'spring'], lat: 46.5, lon: -81, attachmentIds: [attId], createdAt: now, updatedAt: now,
  });
}

describe('backup', () => {
  it('round-trips every table, including binary photos, through JSON text', async () => {
    await seed(a);
    const text = JSON.stringify(await createBackup(a, new Date(now)));
    const result = await restoreBackup(b, JSON.parse(text));

    expect(result.counts).toEqual({ settings: 1, locationProfiles: 1, inventory: 1, journal: 1, attachments: 1 });
    expect(await b.inventory.toArray()).toEqual(await a.inventory.toArray());
    expect(await b.journal.toArray()).toEqual(await a.journal.toArray());
    expect((await b.settings.get('theme'))?.value).toBe('red');

    const att = (await b.attachments.toArray())[0];
    expect(att.blob).toBeInstanceOf(Blob);
    expect(att.blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await att.blob.arrayBuffer())]).toEqual([0, 1, 2, 250, 255]);
  });

  it('stamps app id, format version and export time', async () => {
    const file = await createBackup(a, new Date(now));
    expect(file.app).toBe('northprep');
    expect(file.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(file.exportedAt).toBe(now);
  });

  it('replace mode wipes existing data', async () => {
    await seed(a);
    const backup = await createBackup(a);
    await b.inventory.add({ name: 'Old item', category: 'misc', quantity: 1, unit: 'ea', createdAt: now, updatedAt: now });
    await b.inventory.add({ name: 'Old item 2', category: 'misc', quantity: 1, unit: 'ea', createdAt: now, updatedAt: now });
    await restoreBackup(b, backup, 'replace');
    expect((await b.inventory.toArray()).map((i) => i.name)).toEqual(['Rolled oats']);
  });

  it('merge mode keeps rows not in the backup and overwrites matching ids', async () => {
    await seed(a);
    const backup = await createBackup(a);
    await b.inventory.put({ id: 1, name: 'Will be overwritten', category: 'misc', quantity: 1, unit: 'ea', createdAt: now, updatedAt: now });
    await b.inventory.put({ id: 99, name: 'Kept', category: 'misc', quantity: 1, unit: 'ea', createdAt: now, updatedAt: now });
    await restoreBackup(b, backup, 'merge');
    expect((await b.inventory.toArray()).map((i) => i.name).sort()).toEqual(['Kept', 'Rolled oats']);
  });

  it('rejects files that are not NorthPrep backups', () => {
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup({ foo: 1 })).toThrow(/not a NorthPrep backup/);
    expect(() => parseBackup({ app: 'northprep', formatVersion: 1 })).toThrow(/no data tables/);
    expect(() => parseBackup({ app: 'northprep', formatVersion: 1, tables: { bogus: [] } })).toThrow(/Unknown table/);
    expect(() => parseBackup({ app: 'northprep', formatVersion: 1, tables: { inventory: {} } })).toThrow(/not a list/);
  });

  it('refuses backups from a newer app version instead of corrupting data', () => {
    expect(() => parseBackup({ app: 'northprep', formatVersion: BACKUP_FORMAT_VERSION + 1, tables: {} })).toThrow(/newer NorthPrep/);
  });

  it('leaves the database untouched when a restore fails part-way', async () => {
    await seed(b);
    const bad = { app: 'northprep', formatVersion: 1, tables: { settings: [{ key: 'x', value: 1 }], inventory: [{ id: 'not-a-number', name: 'bad' }, null] } };
    await expect(restoreBackup(b, bad, 'replace')).rejects.toThrow();
    expect(await b.inventory.count()).toBe(1);
    expect(await b.settings.get('x')).toBeUndefined();
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('northprep-backup-2026-01-05.json');
  });
});

import Dexie, { type Table } from 'dexie';
import type { Attachment, InventoryItem, JournalEntry, LocationProfile, Setting } from './types';

/**
 * IndexedDB schema. To change it, add a new `this.version(n)` block below the
 * old ones (never edit an old one) and add an `.upgrade()` if data must move.
 */
export class NorthPrepDB extends Dexie {
  settings!: Table<Setting, string>;
  locationProfiles!: Table<LocationProfile, number>;
  inventory!: Table<InventoryItem, number>;
  journal!: Table<JournalEntry, number>;
  attachments!: Table<Attachment, number>;

  constructor(name = 'northprep') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      locationProfiles: '++id, name',
      inventory: '++id, category, expiresOn, name',
      journal: '++id, date, type, *tags',
      attachments: '++id, createdAt',
    });
  }
}

/** Table names included in backups, in restore order. */
export const BACKUP_TABLES = ['settings', 'locationProfiles', 'inventory', 'journal', 'attachments'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const db = new NorthPrepDB();

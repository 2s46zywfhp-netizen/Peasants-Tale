import Dexie, { type Table } from 'dexie';
import type { Attachment, InventoryItem, JournalEntry, LocationProfile, Setting, UserGuideEntry } from './types';

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
  guideEntries!: Table<UserGuideEntry, number>;

  constructor(name = 'northprep') {
    super(name);
    this.version(1).stores({
      settings: 'key',
      locationProfiles: '++id, name',
      inventory: '++id, category, expiresOn, name',
      journal: '++id, date, type, *tags',
      attachments: '++id, createdAt',
    });
    // v2: inventory lots link to generated targets.
    this.version(2).stores({
      inventory: '++id, category, expiresOn, name, targetId',
    });
    // v3: user field-guide entries; photos linked to guide entries or journal entries.
    this.version(3).stores({
      attachments: '++id, createdAt, ref',
      guideEntries: '++id, section, title',
    });
  }
}

/** Table names included in backups, in restore order. */
export const BACKUP_TABLES = ['settings', 'locationProfiles', 'inventory', 'journal', 'attachments', 'guideEntries'] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const db = new NorthPrepDB();

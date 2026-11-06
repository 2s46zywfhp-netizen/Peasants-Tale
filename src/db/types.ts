/** Shapes of everything stored in IndexedDB. Later phases extend these. */

export type ThemeName = 'light' | 'dark' | 'red';

export interface Setting {
  key: string;
  value: unknown;
}

export interface LocationProfile {
  id?: number;
  name: string;
  postalCode?: string;
  lat?: number;
  lon?: number;
  /** Derived climate values are filled in by Phase 2. */
  climate?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id?: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiresOn?: string;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id?: number;
  date: string;
  type: 'general' | 'foraging' | 'harvest' | 'hunt-fish' | 'water' | 'cache' | 'garden';
  title: string;
  body: string;
  tags: string[];
  lat?: number;
  lon?: number;
  attachmentIds: number[];
  createdAt: string;
  updatedAt: string;
}

/** Binary files (photos). Stored as Blobs; encoded as base64 in backups. */
export interface Attachment {
  id?: number;
  name: string;
  type: string;
  blob: Blob;
  /** For CC/public-domain images: author, licence, source URL. */
  attribution?: string;
  createdAt: string;
}

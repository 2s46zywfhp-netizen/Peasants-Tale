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
  /** Target group: Food, Water, Supplies, Ammo, or Other. */
  category: string;
  quantity: number;
  unit: string;
  /** Links this lot to a generated target, e.g. "food:white-rice". */
  targetId?: string;
  acquiredOn?: string; // YYYY-MM-DD
  expiresOn?: string; // YYYY-MM-DD
  location?: string;
  barcode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type JournalType = 'general' | 'foraging' | 'harvest' | 'hunt-fish' | 'water' | 'cache' | 'garden';

export interface Sealed {
  salt: string;
  iv: string;
  data: string;
}

export interface JournalEntry {
  id?: number;
  date: string; // YYYY-MM-DDTHH:mm (local)
  type: JournalType;
  title: string;
  body: string;
  tags: string[];
  lat?: number;
  lon?: number;
  attachmentIds: number[];
  weather?: { tempC?: number; conditions?: string; wind?: string };
  garden?: { event: 'planting' | 'harvest' | 'frost' | 'seed-saved'; crop: string; qty?: number; unit?: string };
  /** PIN-locked cache: title, body, tags and location are encrypted here and blanked above. */
  locked?: Sealed;
  createdAt: string;
  updatedAt: string;
}

/** A field-guide entry the user added or imported from a PDF. */
export interface UserGuideEntry {
  id?: number;
  section: string;
  title: string;
  latin?: string;
  edibility?: 'edible' | 'edible-caution' | 'medicinal' | 'toxic' | 'deadly' | '';
  body: string;
  lookalikesText?: string;
  practiceRequired?: boolean;
  source?: string;
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
  /** What the photo belongs to, e.g. "guide:cattail" or "journal:12". */
  ref?: string;
  createdAt: string;
}

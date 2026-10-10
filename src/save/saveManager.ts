import { KvDb } from './db';
import { SaveError, loadSave, newSave, type SaveData } from './schema';

const DB_NAME = 'peasants-life';
const KEY = 'save';

/** Owns the current save and persists it to IndexedDB. */
export class SaveManager {
  private constructor(
    private db: KvDb,
    public data: SaveData,
  ) {}

  static async open(seed: number, now: number, factory?: IDBFactory): Promise<SaveManager> {
    const db = await KvDb.open(DB_NAME, factory);
    const raw = await db.get<unknown>(KEY);
    let data: SaveData;
    if (raw === undefined) {
      data = newSave(seed, now);
    } else {
      try {
        data = loadSave(raw);
      } catch (e) {
        if (!(e instanceof SaveError)) throw e;
        // Keep the unreadable save around rather than destroying it silently.
        await db.put(`${KEY}.corrupt.${now}`, raw);
        data = newSave(seed, now);
      }
    }
    const mgr = new SaveManager(db, data);
    await mgr.save(now);
    return mgr;
  }

  save(now: number): Promise<void> {
    this.data = { ...this.data, savedAt: now };
    return this.db.put(KEY, this.data);
  }

  replace(data: SaveData, now: number): Promise<void> {
    this.data = data;
    return this.save(now);
  }

  /** Starts a new life but keeps the player's settings. */
  wipe(seed: number, now: number): Promise<void> {
    return this.replace(newSave(seed, now, this.data.settings), now);
  }
}

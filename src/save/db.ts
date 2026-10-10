/** Minimal promise wrapper around a single IndexedDB key/value object store. */
const STORE = 'kv';

export class KvDb {
  private constructor(private db: IDBDatabase) {}

  static open(name: string, factory: IDBFactory = indexedDB): Promise<KvDb> {
    return new Promise((resolve, reject) => {
      const req = factory.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(new KvDb(req.result));
      req.onerror = () => reject(req.error);
    });
  }

  private tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  get<T>(key: string): Promise<T | undefined> {
    return this.tx('readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
  }
  async put(key: string, value: unknown): Promise<void> {
    await this.tx('readwrite', (s) => s.put(value, key));
  }
  async delete(key: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(key));
  }
  close(): void {
    this.db.close();
  }
}

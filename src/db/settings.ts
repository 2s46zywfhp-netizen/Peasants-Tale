import { db, type NorthPrepDB } from './db';

export async function getSetting<T>(key: string, fallback: T, database: NorthPrepDB = db): Promise<T> {
  const row = await database.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown, database: NorthPrepDB = db): Promise<void> {
  await database.settings.put({ key, value });
}

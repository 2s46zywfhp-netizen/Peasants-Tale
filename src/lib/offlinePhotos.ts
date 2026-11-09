/** Downloads every bundled field-guide photo into the 'guide-images' cache so the guide works offline. */
import { guideImages } from '../calc/guide';

export const PHOTO_CACHE = 'guide-images';
const url = (file: string) => new URL(`${import.meta.env.BASE_URL}${file}`, location.origin).href;

export async function photoStatus(): Promise<{ saved: number; total: number }> {
  if (!('caches' in window)) return { saved: 0, total: guideImages.length };
  const c = await caches.open(PHOTO_CACHE);
  let saved = 0;
  for (const i of guideImages) if (await c.match(url(i.file))) saved++;
  return { saved, total: guideImages.length };
}

let running: Promise<void> | null = null;
export function savePhotosForOffline(onProgress?: (saved: number, total: number) => void): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!('caches' in window) || !navigator.onLine) return;
    const c = await caches.open(PHOTO_CACHE);
    let saved = 0;
    for (const i of guideImages) {
      const u = url(i.file);
      try {
        if (!(await c.match(u))) {
          const r = await fetch(u, { cache: 'reload' });
          if (r.ok) await c.put(u, r);
        }
        saved++;
      } catch {
        /* try again next time */
      }
      onProgress?.(saved, guideImages.length);
    }
  })().finally(() => (running = null));
  return running;
}

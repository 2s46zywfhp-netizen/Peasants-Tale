/**
 * Safety net for installed copies that get stuck on an old version (seen on iOS).
 * Compares this build with /version.json on the server. If they differ, asks the service worker
 * to update; if that hasn't worked after a short wait, removes the old app cache and reloads.
 * User data (IndexedDB) and saved map tiles and photos are never touched.
 */
const KEEP = ['map-tiles', 'guide-images'];

export async function checkForStaleApp(current: string) {
  if (!navigator.onLine || !('serviceWorker' in navigator)) return;
  let latest: string;
  try {
    latest = (await (await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })).json()).version;
  } catch {
    return;
  }
  if (!latest || latest === current) {
    sessionStorage.removeItem('np-repair');
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration();
  await reg?.update().catch(() => {});
  await new Promise((r) => setTimeout(r, 8000));
  // autoUpdate reloads the page when the new version activates; if we're still here, repair.
  if (sessionStorage.getItem('np-repair') === latest) return; // already tried once this session
  sessionStorage.setItem('np-repair', latest);
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
  location.reload();
}

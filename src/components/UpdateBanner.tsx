import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { savePhotosForOffline } from '../lib/offlinePhotos';
import { checkForStaleApp } from '../lib/selfUpdate';

/** Tells the user once the whole app is cached and safe to use without signal. */
export function UpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    // Check for a new version every time the app is opened or brought back, and hourly.
    // With autoUpdate, the page reloads itself once the new version is installed.
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) void reg.update().catch(() => {});
      };
      check();
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });
  const [photos, setPhotos] = useState('');
  useEffect(() => {
    void checkForStaleApp(__APP_VERSION__);
    // Fetch field-guide photos in the background once the app has loaded.
    const t = setTimeout(() => {
      void savePhotosForOffline((s, n) => setPhotos(s < n ? `Saving field-guide photos for offline: ${s}/${n}` : ''));
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  if (photos) return <div className="no-print mx-3 mt-2 text-sm text-muted" role="status">{photos}</div>;
  if (!offlineReady) return null;
  return (
    <div className="no-print m-3 flex items-center gap-3 rounded-lg border-2 border-ok p-3 font-bold text-ok" role="status">
      <span className="flex-1">Saved for offline use. NorthPrep now works with no signal.</span>
      <button type="button" className="btn" onClick={() => setOfflineReady(false)}>
        OK
      </button>
    </div>
  );
}

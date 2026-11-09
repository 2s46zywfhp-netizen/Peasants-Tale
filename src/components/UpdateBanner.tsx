import { useRegisterSW } from 'virtual:pwa-register/react';

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

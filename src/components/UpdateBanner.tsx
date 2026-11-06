import { useRegisterSW } from 'virtual:pwa-register/react';

/** Tells the user once the whole app is cached and safe to use without signal. */
export function UpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW();
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

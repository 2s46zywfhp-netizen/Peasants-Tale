=== PHASE 1 SPEC — Foundation ===
## Build
- Vite + TS strict, ESLint, Vitest.
- PWA: manifest, icons generated from a 16x16 pixel peasant head, service worker precaching all assets, full offline play, portrait lock, theme colour #0b0d14, apple-touch-icon, apple-mobile-web-app-capable, safe-area insets respected.
- Shell: Game Boy–style body filling the phone. Screen on top at the largest integer scale that fits. Below: D-pad (4-way), A, B, START, SELECT. Multi-touch. Held directions repeat. navigator.vibrate tick where supported; fail silently where not (iOS).
- Block pinch zoom, double-tap zoom, text selection, pull-to-refresh and the iOS long-press callout.
- Input layer maps buttons to actions; scenes subscribe to actions.
- Scene manager: push / pop / replace, with fade transitions.
- Bundle the "Press Start 2P" pixel font locally (OFL licence; record it in CREDITS.md).
- Title screen: "PEASANT'S LIFE", flickering candle, "PRESS START".
- Settings (SELECT on title): text speed, sound, scanlines, DMG 4-colour mode, export save (JSON to clipboard), import save, wipe save with confirmation.
- Save system: IndexedDB wrapper, schema version, migration registry, autosave on visibilitychange (hidden) and on every sim block.
- Deploy: netlify.toml (build command, publish dist, immutable cache headers for hashed assets, no-cache for sw.js and index.html). GitHub → Netlify auto-deploy on main.
## Acceptance
1. Installs to the iOS home screen and launches fullscreen portrait with no browser chrome.
2. Works in airplane mode after first load.
3. All 8 buttons respond with multi-touch; zoom, scroll and selection are impossible.
4. Pixel-perfect integer scaling on a 390px-wide phone.
5. Settings persist across reloads; save export/import round-trips.
6. Lighthouse PWA installability checks pass.
7. Live Netlify URL reported.

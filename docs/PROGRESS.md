# Progress
Current phase: 1
Resume point: Phase 1 implemented and deployed; only the real-iPhone check (criterion 1) remains.
## Checklist
- [ ] 1. Installs to the iOS home screen and launches fullscreen portrait with no browser chrome. (See Blocked.)
- [x] 2. Works in airplane mode after first load. (SW precaches all assets; offline reload verified in Chromium, locally and on the live URL.)
- [x] 3. All 8 buttons respond with multi-touch; zoom, scroll and selection are impossible. (8 simultaneous CDP touches all held locally; viewport locked, touch-action/user-select/overscroll/callout blocked. Netlify badge hidden in CSS so it no longer covers START on the live site.)
- [x] 4. Pixel-perfect integer scaling on a 390px-wide phone. (390px @3x: 960x864 backing = 6 device px per game px, device-pixel-aligned, 0 off-palette and 0 non-uniform pixels.)
- [x] 5. Settings persist across reloads; save export/import round-trips. (e2e: settings survive reload; export -> wipe -> import restores identical save; unit tests for migrations and round-trip.)
- [x] 6. Lighthouse PWA installability checks pass. (Lighthouse 11 PWA category score 100, installable-manifest PASS; Chrome Page.getInstallabilityErrors = [] on the live URL.)
- [x] 7. Live Netlify URL reported: https://peasants-life.netlify.app
## Blocked
- **1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

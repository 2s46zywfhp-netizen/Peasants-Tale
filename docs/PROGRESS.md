# Progress
Current phase: 5
Resume point: Phase 5 complete. Live at https://peasants-life.netlify.app (deploy 6acb8e254c2166be16de506f, ready; `e2e/verify.mjs` 28/28 against the live site).
## Checklist
- [x] 1. AUDIT.md lists all gaps found and every one is fixed or explained under Blocked. All 13 gaps fixed; see "Resolution" in docs/AUDIT.md.
- [x] 2. Crisp, even pixels at integer scale on all five viewports (verified by screenshot). `scripts/check-pixels.py docs/screenshots`: canvas exactly 256*scale x 224*scale device px and 0 stray device pixels inside it at all five (scale 2 at 375@2, 4 at the others); results in docs/screenshots/PIXELS.txt.
- [ ] 3. Pinch and double-tap zoom are impossible on iOS. Implemented (see Blocked for the device check).
- [x] 4. All 32 palette colours enforced by an automated test across every generated sprite sheet. src/render/sheets.test.ts (every pixel of every sheet) and src/palette.test.ts (source, CSS, HTML).
- [x] 5. Every sprite, animation, tile and scene from Phases 3 and 5 exists at the new resolution and appears in the Sprite Gallery. Gallery lists every animation, every still (layers aside) and all nine scenes; sheets.test checks the required set.
- [x] 6. Lighting, LUT seasons, weather, parallax and water all visibly working. docs/screenshots (dawn, midday, dusk, night, winter, rain, rooms); render.test.ts.
- [x] 7. Interaction prompts appear for every usable object. e2e/verify.mjs checks every object with a hotspot and every room spot.
- [x] 8. Existing saves load correctly after the update. Schema 4 -> 5 migration tested in save.test.ts; reload check in verify.mjs.
- [x] 9. 60fps on a mid-range phone; no per-frame allocations in the render loop. 60.0 fps with 4x CPU throttle (about 10 ms of work per frame) in the world, the cottage and an open menu (`e2e/perf.mjs fps 4`). Heap sampling finds no steady per-frame allocation: only text rebuilt once a second (the countdown) and sporadic engine noise. A real mid-range phone is not available here (see Blocked).
- [x] 10. Screenshots committed to docs/screenshots/; full test suite green; CHANGELOG updated. 5 viewports x 30 shots; 196/196 tests; docs/CHANGELOG.md.
## Blocked
- **Phase 5 #3 (zoom on iOS):** everything is in place, but it needs a check on a real iPhone, which the cloud container can't do:
  - `touch-action: none` on the page and the controls;
  - `gesturestart`/`gesturechange`/`gestureend` and `dblclick` prevented;
  - multi-finger `touchstart` prevented;
  - `user-scalable=no` with maximum-scale 1.

  Chromium emulation does not reproduce Safari's pinch handling. To check: open the site in Safari, pinch and double-tap on the screen, the bezel and the buttons.
- **Phase 5 #9 on a real phone:** 60 fps is measured under a 4x CPU throttle in Chromium as a stand-in. A real mid-range phone check is still owed.
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

# Progress
Current phase: 3
Resume point: All Phase 3 features committed (66e0a2e). Remaining: atmosphere unit test (criterion 4), browser verification of criteria 2-6 (scenes walk-through, gallery, FF-week Parchment Log, screenshots of season/time/weather/moon, heap-sampling + throttled fps), CREDITS note, full suite, push, Netlify check.
## Checklist
- [ ] 1. Every sprite, variant and animation above exists.
- [ ] 2. A Sprite Gallery debug screen shows all sprites and animations, cycling palettes.
- [ ] 3. All scenes are reachable and connected.
- [ ] 4. Seasons, day/night, weather and moon phase visibly change.
- [ ] 5. The Parchment Log correctly summarizes a debug fast-forward of 1 week.
- [ ] 6. 60fps on a mid-range phone; no per-frame allocations in the render loop.
- [ ] 7. No colour outside the palette (automated test that scans sprite data).
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

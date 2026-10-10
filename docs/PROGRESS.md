# Progress
Current phase: 4
Resume point: none
## Checklist
- [x] 1. Every system above is implemented and reachable in play. (Sim modules village, family, hallmote, station, dark, plague, bloodline; reachable via menus, the villager picker, manor hall, barrow, town and outlaw camp; e2e/phase4-verify.mjs 25/25.)
- [x] 2. Balance runs: simulate 2 game years for three playstyles (diligent, neglectful, fully absent). Write outcomes to docs/BALANCE.md. No starvation spiral for the diligent player, no money exploits, and neglect produces visible decline rather than instant death. (src/sim/balanceRuns.test.ts writes docs/BALANCE.md; src/sim/exploits.test.ts.)
- [x] 3. The 1348 plague sequence fires and resolves. (src/sim/plague.test.ts; seen in the Parchment Log in the browser.)
- [x] 4. Death → heir handoff works and the Chronicle records it. (src/sim/bloodline.test.ts; CHRONICLE page in the browser.)
- [x] 5. 60fps maintained; full test suite green. (60.0 fps at 1x/4x/6x CPU throttle, 0 bytes allocated per frame; 184 tests green.)
- [x] 6. Changelog written to docs/CHANGELOG.md.
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

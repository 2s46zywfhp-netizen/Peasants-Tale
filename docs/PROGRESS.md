# Progress
Current phase: 4
Resume point: none
## Checklist
- [ ] 1. Every system above is implemented and reachable in play.
- [ ] 2. Balance runs: simulate 2 game years for three playstyles (diligent, neglectful, fully absent). Write outcomes to docs/BALANCE.md. No starvation spiral for the diligent player, no money exploits, and neglect produces visible decline rather than instant death.
- [ ] 3. The 1348 plague sequence fires and resolves.
- [ ] 4. Death → heir handoff works and the Chronicle records it.
- [ ] 5. 60fps maintained; full test suite green.
- [ ] 6. Changelog written to docs/CHANGELOG.md.
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

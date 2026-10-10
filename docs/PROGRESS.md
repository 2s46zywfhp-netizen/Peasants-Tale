# Progress
Current phase: 2
Resume point: none
## Checklist
- [ ] 1. Determinism: same seed + same action sequence → identical state hash after 2 game years.
- [ ] 2. A 30-real-day catch-up runs in under 200ms (Node benchmark as proxy).
- [ ] 3. Late-feeding test: meals 2 blocks late every day for 8 game weeks → reserve reaches "thin".
- [ ] 4. Missed-mass test triggers the church court on schedule.
- [ ] 5. Easter dates for 1345–1400 match a published Julian Easter table.
- [ ] 6. Clock-rewind and over-cap tests pass.
- [ ] 7. Unit tests for every system; full suite green.
- [ ] 8. Playable with placeholder rendering: walk, eat, sleep, work, attend mass.
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

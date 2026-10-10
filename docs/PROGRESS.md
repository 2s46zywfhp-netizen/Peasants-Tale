# Progress
Current phase: 2
Resume point: Phase 2 complete and pushed; next is Phase 3 (await its spec).
## Checklist
- [x] 1. Determinism: same seed + same action sequence → identical state hash after 2 game years. (`src/sim/sim.test.ts`: a dutiful player acts every block for 730 days, twice; equal `stateHash`, still alive; a different seed differs. Autopilot also matches across advance granularities.)
- [x] 2. A 30-real-day catch-up runs in under 200ms (Node benchmark as proxy). (1260 blocks in ~20ms in the Vitest benchmark.)
- [x] 3. Late-feeding test: meals 2 blocks late every day for 8 game weeks → reserve reaches "thin". (Same dutiful routine both ways; on time = midday+dusk stays healthy, late = dusk+next dawn reaches thin; still healthy after 1 week.)
- [x] 4. Missed-mass test triggers the church court on schedule. (Misses on days 2, 9, 16 → summons on day 16 → court sits at dawn of day 23 → 3 Sundays of penance → absolution; 2 misses, or misses spread beyond 8 weeks, do not.)
- [x] 5. Easter dates for 1345–1400 match a published Julian Easter table. (Fixture built from the published Julian paschal-full-moon table by golden number, cross-checked against Cheney's Handbook of Dates (1288 → 28 Mar) and Meeus' published Julian dates 2008–2027; the sim uses Meeus' Julian computus. No year-by-year 1345–1400 list was reachable online; Cheney's printed table would be the direct check.)
- [x] 6. Clock-rewind and over-cap tests pass. (Rewind = no-op and acting stays in the current block; a 45-day jump runs exactly 1260 blocks, drops the rest, logs neglect once; exactly 30 days is not neglect.)
- [x] 7. Unit tests for every system; full suite green. (95 tests in 14 files: calendar, weather, body, farm, obligations/church, actions, events, habits/autopilot, engine, PRNG, saves incl. v1→v2 migration, input, scenes, palette.)
- [x] 8. Playable with placeholder rendering: walk, eat, sleep, work, attend mass. (Playwright on the production build at 390px: walked to the cottage and ate + slept, to the strips and worked (sowing labour recorded), to the church on Sunday morning and heard mass (no miss recorded); status pages and the SELECT+START debug panel (FF 1 week, trigger event) verified.)
## Blocked
- **Phase 1 #1 (iOS home screen):** needs a check on a real iPhone, which isn't possible from the cloud container. Everything it depends on is in place: apple-mobile-web-app-capable, black-translucent status bar, apple-touch-icon, viewport-fit=cover with safe-area padding, manifest display fullscreen/standalone and portrait. To check: Safari -> Share -> Add to Home Screen -> launch.

# Peasant's Life
Mobile-only portrait PWA. Game Boy–emulator-style life sim: a peasant in 1345 England lives in real time on the player's phone, even when the app is closed. Dark fantasy / folk horror tone.

## Rules
- Stack: Vite + TypeScript (strict) + canvas 2D. No game framework. Vitest for tests.
- /src/sim is pure TS: no DOM, no rendering, no Date.now() (time is passed in). Seeded PRNG (mulberry32) only; never Math.random.
- /src/render reads sim state only. /src/ui dispatches actions to the sim. /src/audio is Web Audio synthesis only.
- Internal resolution 160x144, integer-scaled, image smoothing off.
- Palette (the only colours allowed anywhere): #0b0d14 #141a2e #1f2d4a #2e5a6b #3f8a8c #e8e0c4 #8a9bb0 #4a5468 #8c2a2a #d4622a #5c1a1a #4a3326 #6b4a32 #3d5a3a #c9b99a #f2c14e
- All tunable numbers live in src/sim/balance.ts.
- Saves: IndexedDB, schema-versioned, with migrations.

## Workflow
- Each phase spec is saved in docs/spec/. Read only the current phase's spec. Never read node_modules, dist or lockfiles.
- Run only the tests for the module you changed; run the full suite once at phase end.
- Track every acceptance criterion in docs/PROGRESS.md. A phase is done only when every box is checked or listed under "Blocked" with a reason.
- If context runs low: commit, write an exact resume point in PROGRESS.md, and stop.
- Commit after each criterion group. Push at phase end and confirm the Netlify deploy is green.

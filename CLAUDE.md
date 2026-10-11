# Peasant's Life
Mobile-only portrait PWA. 16-bit handheld–style life sim: a peasant in 1345 England lives in real time on the player's phone, even when the app is closed. Dark fantasy / folk horror tone.

## Rules
- Stack: Vite + TypeScript (strict) + canvas 2D. No game framework. Vitest for tests.
- /src/sim is pure TS: no DOM, no rendering, no Date.now() (time is passed in). Seeded PRNG (mulberry32) only; never Math.random.
- /src/render reads sim state only. /src/ui dispatches actions to the sim. /src/audio is Web Audio synthesis only.
- Internal resolution 256x224 (SNES). Scaled in physical pixels: backing size = 256*scale x 224*scale with scale = floor(availableWidthCSS * devicePixelRatio / 256), CSS size = backing / devicePixelRatio, image smoothing off. Spare space goes to the handheld shell, never to stretched pixels.
- Palette: 32 colours in eight ramps (dark → light); the only colours allowed anywhere. Seasons, day/night and plague are palette LUTs, never tints. DMG mode stays as an unlockable 4-shade option.
  Night: #07080d #0b0d14 #141a2e #1f2d4a
  Teal: #1d3d47 #2e5a6b #3f8a8c #6cb5a8
  Bone/moon: #a89f86 #c9b99a #e8e0c4 #f7f2df
  Stone: #4a5468 #6b7689 #8a9bb0 #b4c0cf
  Blood: #3a1012 #5c1a1a #8c2a2a #b8432f
  Fire: #d4622a #ec8f3a #f2c14e #fbe39a
  Earth: #2e2019 #4a3326 #6b4a32 #8f6a46
  Moss: #1f3324 #3d5a3a #5f7f4a #8aa65c
- All tunable numbers live in src/sim/balance.ts.
- Saves: IndexedDB, schema-versioned, with migrations.

## Workflow
- Each phase spec is saved in docs/spec/. Read only the current phase's spec. Never read node_modules, dist or lockfiles.
- Run only the tests for the module you changed; run the full suite once at phase end.
- Track every acceptance criterion in docs/PROGRESS.md. A phase is done only when every box is checked or listed under "Blocked" with a reason.
- If context runs low: commit, write an exact resume point in PROGRESS.md, and stop.
- Commit after each criterion group. Push at phase end and confirm the Netlify deploy is green.

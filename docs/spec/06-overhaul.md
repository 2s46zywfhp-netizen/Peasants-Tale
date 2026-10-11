=== PHASE 6 SPEC — 16-bit overhaul, scaling, full audit ===

## Problems I've noticed
[FILL IN: e.g. "screen is small/blurry", "buttons too close together", "walking feels stiff", "can't tell what I can interact with"]

## Step 1 — Audit first
- Compare the current build against docs/spec/01 through 05. List every missing, broken or half-finished item in docs/AUDIT.md.
- Fix every item in AUDIT.md as part of this phase.
- The sim (/src/sim) is not rewritten. Only fix bugs found in the audit. Saves must keep working: add a migration if save shape changes.

## Step 2 — Resolution and scaling
- New internal resolution: 256x224 (SNES).
- Scale in PHYSICAL pixels: canvas backing size = 256*scale x 224*scale where scale = floor(availableWidthCSS * devicePixelRatio / 256). CSS size = backing size / devicePixelRatio. Smoothing off. This must produce crisp, even pixels on every phone.
- Recompute on resize, orientation change and visualViewport changes.
- Remaining space goes to the handheld shell bezel, never to stretched pixels.

## Step 3 — Handheld shell redesign
- Restyle as a 16-bit-era handheld: dark plastic, subtle texture, the game's palette.
- Buttons: D-pad, A, B, START, SELECT, plus L and R shoulders (L = cycle belt tool, R = open task queue).
- Minimum touch target 48x48 CSS px. Thumb-zone layout for one-handed and two-handed play. Visible press states and haptics where supported.
- Block pinch zoom and double-tap zoom on iOS with touch-action: none plus gesturestart/gesturechange preventDefault.

## Step 4 — Palette and lighting
- Replace the 16-colour palette with these 32 colours, organized as ramps (dark → light). Only these colours anywhere:
  Night: #07080d #0b0d14 #141a2e #1f2d4a
  Teal: #1d3d47 #2e5a6b #3f8a8c #6cb5a8
  Bone/moon: #a89f86 #c9b99a #e8e0c4 #f7f2df
  Stone: #4a5468 #6b7689 #8a9bb0 #b4c0cf
  Blood: #3a1012 #5c1a1a #8c2a2a #b8432f
  Fire: #d4622a #ec8f3a #f2c14e #fbe39a
  Earth: #2e2019 #4a3326 #6b4a32 #8f6a46
  Moss: #1f3324 #3d5a3a #5f7f4a #8aa65c
- Seasonal, day/night and plague looks done with palette lookup tables (LUTs), not tinting.
- Lighting system: per-pixel light level, applied by stepping colours down/up their ramp, with ordered dithering at light edges. Light sources: hearth, candles, rushlights, moon, lantern, fire. Moonlit nights must look like the reference mood (teal/navy with cream moonlight); fire must cast warm ember light.
- Keep DMG mode as an unlockable 4-shade option.

## Step 5 — Sprite pipeline (token-efficient)
- Do NOT hand-write full-colour pixel strings for every sprite. Build a generator in /tools/spritegen:
  - Author each sprite as a compact material mask (one char per material: skin, cloth, wood, iron, hair, etc.).
  - The generator auto-shades each material along its ramp from a top-left light source, adds selective outlining (darker outline of the adjacent colour, not pure black), and applies dithering where specified.
  - Outputs PNG sprite sheets + a JSON atlas into /public/sprites, committed to the repo.
- Any CC0 art imported must be quantized to the 32-colour palette by the generator. Record source and licence in CREDITS.md. Reject anything not CC0.
- Characters: 16x32. Peasant gets 4-direction walk (4 frames), run (4), idle breathing (2), plus every work animation from Phase 5 (chop, split, carry, stir, milk, sow, hoe, reap, flail, pray, sleep, eat).
- All body-state variants (stout → skeletal, sick, cold), carried items and held tools rendered as layers, not duplicate sprites.
- All other characters, livestock and the black dog rebuilt at the new size with idle + walk (4 frames).
- Tiles: 16x16 with autotiling (grass/mud/path/snow edges blend automatically). Rebuild every scene from Phase 3 and Phase 5 at the new resolution.

## Step 6 — Atmosphere
- Parallax: 5 layers (sky gradient via dithered bands, moon with phases, clouds, far silhouette castle/church, treeline), smooth sub-pixel scrolling.
- Weather rebuilt: rain with splashes, snow that accumulates on roofs and ground, rolling fog layers, wind affecting smoke, grass and leaves.
- Hearth smoke rising from the roof, sparks, flickering firelight.
- Water: animated tiles with reflections of the moon.

## Step 7 — Feel
- Movement: smooth sub-tile walking at 60fps with acceleration and a short stop. Camera follows with light easing and screen-edge clamping.
- Interaction clarity: a small floating prompt above any object the peasant faces that can be used ("A: Chop"). Objects with a pending need pulse subtly (unfed animal, dying fire).
- UI rebuilt at 256x224: 9-slice parchment windows, readable pixel font at the new size, icons for every item and tool.
- Screen transitions: fades and a wipe for scene changes.

## Step 8 — Visual QA loop
- Install Playwright. Script screenshots of every scene, the shell, the menus and the Sprite Gallery at these viewports: 375x667 @2x, 390x844 @3x, 393x852 @3x, 430x932 @3x, 412x915 @2.625x.
- Review every screenshot yourself. Fix blur, uneven pixels, clipped UI, overlapping buttons and off-palette colours before marking the phase done.
- Save the final screenshots to docs/screenshots/ so I can review them on GitHub.

## Acceptance
1. AUDIT.md lists all gaps found and every one is fixed or explained under Blocked.
2. Crisp, even pixels at integer scale on all five viewports (verified by screenshot).
3. Pinch and double-tap zoom are impossible on iOS.
4. All 32 palette colours enforced by an automated test across every generated sprite sheet.
5. Every sprite, animation, tile and scene from Phases 3 and 5 exists at the new resolution and appears in the Sprite Gallery.
6. Lighting, LUT seasons, weather, parallax and water all visibly working.
7. Interaction prompts appear for every usable object.
8. Existing saves load correctly after the update.
9. 60fps on a mid-range phone; no per-frame allocations in the render loop.
10. Screenshots committed to docs/screenshots/; full test suite green; CHANGELOG updated.

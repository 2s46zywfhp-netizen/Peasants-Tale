=== PHASE 3 SPEC — Art, atmosphere, audio, UI ===
## Palette
- Use only the 16 colours in CLAUDE.md.
- Seasonal remaps: winter cold blue-grey, spring mud and moss, summer gold, autumn ember. Plague years add a sickly green tint. DMG mode collapses everything to 4 shades.
- Mood reference: moonlit teal-and-navy castles, ember-red skies, fog, rain, lone silhouettes (Castlevania / Blasphemous energy, crushed to 160x144).
## Sprite system
- Sprites defined in code as palette-indexed strings (one char per pixel) in /src/render/sprites, converted to cached ImageBitmaps at boot.
- Runtime palette swapping for seasons, plague and DMG mode.
- Peasant 16x16: 4-direction walk (2 frames each), idle, work, eat, sleep, pray.
- Body-state variants: stout, healthy, thin, gaunt, skeletal, sick, cold (hunched).
- Wife, child, elder, priest, reeve, steward, lord, and 4 villager types, each with idle and walk.
- Livestock: hens, pig, cow, ox. The black dog.
## Scenes (16x16 tiles, edge transitions)
- Cottage interior: hearth, pallet bed, pot, door.
- Village green: cottages, well, alehouse.
- Church exterior and interior.
- Strip fields, with visible crop growth stages.
- Manor house gate.
- Woods edge, plus a barrow / fairy ring.
## Atmosphere
- 3–4 layer parallax skies: moon with calendar-synced phases, cloud bands, distant church/castle silhouette, treeline.
- Day/night palette shift across the 6 blocks. Hearth and candle glow at night.
- Weather particles: rain, snow, fog drift, falling leaves, driven by the sim's weather.
- Optional CRT scanline overlay.
## UI
- Dialogue box with typewriter text and blip sound; text speed from settings.
- Stat screen on parchment showing symptoms, not numbers ("Your belt is looser").
- Parchment Log on return, summarizing the event log since the last session.
- Action menu per location and time block.
## Audio (Web Audio API, fully synthesized, no audio files)
- Square/triangle chiptune with a minor-key drone; one theme per season.
- Church bells on the hour blocks.
- SFX: footsteps, eat, bell, door, dialogue blip, low sting for dark events.
- Audio unlocks on first tap (iOS). Mute respects settings.
## Assets
- External packs only if CC0; record source and licence in CREDITS.md.
## Acceptance
1. Every sprite, variant and animation above exists.
2. A Sprite Gallery debug screen shows all sprites and animations, cycling palettes.
3. All scenes are reachable and connected.
4. Seasons, day/night, weather and moon phase visibly change.
5. The Parchment Log correctly summarizes a debug fast-forward of 1 week.
6. 60fps on a mid-range phone; no per-frame allocations in the render loop.
7. No colour outside the palette (automated test that scans sprite data).

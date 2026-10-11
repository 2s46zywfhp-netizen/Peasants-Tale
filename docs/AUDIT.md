# Audit (Phase 5, step 1)

This audit checks the build at commit `198e1dc` against every requirement and acceptance criterion in
`docs/spec/01-foundation.md`, `02-sim.md`, `03-art.md` and `04-life.md`. I read the code in `src/`,
`public/`, `e2e/`, `scripts/`, `index.html`, `vite.config.ts`, `netlify.toml` and the docs, and I also ran
these checks:

- `npx vitest run`: 30 files, 201 tests, all pass. `npx tsc --noEmit` and `npx eslint .` are clean.
- I made a production build into a scratch folder and served it with `vite preview`. Against it I ran
  `e2e/phase3-verify.mjs` (24/24 PASS) and `e2e/phase4-verify.mjs` (23/23 PASS).
- A Playwright script with iPhone 13, iPhone SE and Pixel 7 emulation checked integer scaling, that
  settings survive a reload, and offline reload through the service worker. All passed.
- The Netlify API (read-only) shows that the site `peasants-life` exists and its current deploy is `ready`.

Phase 5 replaces the resolution, palette, sprite art style and shell look, so this audit does not list
them as gaps. It does list functional gaps.

## Gaps

1. **[Spec 02 §Time] Hastened tasks break "1 real day = 1 game week"**. The spec sets a fixed rate of
   42 blocks per real day. Since the play-test changes, every task the player picks from a menu opens
   `WorkingScene`. After 2.4 s it calls `game.hasten()` (`src/ui/scenes/working.ts:241-264`,
   `src/ui/scenes/actionMenu.ts:96,183`). `hasten()` moves `anchorMs` backwards so the rest of the task
   passes at once (`src/sim/sim.ts:343-354`). Nothing caps how far the life can run ahead of the wall
   clock. A player who picks one task after another can get through days in minutes. The balance runs
   (`src/sim/balanceRuns.test.ts`) never call `hasten`, so `docs/BALANCE.md` does not describe how the
   game is really played. **Fix:** the owner should confirm this design. If it stays, cap how far
   ahead the life may run (for example, the current real day, put in `balance.ts`), add a test for the
   cap, and add a "hastening diligent player" playstyle to the balance runs.

2. **[Spec 02 §Wealth] Livestock and tools can be lost but never gained**. Wealth is supposed to
   include hens, pig, cow, ox and tools. Beasts are only ever removed: by the fox, debt seizure,
   heriot and fae takings (`src/sim/events.ts:340`, `src/sim/station.ts:249-254`,
   `src/sim/bloodline.ts:202-217`, `src/sim/dark.ts:92-97`). Tools only wear down
   (`src/sim/farm.ts:116`). No trade, breeding or repair adds any of them back (`TRADE_KINDS` in
   `src/sim/actions.ts:20`). The cow and ox start at 0 (`balance.ts:121`), so they can never exist. As
   a result the cow and ox pens in the fields never show, and `OX_LABOUR_BONUS` and the cow/ox manure
   values never apply. **Fix:** add buy/sell trades for beasts and a buy or mend option for tools, with
   prices in `balance.ts`. Perhaps let hens and the pig breed. Add tests, including extending the
   no-money-exploit tests to the new trades.

3. **[Spec 02 §Agriculture] The Hungry Gap (April–June) is not modelled**. No code or test refers to
   it. Any shortage in spring arises only by accident, from the harvest timing. **Fix:** add an
   explicit mechanic, such as higher grain prices or less food from eggs and the garden from April to
   June, with the window in `balance.ts`. Add a test that household stores reach their lowest in that
   window for an average life.

4. **[Spec 02 §Debug] The debug combo fires the buttons' normal actions first**. Holding SELECT +
   START for 2 s does open the panel (`src/main.ts:133-141`). But whichever button is pressed first
   still runs its own action. On the title, START begins the game and SELECT opens Settings
   (`src/ui/scenes/title.ts:371-384`). In the world, START opens the status pages, and SELECT there
   jumps back to the title (`src/ui/scenes/status.ts:54-57`). **Fix:** delay single START/SELECT
   actions until release (or until a short time passes) while the other button is held, and add a
   unit test for the combo.

5. **[Spec 03 §Palette] The plague tint follows calendar years, not the sim's plague**. The world
   remap uses `isPlagueYear(info.year)` with `PLAGUE_YEARS = [1348, 1349, 1361, 1362, 1369]`
   (`src/render/world.ts:66,352`, `balance.ts:29`). So the tint is on from January 1348, months before
   the omens, and again in 1361/62/69, when the sim has no plague. `plagueTint()` in
   `src/sim/plague.ts:21` is never used. The side-view cottage gets no season or plague remap at all
   (`src/render/cottage.ts:626`; only DMG reaches it). **Fix:** drive the tint from `s.plague.phase`
   through `plagueTint()`, and apply the season and plague look in the cottage too.

6. **[Spec 03 Acceptance 6] Menus and overlays allocate memory every frame**. The world loop is free of
   per-frame allocations, but `ActionMenuScene.draw` calls `items()` every frame. That rebuilds the
   list, calls `clock()` and `availability()` and builds strings
   (`src/ui/scenes/actionMenu.ts:128-155,191-193`). `DebugScene.draw` rebuilds its items too
   (`debug.ts:98`). `SettingsScene.draw` uses a `forEach` closure and new strings (`settings.ts:160-167`).
   `TitleScene.draw` builds a template string when the line has ended (`title.ts:419`).
   `StatusScene.draw` builds its title string (`status.ts:63`), and `GalleryScene.draw` builds probe
   strings (`gallery.ts:101,122,126`). `e2e/perf.mjs` only measures the plain world, so it misses all
   of this. **Fix:** build item lists and labels on enter, on input and when the block changes, not in
   `draw()`. Extend `perf.mjs` to profile an open action menu, Settings and the status pages.

7. **[Spec 03 §Sprite system / Spec 04 §Family] The household on screen does not match the sim**. The
   cottage shows a `wife` sprite whenever any spouse is alive, even a husband after a female heir
   takes over (`src/render/scenes/maps.ts:145-148`, `src/ui/scenes/world.ts:527`). It shows one `child`
   sprite however many children there are, babies included. A surviving `parent` (role set in
   `src/sim/bloodline.ts:72`) is never drawn, although the `elder` sprite exists. The family's body
   states (sick, thin, cold) only reach the player's sprite (`world.ts:466-473`). **Fix:** spawn
   household actors from `s.members`, choosing the sprite by role, sex and age, and give the drawn
   kin their body-state look where a variant exists.

8. **[Spec 04 Acceptance 2] Neglect barely shows a decline**. `docs/BALANCE.md` shows the neglectful
   and absent households ending with more grain than the diligent one, higher morale (66.4 and 60.8
   against 56.6), no one gaunt, and almost no fines (0.6). The only clear decline is "thin" in 42–58%
   of runs. The test passes, but "visible decline" is weak, and a fully absent player loses almost
   nothing. **Fix:** retune the autopilot's lateness, vice and skipped duties at low morale, and the
   neglect penalties, so that neglect clearly does worse than diligence on several measures without
   killing the family. Regenerate `docs/BALANCE.md` (taking gap 1 into account).

9. **[Spec 03 §UI] The Parchment Log leaves out some of the player's own deeds**. `summarize()`
   counts every `action`-type entry but only phrases the ids in `PHRASE`
   (`src/sim/summary.ts:171-192,224-231`). Courting, marriage, accusing, taking a holding, buying
   freedom, fleeing, robbing, leaving an offering, surrendering and asking a favour are counted, then
   dropped from "While you were away". Some of their results are logged elsewhere as rank or village
   entries, but the deed itself is not told. **Fix:** add phrases for every `ActionId`, and add a test
   that every action id has one.

10. **[Spec 04 §Black Death] The omens text gives the wrong date**. Omens start on 1 June 1348
    (`balance.ts:431`), but the text says "Midsummer, 1348" (`src/sim/plague.ts:136`). Midsummer is
    24 June. **Fix:** change the text, or move `omenFrom` to 24 June.

11. **[CLAUDE.md rule, Spec 02 §Actions] Some numbers are hard-coded outside `balance.ts`**. The
    STORES page says "two loaves or a jug of ale" as fixed text (`src/ui/symptoms.ts:224`) instead of
    reading `FAE.offeringBread`. `dark.ts:63` uses a literal 1 for the ale offering. The 12d
    poaching fine is a literal (`station.ts:184,186`). The bread gift, the courtship age limit of 45
    and the per-day chance of villagers dying of old age are literals too (`family.ts:54`,
    `village.ts:290`). **Fix:** move them into `balance.ts`.

12. **[Spec 01 Acceptance 7] The live URL is not recorded in the repo**. The Netlify site exists
    (`https://peasants-life.netlify.app`, current deploy `ready`), but no doc in the repo gives the
    URL or says the deploy was checked. **Fix:** record the URL and the deploy status in
    `docs/PROGRESS.md` at phase end.

13. **[Spec 02 Acceptance 7] Some systems have no unit tests and the browser checks are not in the
    suite**. `events.ts` and `hallmote.ts` have no test files of their own; they are tested inside
    `actions.test.ts:116-140` and `station.test.ts:149-190`, which is acceptable. But the UI flows
    have no unit tests: settings, export and import through the UI, the action menu, the working
    scene and the world scene. Those are only checked by the `e2e/*.mjs` scripts. The scripts depend on
    Playwright installed globally in the container (`/opt/node22/...`) and are not part of
    `npm test`. **Fix:** add Playwright as a dev dependency and an `npm run e2e` script, so that the
    Phase 5 screenshot loop and these checks can be repeated.

## Verified done

**Spec 01 (Foundation)**
- Vite and TypeScript strict, ESLint and Vitest: `package.json`, `tsconfig.json`, `eslint.config.js`. Typecheck and lint are clean.
- Manifest with fullscreen, portrait and theme `#0b0d14`, and 192, 512 and maskable icons: `public/manifest.webmanifest`. The icons are generated from a 16x16 head: `scripts/gen-icons.mjs`.
- apple-touch-icon, apple-mobile-web-app-capable, black-translucent status bar, viewport-fit=cover: `index.html:5-17`.
- Safe-area insets are respected: `src/style.css:41-42`.
- Portrait lock: `src/main.ts:28-32`, the rotate overlay in `style.css:179-194`, and the manifest.
- The service worker precaches every built asset and public file: `vite.config.ts:14-40`, `scripts/sw-template.js`. An offline reload worked in emulation.
- Shell with D-pad, A, B, START and SELECT, multi-touch through per-pointer tracking, and held directions repeating: `src/ui/shell.ts:266-331`, `src/input/input.ts:460-468`.
- Vibration tick that fails silently where unsupported: `shell.ts:229-235`.
- Blocking of zoom, scroll, selection and callout: `shell.ts:238-259`, `style.css:7-28`.
- Input maps buttons to actions, and scenes subscribe to actions: `input.ts:394-403`, `src/ui/scene.ts:224-229`.
- Scene manager with push, pop and replace, and a fade: `src/ui/scene.ts`, tested in `scene.test.ts`.
- Press Start 2P bundled locally and credited: `src/assets/fonts/`, `CREDITS.md`.
- Title screen with the name, a flickering candle and PRESS START: `src/ui/scenes/title.ts`.
- Settings for text speed, sound, scanlines, DMG, export, import and wipe with confirmation: `src/ui/scenes/settings.ts`, `confirm.ts`.
- IndexedDB wrapper with schema version, migration registry and corrupt-save backup: `src/save/db.ts`, `schema.ts`, `saveManager.ts`, tested in `save.test.ts`.
- Autosave when the app is hidden and after every block: `src/main.ts:120-128,155-160`.
- Settings persist across a reload (checked in the browser), and export/import round-trips (`save.test.ts:316-320`).
- `netlify.toml` has the build command, publish dir, immutable `/assets/*`, and no-cache for `sw.js`, `/index.html` and `/`.
- Integer scaling with device-pixel snapping: `src/render/screen.ts:101-139`. On a 390-wide iPhone 13 emulation the scale is 6 device px per pixel, on whole device pixels.

**Spec 02 (Simulation)**
- 42 blocks per real day, and `advance()` runs whole blocks with a 30-day cap that marks neglect and logs it: `src/sim/sim.ts:278-298`, `balance.ts:5-15`.
- Clock rewind is a no-op: `sim.ts:279`. Tested in `sim.test.ts:146-185`.
- Julian calendar from Lady Day 1345, with the Lady Day year, weekday, season, moon, and Lent, Easter (computus), Plough Monday, May Day, Midsummer, Lammas, Michaelmas, Martinmas, Christmas and the Twelve Days: `src/sim/calendar.ts`. Easter 1345–1400 is tested against a table (`calendar.test.ts:14-66`).
- Body: hunger, reserve with five tiers, fatigue and injury, warmth, filth, and illness (ague, flux, fever, infected injury) with recovery and death: `src/sim/body.ts`, `body.test.ts`.
- Soul (morale and both pieties) and standing (lord, priest, village) with decaying tags: `sim.ts:124-127`, `state.ts:369-381`.
- All 15 base actions, with duration, location, blocks and effects in `balance.ts:274-306`; logic in `src/sim/actions.ts`.
- Habit autopilot with slot weights and decay, need overrides and a vice drift, and a log entry for every autonomous action: `src/sim/habits.ts`, `sim.ts:207-219`, `habits.test.ts`.
- Structured log entries: `src/sim/log.ts`, `state.ts:184-193`.
- Week-work 3 days a week, boon days with a meal, tithe, Michaelmas rent, and the fine → suspicion → court → eviction ladder: `src/sim/obligations.ts`, `farm.ts:199-211`, `obligations.test.ts`.
- Missed mass leads to the heathen tag, then church court, then penance with standing partly restored; meat on fast days may be seen: `obligations.ts:138-160`, `actions.ts:110-116`. Tested in `sim.test.ts:106-144`.
- Strip fields, winter and spring crops, three-field rotation, yield from weather, labour and manure, cooking and brewing: `src/sim/farm.ts`, `actions.ts:184-192`.
- Seeded daily weather affecting yield, warmth and morale: `src/sim/weather.ts`.
- Debug panel with fast-forward (day, week, season, year), state dump, seed setter and trigger-any-event: `src/ui/scenes/debug.ts`.
- Acceptance 1–6 are tested in `sim.test.ts` and `calendar.test.ts`. Acceptance 8 (walk, eat, sleep, work, mass) is covered by the e2e scripts.
- mulberry32 only, and no `Date.now` or `Math.random` in `src/sim` (checked with grep).

**Spec 03 (Art, atmosphere, audio, UI)**
- Palette-indexed sprite strings, an atlas, cached ImageBitmaps, and runtime remaps for season, time, plague and DMG: `src/render/sprites/*`, `atlas.ts`, `palette.ts`.
- Peasant walk in 4 directions, idle, work, eat, sleep and pray, in 7 body states; wife, child, elder, priest, reeve, steward, lord and 4 villager types; livestock and the black dog: `sprites.test.ts:40-77`.
- Scenes are connected (cottage, green, fields, woods with barrow and ring, churchyard, church, manor gate, town, camp): `src/render/scenes/maps.ts`. The e2e check visits all of them.
- Field tiles change with crop growth: `src/render/world.ts:123-144`.
- Parallax sky with moon phases, clouds, silhouette and treeline: `world.ts:268-294`.
- Day/night remaps, hearth, candle and window glow: `palette.ts:69-84`, `world.ts:399-418`.
- Rain, snow, leaves and fog driven by the sim's weather: `src/render/weather.ts`, `world.ts:444-449`.
- CRT scanlines: `screen.ts:146-150`.
- Typewriter dialogue with blip sound and text speed: `src/ui/scenes/dialogue.ts`.
- Parchment status pages written as symptoms: `src/ui/symptoms.ts`, `status.ts`.
- The Parchment Log on return and after a debug fast-forward: `main.ts:168-173`, `parchmentLog.ts`, `summary.ts`.
- Action menus per place and time block: `actionMenu.ts`.
- Synthesised seasonal themes with a drone, the hour bell, and the sound effects (steps, eat, bell, door, blip, sting), with audio unlocking on a tap and following the mute setting: `src/audio/sfx.ts`, `themes.ts`, `main.ts:103-104,161`.
- No external assets, as recorded in `CREDITS.md`.
- Sprite Gallery that cycles palettes: `gallery.ts`.
- Automated palette test: `sprites.test.ts:5-19`, `palette.test.ts`, `cottage.test.ts`.

**Spec 04 (Life, village, darkness, death)**
- 15 named villagers with roles, opinions, ties, memory, gossip, a favours ledger, witch risk and the player's accusations: `src/sim/village.ts`, `village.test.ts`.
- Courtship (more on feast days) and marriage with merchet: `src/sim/family.ts:45-92`.
- Births, childbed risk, work from age 7, deaths, leaving home, and household-wide eating: `family.ts:109-151`, `actions.ts:98-118`.
- Hallmote every 21 days with the four fines, a public standing hit, and reeve elections: `src/sim/hallmote.ts`.
- Ranks, holdings, buying freedom, flight with a year and a day, debt seizure, eviction, labouring, begging, outlawry, and a playable outlaw camp: `src/sim/station.ts`, the camp scene in `maps.ts`.
- Black dog, fae bargains, nightmares and visitors: `src/sim/dark.ts`, `dark.test.ts`.
- Black Death omens, outbreak, aftermath and resolution: `src/sim/plague.ts`, `plague.test.ts`, e2e.
- Permadeath, heriot, heir inheritance and the Chronicle: `src/sim/bloodline.ts`, `bloodline.test.ts`, e2e.
- Onboarding: name grid, intro and first-day hints: `src/ui/scenes/onboarding.ts`, `world.ts:53-58`.
- Push notifications are deferred and not built, as the spec says.
- Balance runs are written to `docs/BALANCE.md`. Exploit tests: `exploits.test.ts`. Changelog: `docs/CHANGELOG.md`. The full suite passes.

## Needs a real device

- Spec 01 #1: installing to the iOS home screen and launching fullscreen portrait with no browser chrome. This is already listed under Blocked in `docs/PROGRESS.md`.
- Spec 01 #3 on iOS: that pinch and double-tap zoom, the long-press callout and pull-to-refresh are really impossible, and that all 8 buttons work with real multi-touch. The code paths exist (`shell.ts:238-259`), but Chromium emulation does not reproduce Safari's gesture handling.
- Spec 01 #2: offline play in real airplane mode on iOS. Offline reload works in Chromium.
- Spec 01 #6: Lighthouse installability. Lighthouse is not installed in the container. The manifest and service worker meet the usual criteria, but no Lighthouse run is on record.
- Spec 01: that vibration fails silently on iOS, that the clipboard export and import work in iOS Safari, and that audio unlocks on the first tap in iOS Safari.
- Spec 03 #6 and Spec 04 #5: 60 fps on a real mid-range phone. `e2e/perf.mjs` gives only a throttled-Chromium proxy.
- Spec 01: that a push to `main` triggers the Netlify deploy automatically. The site and its ready deploy exist, but the GitHub link is set in Netlify's settings, not in the repo.

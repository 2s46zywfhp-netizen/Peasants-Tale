# Browser checks

`npm run e2e` builds the app, serves the production build and runs `verify.mjs` and `screenshots.mjs`
against it. Playwright is a dev dependency; in the cloud container the preinstalled Chromium is used.
The page exposes test hooks only when its URL has `?qa` (`window.qa`: jump to a scene, fast-forward,
open a screen, read the frame).

- `verify.mjs [url]`: integer scaling, touch targets and L/R, a new life, the door home, acceleration,
  a prompt for every usable object and room spot, the hearth menu, queueing with R, a hastened task,
  START and the debug combo, L cycling the belt, settings and the schema-5 save surviving a reload.
- `screenshots.mjs [url] [outDir]`: every scene (at dawn, midday, dusk, night and in winter), the shell,
  the menus and the Sprite Gallery at five phone viewports. `docs/screenshots/` holds the committed set.
- `perf.mjs <url> alloc [walk]`: heap-sampling profile of allocations inside the frame loop.
  `SCREEN=world|cottage|menu|settings|status` picks what is on screen.
- `perf.mjs <url> fps <throttle>`: frame times and per-frame script/task time under CPU throttling.

For readable function names in the allocation profile, build unminified:
`npx vite build --minify false --outDir /tmp/nomin && npx vite preview --outDir /tmp/nomin --port 4174`.

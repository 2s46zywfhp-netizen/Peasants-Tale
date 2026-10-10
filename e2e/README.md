# Browser checks

Run against a built app served with `npx vite preview` (production) or an unminified build
(`npx vite build --minify false --outDir /tmp/nomin && npx vite preview --outDir /tmp/nomin --port 4174`)
when function names are needed for allocation attribution. They use the Playwright and Chromium
installed in the cloud container, not a project dependency.

- `phase3-verify.mjs [url]`: walks all seven scenes, checks day/night, seasons, weather and moon
  change on screen, the Parchment Log after a debug fast-forward of one week, and the Sprite Gallery.
- `perf.mjs <url> alloc [walk]`: heap-sampling profile of allocations inside the frame loop.
- `perf.mjs <url> fps <throttle>`: frame times and per-frame script/task time under CPU throttling.

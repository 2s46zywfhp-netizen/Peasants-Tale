# NorthPrep progress

## Phase 1 — app shell, PWA offline, data layer, backup/restore ✅

- [x] React + TypeScript (strict) + Vite + Tailwind
- [x] Installable PWA: manifest, icons (192/512/maskable), service worker precaches every asset and bundled JSON
- [x] Works fully offline after first load (verified in browser: network cut, reload, all tabs work)
- [x] Hash routing so every screen loads from the cached app shell
- [x] Online/offline badge in the header
- [x] IndexedDB via Dexie: settings, location profiles, inventory, journal, attachments (photos as Blobs)
- [x] Schema versioning (Dexie versions) + backup format versioning with a migration chain
- [x] Backup to JSON file, including photos (base64)
- [x] Restore: replace or merge, all-or-nothing transaction, clear errors for bad/newer files, confirmation prompt
- [x] Last-backup reminder on Home
- [x] Request persistent storage; show usage
- [x] Themes: Sun (max contrast), Dark, Night (red only, images tinted red); no flash on load; saved in backups
- [x] Large tap targets (≥48 px), 18 px base text, bottom tab bar
- [x] Print/PDF: print stylesheet + PrintButton/PrintHeader components for later modules
- [x] Versioned reference-data format (`data/*.json`) with validation tests; `sources.json` seeded
- [x] Tests: 11 unit tests (backup/restore, data validation) + browser smoke test

## Phase 2 — location profile + food and water calculators
Not started.

## Blocked
- None.

## Notes
- Built on the orphan branch `northprep` of the peasants-tale repo (no NorthPrep repo existed). Move to its own repo when ready:
  `git push <new-remote> northprep:main`.

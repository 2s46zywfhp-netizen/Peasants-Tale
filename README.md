# NorthPrep

Offline-first survival prep planner and field journal. Default region: Northern Ontario / Canadian Shield.
Works with no internet once it has been opened once. Your data stays on your device (IndexedDB) and
exports to one JSON file you own.

## Run

```
npm install
npm run dev        # development
npm test           # unit tests
npm run build      # production build in dist/ (includes the offline service worker)
npx vite preview   # serve the build; open it once online, then it works offline
```

Install on a phone: open the site in Chrome/Safari → "Add to Home screen".

## Layout

- `data/` — bundled reference data, versioned JSON you can edit (see `data/README.md`)
- `src/db/` — IndexedDB schema (Dexie), settings, backup/restore
- `src/data/` — loads and validates the reference data
- `src/lib/` — theme (Sun / Dark / red Night), online status, storage protection
- `src/pages/`, `src/components/` — UI
- `scripts/make-icons.mjs` — rebuilds app icons from `public/icons/icon.svg`
- `scripts/smoke-offline.mjs` — browser test of phases 1–6 with the network cut
- `scripts/build-climate.ts` — rebuilds the Ontario climate dataset from ECCC normals (`npx vite-node scripts/build-climate.ts`)
- `scripts/fetch-guide-images.mjs` — downloads freely licensed photos for new field-guide entries that have a `wiki` title
- `data/diagrams/*.svg` — field-guide diagrams; edit in any text or SVG editor

## Printing / PDF

Any screen with a "Print / PDF" button prints a clean black-on-white version (app bars hidden,
link URLs written out). Choose "Save as PDF" in the print dialog for a paper backup.

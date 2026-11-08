# NorthPrep progress

## Phase 1 — app shell, PWA offline, data layer, backup/restore ✅
- [x] React + TypeScript (strict) + Vite + Tailwind; installable PWA; full offline precache
- [x] Dexie (IndexedDB) schema with versions; backup format versioned with migration chain
- [x] JSON backup/restore (photos included), replace or merge, all-or-nothing
- [x] Sun / Dark / red Night themes; large tap targets; print/PDF styles

## Phase 2 — location profile + food and water ✅
- [x] Bundled Ontario dataset: 106 ECCC stations, 1981–2010 normals (`data/ontario-climate.json`, rebuild with `npx vite-node scripts/build-climate.ts`)
- [x] 45 reference towns: NRCan zone, NBC design low, postal prefixes (`data/reference-towns.json`, approximate — verify)
- [x] Input by postal code, lat/long, GPS (offline), or town picker
- [x] Derived: zone, last/first frost, frost-free days, design low, precipitation, snow-cover months, HDD, Jan mean
- [x] Every value user-editable (overrides kept separately, resettable)
- [x] Optional online refresh: Open-Meteo (last 10 years) and nearest ECCC normals station
- [x] Household: people (age, sex, activity, kcal override), pets (species, weight), duration presets + custom, budget tier, storage location + floor space, heat source, cooking fuel, heated area, insulation
- [x] Food: 2,400 kcal default scaled by age/sex/activity, +25 % cold labour, 8 categories + baking, salt (iodized + preserving), vitamins C/D/multi, morale, pet food; kcal/day achieved, macro split, pails, floor space; fat rotation flag; canned-freeze warning; short-duration no-cook mix
- [x] Water: 4 L/person/day, pets by weight, storage jugs, filters, ClO2 tabs, bleach, boiling fuel by fuel type; freeze warning
- [x] All tunable numbers in `data/assumptions.json`; tests for every calculator

## Phase 3 — seeds, supplies, hunting ✅
- [x] 50 open-pollinated annuals filtered by frost-free season with 14-day buffer; direct vs indoor start, indoor start date, transplant date, yield, kcal yield, viability, seed-saving notes
- [x] 38 perennials with zone rating, rootstock, pollinator pairing, marginal warnings
- [x] "Skip these" list and row-cover / frost-protection recommendations
- [x] Supplies in 10 categories, climate-adjusted; firewood cords per winter from degree-days, area and insulation; other fuels in litres/kg; chainsaw fuel per cord; PRACTICE REQUIRED badges
- [x] Hunting/fishing/firearms/defence (toggle): 74 items incl. restricted and prohibited classes; role, range, cartridge, ammo availability, weight, cold reliability, maintenance
- [x] Legal label on every item (status, acquirable now, licence to use, consequence, sources, last verified) — editable in-app and in `data/hunting.json`; none pre-marked verified
- [x] Collapse Mode: utility-only ranking + harvest-sustainability notes
- [x] Ammo planning by role and duration; reloading entries with Explosives Regulations storage notes

## Phase 4 — inventory and rotation ✅
- [x] Targets generated from food, water, supplies and ammo lists
- [x] Stock lots linked to targets; progress bars per group and per item
- [x] Expiry (printed or estimated from shelf life), rotation due dates, FIFO "use first" ordering, use-this-month list, expired alerts (also on Home)
- [x] Manual entry always; optional barcode scan (BarcodeDetector + Open Food Facts) when online
- [x] Printable stock list

## Tests
- 109 unit tests (`npm test`); browser smoke test `scripts/smoke-offline.mjs` covers phases 1–4 offline.

## Blocked
- None.

## Known limits
- Hardiness zones and design lows come from a hand-compiled town table, not computed from NRCan's model. Edit per location.
- Legal labels need your verification before you act on them.

## Next: Phase 5 — field guide with PDF import (needs your Canadian Shield Survival Field Guide PDF)

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

## Phase 5 — field guide ✅ (PDF content: waiting for your PDF)
- [x] 98 entries across all 13 sections: foraging (26), mushrooms (13), dangerous lookalikes (14), water, fire, shelter (quinzhee, lean-to, snow trench, debris hut), navigation, signalling, cold injuries, wound care/TCCC, fishing & game processing, food preservation (drying, smoking, curing, pressure/water-bath canning, fermenting, root cellar), ice safety (Red Cross thickness table)
- [x] Each entry: ID features, habitat, season, prep, numbered how-to steps, warnings, lookalikes
- [x] SAFETY RULE: no automated identification; every edible entry shows its dangerous lookalikes (with photos) on the same screen, above the description; enforced by tests and by the user-entry editor
- [x] 75 real photos from Wikimedia Commons, public domain / CC only, author + licence + source stored per image (`data/guide-images.json`, `scripts/fetch-guide-images.mjs`); credits page
- [x] 10 editable inline SVG diagrams (`data/diagrams/*.svg`, use currentColor so they work in every theme and print)
- [x] User photos per entry (camera), stored on device and in backups
- [x] Seasonal calendar (forage seasons from entries + `data/calendar.json` + your frost dates), printable year grid
- [x] PRACTICE REQUIRED badges (tourniquet, wound packing, splinting, bow drill, ferro rod, quinzhee, map & compass, field dressing, snaring, pressure canning, ice self-rescue, hypothermia)
- [x] Print: any entry, any section, or the whole guide (one entry per page, contents list)
- [x] PDF import on-device (pdf.js): splits at headings, guesses sections, review before saving; "My entries" editor; export to JSON
- [ ] Parse the Canadian Shield Survival Field Guide PDF into entries — Blocked: PDF not provided yet. The import tool is ready.

## Phase 6 — journal + offline maps ✅
- [x] Dated entries: text, tags, photos (camera), GPS pin, weather (manual or online fill)
- [x] Log types: general, foraging, harvest, hunt/fish, water source, cache, garden
- [x] Cache entries PIN-locked (AES-GCM, PBKDF2 key); locked caches hidden from list and map
- [x] Map: NRCan Canada Base Map + labels, Toporama topo layer (online); "Save this area for offline" downloads tiles into the service-worker cache; long-press to add entry; GPX export
- [x] Garden log: planting, harvest, frost, seed-saved events; year-over-year table per crop; observed frost dates per year
- [x] "How to use NorthPrep" printable help page

## Tests
- 136 unit tests (`npm test`); browser smoke test `scripts/smoke-offline.mjs` covers phases 1–6 with the network cut, including an offline map area.

## Blocked
- Field guide PDF parsing: waiting for the PDF.

## Known limits
- Hardiness zones and design lows come from a hand-compiled town table, not computed from NRCan's model. Edit per location.
- Legal labels need your verification before you act on them.
- Photos of locked caches are not encrypted (only text and location are).
- Toporama topo layer is online-only; the NRCan base map is the offline layer.

## Next
- Send the Canadian Shield Survival Field Guide PDF: import it with Field guide → Import PDF, or send it to me to convert into curated data entries.

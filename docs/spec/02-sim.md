=== PHASE 2 SPEC — Simulation engine ===
## Time
- 1 real day = 1 game week. 6 blocks per day (dawn, morning, midday, afternoon, dusk, night). One block ≈ 34m17s real.
- advance(state, nowMs) simulates whole elapsed blocks. Catch-up cap: 30 real days; beyond that the peasant enters a neglect state with a log entry.
- Clock tampering: if nowMs < lastSimMs, do nothing (never rewind). A forward jump beyond the cap is treated as the cap.
- Calendar starts 25 March 1345 (Lady Day, the medieval new year; the year number increments each 25 March). Julian calendar. Track weekday, season, moon phase and the liturgical calendar: Sundays, Fridays, Lent and Easter (Julian computus, computed per year), Plough Monday, May Day, Midsummer (24 Jun), Lammas (1 Aug), Michaelmas (29 Sep), Martinmas (11 Nov), Christmas and the Twelve Days.
## Body (per household member)
- hunger 0–100: rises per block, faster when working or cold.
- reserve (weight) 0–100: every block at or above the starving threshold burns reserve; surplus slowly rebuilds it. Chronic late meals must cause loss over game weeks, not instantly. Visible tiers: stout, healthy, thin, gaunt, skeletal.
- fatigue: sleep restores it; overwork raises injury chance.
- warmth: from season temperature, firewood, clothing and shelter.
- filth: rises daily; washing lowers it.
- health and illness: disease rolls weighted by reserve, fatigue, warmth and filth. Illnesses: ague, flux, fever, infected injury. Recovery over days. Death is possible.
## Soul
- morale.
- privatePiety (prayer, confession) and publicPiety (seen at mass, tithe paid), tracked separately.
## Standing
- lord, priest and village, each 0–100.
- Tags with decay timers (e.g. heathen, drunkard, good neighbour, debtor).
## Wealth
- pence, grain (bushels), ale, firewood, livestock (hens, pig, cow, ox), tools, acres.
## Actions
- eat, cook, brew, sleep, work own strips, week-work, attend mass, pray, confess, tavern, gather firewood, wash, socialise, trade, rest.
- Each has a duration in blocks, a location, valid times, and costs/effects defined in balance.ts.
## Habits autopilot
- Record the player's action per (weekday, block) slot. Weights decay so old choices fade.
- When the player is absent, the peasant chooses by habit weight plus needs (urgent hunger and cold override habit).
- Low morale shifts choices toward vice: lateness, drink, skipped duties.
- Every autonomous action writes to the event log.
## Event log
- Structured entries: {date, block, type, actors, text}. Feeds the Parchment Log in Phase 3.
## Manorial obligations
- Week-work: 3 days a week on the lord's demesne.
- Boon work at ploughing and harvest, with a lord-provided meal on boon days.
- Tithe: 10% of produce at harvest. Rent due at Michaelmas.
- Missed obligations escalate: fine → suspicion tag → manor court summons → eviction.
## Church
- Sunday mass. Skipping lowers priest standing and publicPiety and adds the heathen tag, which raises negative-event odds.
- 3 missed masses within 8 weeks → church court summons → public penance (morale and standing hit; standing partly restored on completion).
- Eating meat on a Friday or during Lent carries a chance of being seen.
## Agriculture and food
- Strip fields. Winter wheat and rye sown in autumn; barley, oats and peas in spring; harvest Aug–Sep.
- Yield rolls by weather, labour and manure.
- Stores are consumed daily. The Hungry Gap runs April–June.
- Cooking turns grain into bread and pottage. Brewing makes ale.
## Weather
- Daily, season-driven, seeded. Affects yield, warmth and morale.
## Debug
- Hold SELECT + START for 2 seconds: panel with fast-forward (1 day / 1 week / 1 season / 1 year), state dump, seed setter, and trigger-any-event.
## Acceptance
1. Determinism: same seed + same action sequence → identical state hash after 2 game years.
2. A 30-real-day catch-up runs in under 200ms (Node benchmark as proxy).
3. Late-feeding test: meals 2 blocks late every day for 8 game weeks → reserve reaches "thin".
4. Missed-mass test triggers the church court on schedule.
5. Easter dates for 1345–1400 match a published Julian Easter table.
6. Clock-rewind and over-cap tests pass.
7. Unit tests for every system; full suite green.
8. Playable with placeholder rendering: walk, eat, sleep, work, attend mass.

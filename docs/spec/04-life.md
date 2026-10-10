=== PHASE 4 SPEC — Life, village, darkness, death ===
## Village and social graph
- About 15 named villagers with roles: priest, reeve, steward, miller, brewster, smith, neighbours.
- Each has an opinion of the player and of every other villager, plus a memory of events.
- Gossip propagates through the graph over days; deeds spread both ways.
- A favours-owed ledger works as a currency.
- Witch accusations: low standing + bad harvest = risk of accusation. The player can accuse rivals.
## Family
- Courtship at feast days. Marriage requires paying merchet.
- Children are born, grow, work from age 7, can die or leave.
- Hunger and reserve scale to the whole household; each member's condition is visible.
## Manor court (hallmote)
- Periodic sessions. Fines for brawling, bad ale, straying livestock, missed work.
- Public standing hit for anyone fined.
- Reeve elections.
## Advancement and decline
- Up: cottar → villein with acres → full virgate (~30 acres) → reeve → free tenant → yeoman or craftsman.
- Escape: flee to a chartered town and survive a year and a day uncaught to become free.
- Down: debt → selling livestock → losing land → labourer → beggar → outlaw. Outlaw life in the woods is playable.
## Dark layer (always ambiguous, never confirmed real)
- The black dog on the roads at night.
- Fae bargains at the barrow / fairy ring: crops saved, something taken.
- Nightmares and visitors, weighted by hunger, sickness and low piety.
- Black Death, 1348: omens (rats, dead birds, a stranger from the port) → mass death in the village → aftermath (vacant holdings, wage spikes, the lord tightening control).
## Death and bloodline
- Permadeath. The lord takes a heriot (the best beast).
- The heir inherits land, debts, standing and grudges. The village remembers the family name.
- Scrollable Family Chronicle of every generation.
## Onboarding
- Name the peasant, a short intro scene, a first-day tutorial.
## Deferred (do not build)
- Push notifications (needs a push server; later phase).
## Acceptance
1. Every system above is implemented and reachable in play.
2. Balance runs: simulate 2 game years for three playstyles (diligent, neglectful, fully absent). Write outcomes to docs/BALANCE.md. No starvation spiral for the diligent player, no money exploits, and neglect produces visible decline rather than instant death.
3. The 1348 plague sequence fires and resolves.
4. Death → heir handoff works and the Chronicle records it.
5. 60fps maintained; full test suite green.
6. Changelog written to docs/CHANGELOG.md.

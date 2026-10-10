# Changelog

## Phase 4: Life, village, darkness, death

### The village
- Ashby now has fifteen named villagers: Father Walter the priest, Robert Reeve, Master Hugh the steward,
  Simon Miller, Alice Brewster, Gilbert Smith, Old Godric, Matilda atte Well, John Shepherd, Emma Webbe,
  Thomas Carter, Isabel Cooke, Peter Hayward, Margery Thatcher and Nicholas the beggar.
- Each villager has an opinion of your family, feelings toward every other villager, and a memory of what
  you did.
- Gossip spreads through friendships over days. Your deeds are felt at once by whoever saw them, then
  reach the rest as rumour. Villagers also do things to each other, and you hear the gossip at the
  alehouse and on the green. Your standing in the village follows what people think of you.
- **Favours ledger.** HELP NEIGHBOUR puts a villager in your debt (up to three favours). ASK A FAVOUR calls
  one in: they work your strips, or bring bread. A friend will help without credit, but then you owe
  them, and they call it in later.
- **Witch accusations.** After a bad harvest, a family with low standing may be accused. Four
  oath-helpers who think well of you clear the name; without them the name sticks, with a fine and
  penance.
- You can ACCUSE a rival at the church. If the village dislikes them, they are driven out. If not, the
  accusation backfires and they hold a grudge.
- Villagers in the world stand for real people. They vanish when they die or leave, and what they say
  depends on what they think of you, what they remember, and what is owed.

### Family
- The household starts as a man of 28, his wife of 25 and their son of 6. Each has their own body and
  condition on the FAMILY page.
- Children are born, eat half a serving while small, sicken more easily, and help in the fields from
  age seven. Grown children who are not the heir may leave home.
- Childbirth carries risk.
- A widowed head can COURT unmarried villagers, faster on feast days and Sundays, then MARRY at the
  church door once the merchet is paid to the lord (free families pay none).

### Manor court (hallmote)
- Every three weeks the hallmote fines brawling, thin ale, straying beasts and missed work. Every fine
  is public: the village thinks less of whoever paid it, villagers included.
- Brawls can break out at the alehouse.
- After Michaelmas each year the village elects a reeve, and a well-liked family head can win. The reeve
  owes no week-work and no rent and earns a small wage, but collecting dues costs goodwill.

### Advancement and decline
- **Ranks**: cottar, villein, virgater, reeve, free tenant, yeoman, craftsman; and down through
  labourer, beggar and outlaw.
- **Going up.** TAKE A HOLDING buys vacant land for an entry fine (the acres join the fallow field and
  enter the rotation at Michaelmas). BUY FREEDOM purchases a charter from a willing lord.
- Rent now scales with land. A free tenant pays more money but owes no labour.
- **Flight.** FLEE TO TOWN abandons the holding. A year and a day in the town uncaught makes the family
  free craftsmen; the lord's men may find you first.
- **Going down.** Debt makes the steward seize beasts (ox, cow, pig, hens), then the land. The landless
  WORK FOR HIRE and pay for lodging; with nothing left they BEG. Caught POACHING while landless means
  outlawry.
- **Outlaws** live in the outlaw camp: they POACH, ROB TRAVELLERS and risk the gallows, or GIVE UP THE
  WOODS for a heavy fine.

### The dark layer (never confirmed)
- The black dog on the roads at night, more often at the new moon.
- LEAVE OFFERING at the barrow: a blighted crop may be spared, and something is taken back later (a
  hen, a cow, a child's wits for a day, a lost night).
- Nightmares and visitors come to the hungry, the sick and the faithless. Sometimes a dead parent
  stands at the foot of the bed.

### The Black Death
- From June 1348: omens (rats, dead birds, a stranger from the port at Melcombe, rumours from Bristol).
- From October 1348 to May 1349: the pestilence. Villagers die, and your household can catch it and die.
- From June 1349: the aftermath. Holdings lie vacant, wages treble, and the lord tightens control: fines
  and the odds of capture rise, and the Ordinance of Labourers is read.
- At Lady Day 1350 the pestilence passes and the chronicle records it.

### Death and bloodline
- Permadeath with an heir. The lord takes a heriot (the best beast). The heir is the eldest child of 14
  or more, else the widow or widower, else the eldest child however young.
- The heir inherits the land, the debts, half the standing, and the village's grudges (opinions carry
  over at 70%). Grief follows.
- With no heir the line ends, and the title offers a new life.
- The **CHRONICLE** page lists every generation: names, years, rank, marriages, births, losses and how
  each head died.

### Onboarding
- A new life begins on a letter grid: name the peasant, then the family.
- A short intro by candlelight follows.
- First-day hints teach walking and acting, choosing an action, the status pages, and that life goes on
  by habit while you are away.
- No time passes for the new life until it is named.

### Screens and world
- New status pages: FAMILY (each member, their age in words, their condition), VILLAGE (every villager,
  how they feel, favours owed) and CHRONICLE.
- Actions done with a person open a list of villagers, with the reason if one cannot be chosen.
- New places: the manor hall (pillars at the manor gate), the barrow and fairy ring in the woods, the
  town, and the outlaw camp. Actions the town or the greenwood rule out are not offered there.
- The Parchment Log now reports village, family, court, dark, plague and rank events.
- Debug triggers: head dies, child due, pestilence, deep debt, vacant land.

### Balance
- Cooking yields 36 servings per bushel; the croft garden adds pottage from May to October.
- Wages are about a penny a day, plus the household's other hands, trebled after the pestilence.
- The landless pay for lodging.
- Results of the balance runs are in docs/BALANCE.md.

### Saves
- Save schema 4 (sim version 3). Older saves migrate: the household gains ages and sexes, the village
  is peopled, and onboarding is skipped for a life already under way.

## Phase 3: Art, atmosphere, audio, UI
- Palette-indexed sprite atlas, seven village scenes, day/night, seasons, weather, moon, plague tint,
  synthesised music and sound, the Parchment Log, and a sprite gallery.

## Phase 2: Simulation engine
- Real-time sim in blocks (a week a real day), Julian calendar and feasts, body and soul, the habits
  autopilot, the three-field farm, obligations, events, and catch-up with a cap.

## Phase 1: Foundation
- PWA shell in a Game Boy–style case, settings, IndexedDB saves with migrations, Netlify deploy.

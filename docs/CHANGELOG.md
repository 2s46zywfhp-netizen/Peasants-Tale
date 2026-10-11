# Changelog

## Phase 5: the 16-bit overhaul
- **Sharper, bigger screen.** The game is drawn at 256x224 and scaled in whole device pixels (4x on
  most phones, 2x on a 375-wide one), never stretched or blurred; spare room goes to the bezel. It is
  re-fitted on resize, rotation and when the browser's toolbars move.
- **A new handheld.** Dark plastic with a fine grain, a deep bezel, a bigger D-pad, A and B in the right
  thumb's reach, START and SELECT with large touch areas, and two shoulder buttons: **L** changes the tool
  on your belt, **R** shows the tasks waiting. Every button is at least 48 px; presses show and buzz.
  Pinch and double-tap zoom are blocked.
- **32 colours and real light.** Eight colour ramps; seasons, the hours, the pestilence and fog are
  colour tables, never tints. Light is worked out per pixel: the hearth, candles, a rushlight at dusk,
  lanterns, lit windows, the camp fire and the moon. Firelight is warm, moonlit nights teal and navy with
  cream highlights, and light fades out with ordered dithering. DMG mode is now earned by keeping a life
  going for four weeks.
- **All-new art**, generated from material masks: a 16x32 peasant who walks, runs, breathes, chops,
  splits, hoes, sows, reaps, threshes, stirs, carries, milks, prays, eats and sleeps, and shows hunger,
  sickness and cold on the body; the family, villagers, beasts and the black dog; autotiled ground;
  thatched cottages, the church, the manor gate, the barrow, trees, carts and stalls; icons for every
  food, beast and tool; parchment windows.
- **The world rebuilt.** Every place is two screens wide under a five-layer sky (bands, moon in its
  phase, clouds, the castle and church on the hill, the treeline). Rain splashes where it lands, snow
  settles on roofs and ground and melts again, fog rolls, wind bends the grass and the smoke, the moon
  shines in the stream. The cottage and church are lit side-view rooms; the hearth burns, sparks and
  smokes as the sim says.
- **Walking feels better**: the peasant speeds up and stops short, breaks into a run, slides round
  corners, and the camera eases after them. Scene changes wipe.
- **You can see what to do.** A bubble over anything you face says what A does ("A: CHOP",
  "UP: HOME"); a dying fire and hungry beasts glow gently; needs pulse in the HUD.
- **The task queue.** In any menu, R queues the chosen task; they are done in turn as each ends.
- **Market**: hens, a pig, a cow and an ox can be bought and sold, and the smith mends worn tools.
- **The Hungry Gap**: from April to June grain is dear and the garden has not yet come in.
- **Neglect shows**: a household nobody tends for a week loses heart, the manor and the village think
  less of it, and work done by habit alone is sloppier.
- **Hastening is capped**: a chosen task's time can be passed at once only as far as an allowance that
  refills with real time (the life can't run more than about twice as fast as the clock).
- Fixes from the audit: START or SELECT no longer also act when held together for the debug panel; the
  plague look follows the sim's pestilence; the household on screen matches the family (spouse, children,
  a surviving parent); the Parchment Log tells every kind of deed; the omens are dated June 1348; menus
  no longer allocate memory every frame; numbers moved into balance.ts.
- Saves from Phase 4 load unchanged (schema 5 adds the belt, the queue and the DMG unlock).
- Tooling: `npm run sprites` regenerates the art; `npm run e2e` builds, serves and runs the browser checks
  and the screenshot pass; screenshots at five phone sizes are in `docs/screenshots/`.

## From play-testing on iPhone
- Updates now reach installed copies: the page comes from the network first (the saved copy is only
  for offline play), and the app reloads itself once when a new version arrives.
- A chosen task plays out on screen with a progress bar for a moment, then its time passes at once and
  what came of it is shown (B leaves it running in real time instead).
- Each spot in the cottage has its own actions: the bed (sleep, rest, pray), the hearth (cook, brew,
  rest by the fire), the table (meals).
- STORES page: the household's food, grain, ale, firewood, purse and beasts, counted, and what an
  offering at the barrow needs.
- Fields: clearer ploughed furrows, shoots, standing corn, ripe grain and stubble; standing on a strip
  names the field and its state, and the prompt says what A does there (SOW, WEED, REAP).
- Villagers each have their own voice, talk about the season, weather, hour, feasts, harvest and
  plague, pass on gossip they have heard, and greet you by what they think of you.
- Lit windows at night: warm panes behind dark mullions and a soft halo round the frame, in place of
  dithered speckle.
- Woods: calmer water in one continuous stream; the black dog no longer paces on the water.

## Core loop: home, heat, prayer
- Our own cottage is marked on the green: a lantern hangs beside the door (lit from dusk to dawn) and
  standing at it shows UP:HOME. The neighbours' doors stay shut.
- The hearth shows the real fire: cold grey ash when there is no firewood, a banked fire of embers on a
  mild day, a blazing fire when it is cold and the household burns wood. With the fire out, the room is
  dark at night.
- PRAY at home: kneel by the bed at any hour (a little less than prayer in church).

## Wider world, cozy air
- Outdoor scenes are two screens wide and the camera pans with you: the green has another cottage to the
  east, the fields run further, the woods path continues, the churchyard and manor grounds spread out,
  and the town and the outlaw camp are larger.
- Woodsmoke curls from every cottage chimney. Fireflies blink over the grass on spring and summer evenings.
  Dust drifts in the window light inside the cottage.

## The cottage, seen from the side
- Going indoors now leaves the overhead view: the cottage is a side-view room, wider than the screen,
  and the camera pans as you walk. Left to right: a stone chimney with an arched hearth, a shelf of jars
  and drying herbs, a window, a table with bread and a jug, a stool, a candlelit bedside table, the bed
  and the door. Walk right through the door to go out.
- The window shows the world outside: the sky by the hour, the ground by the season (snow in winter),
  pines, stars and the moon at night, fog, falling rain and snow.
- A new hearth fire: eight hand-built frames of licking flame over a coal bed and crossed logs, sparks
  rising, and a flickering glow on the floor.
- Lighting: daylight falls through the window onto the floor. At dusk and night, colours step down
  toward night-blue away from the fire, and stay warm close to the hearth and the candle.
- A, standing at the hearth, the table or the bed, opens the home actions. Sleep is shown on the bed.
- First-day hints are shorter and sit under the title bar, clear of the floor.

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

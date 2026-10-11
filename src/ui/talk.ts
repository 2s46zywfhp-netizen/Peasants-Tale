import { COURTSHIP } from '../sim/balance';
import { dayInfo } from '../sim/calendar';
import { ageOf, hasTag, type SimState, type Villager } from '../sim/state';
import { rankOf } from '../sim/station';
import { villager } from '../sim/village';
import { weatherFor } from '../sim/weather';

const pick = <T>(xs: readonly T[], n: number): T => xs[Math.abs(n) % xs.length]!;

/** Mixes a villager into the pick so neighbours do not all say the same thing on the same day. */
const seedOf = (v: Villager, s: SimState) => s.block + v.name.length * 7 + v.name.charCodeAt(0);

/** First line: how they greet the family, by what they think of it. */
function greeting(v: Villager, s: SimState): string {
  const fam = s.familyName;
  const o = v.opinion;
  const n = seedOf(v, s);
  if (o >= 50) return pick([`God keep you, friend. Any ${fam} is welcome at my door.`, 'There you are! Sit, sit. Tell me everything.', 'Ah, my favourite face in Ashby.', `Bless the ${fam}s. Truly.`], n);
  if (o >= 20) return pick(['Good day to you, neighbour.', `Well met. How do the ${fam}s fare?`, 'God give you good day.', 'There you are. I was thinking of you.'], n);
  if (o > -20) return pick(['Mm. Day.', 'Fair weather. Or not. Who can say.', 'You want something?', 'Neighbour.'], n);
  if (o > -50) return pick(['I have nothing to say to you.', `I know what the ${fam}s are.`, 'Walk on.', 'Not you again.'], n);
  return pick(['Get away from me.', 'I spit on your shadow. Go.', 'Cross my path again and see.'], n);
}

/** Each villager's own way of talking: a few things only they would say. */
const VOICE: Readonly<Record<string, readonly string[]>> = {
  priest: ['Pray for the souls in purgatory. They pray for you.', 'The bishop writes of tithes. Always tithes.', 'I saw a light on the barrow last night. Marsh-fire, nothing more.', 'Come to confession before the feast.'],
  reeve: ["The lord's furrows before your own.", 'Three days a week, and the boon days. That is the custom.', 'The steward counts every sheaf. So do I.', 'A dry week and we will have the hay in.'],
  steward: ['Rents fall due at Michaelmas. Every penny.', 'The lord is in London. His ledgers are not.', 'Heriot, merchet, tallage. The custom of the manor.', 'Do not let your beasts stray into the lord\'s corn.'],
  brewster: ['Fresh ale today. Whatever the hallmote says about it.', 'Thin? My ale? The aletaster has no tongue.', 'Bring a jug. A penny for two.', 'Simon Miller says my ale is water. Simon Miller is a thief.'],
  miller: ['Bring your corn to my mill, as the lord commands. My thumb is honest.', 'Hand-mills are forbidden. I will know.', 'The wheel wants mending, and the stream is low.', 'Alice Brewster talks too much.'],
  smith: ['Your sickle wants an edge. A penny and I will make it sing.', 'Iron is dear this year.', 'I shod the steward\'s horse. It bit me.', 'Fire and iron. Honest work.'],
  godric: ['Do not walk by the barrow after dark. The mound remembers.', "My father saw the great hunger. Grass in the dead men's mouths.", 'When the moon is dark, the black dog walks the lanes.', 'Leave bread for the old ones, and they leave you be.', 'Seventy winters. My knees know every one.'],
  matilda: ['The well water tastes of iron since Candlemas.', 'I buried two husbands. Good men, both. Mostly.', 'Herbs for the ague: feverfew and prayer.', 'Mind your little ones near the stream.'],
  shepherd: ['A ewe dead in the night. Not a mark on her.', 'The flock knows weather before I do.', 'Wolves? No. Not for years. Probably.', 'Lambing was hard this year.'],
  emma: ['I spin by the window till the light goes.', 'Mother says I should marry before I am old. I am nineteen!', 'There is to be dancing on the green at the feast.', 'Do you like blue? I dyed this myself.'],
  thomas: ['I carted the lord\'s wool to the port. Ships from everywhere.', 'One day I will see London.', 'My axle broke on the Ashby road. Bad omen, my mother says.', 'Fancy a wrestle on the green?'],
  isabel: ['I bake for the manor kitchen. They eat white bread, can you believe it?', 'Father Walter says I sing like a sparrow.', 'I found a hare\'s foot by the stile. For luck.', 'The miller\'s boy keeps looking at me.'],
  peter: ['I keep the hedges and the pound. Your pig was in the pound last week. Again.', 'Gaps in the hedge mean beasts in the corn.', 'Every hedge has a story. Most are about trespass.', 'A fine summer for brambles.'],
  margery: ['The roof leaks. My husband says next week. Every week.', 'Reeds for thatch are dear this year.', 'You can hear rats in every roof in Ashby now.', 'My little one has the cough. Pray for her.'],
  nicholas: ['Alms... a crust... for the love of Christ.', 'I was a soldier once. Crecy. Do not ask.', 'The church step is cold but it is mine.', 'God sees what you give. And what you keep.'],
};

/** What is on everyone's mind today: season, weather, the hour, feasts, the harvest, the pestilence. */
function topical(s: SimState, n: number): string | null {
  const day = Math.floor(s.block / 6);
  const info = dayInfo(day);
  const w = weatherFor(s.seed, day);
  const bod = s.block % 6;
  if (s.plague.phase === 'outbreak') return pick(['The bell tolls every day now. Keep your door shut.', 'They say it is in the air. Burn rosemary.', 'Pray. There is nothing else.'], n);
  if (s.plague.phase === 'omens') return pick(['Dead rats on the path again. Many.', 'A stranger came up from the port, coughing.', 'They say a sickness walks the south roads.'], n);
  if (info.feasts.length && !info.isLent) return pick(['A feast day! There will be ale on the green.', 'No work today, thank God.', 'Will you dance tonight?'], n);
  if (info.isLent) return pick(['Lent. Fish and pottage and prayer.', 'I dream of bacon. God forgive me.'], n);
  if (w.sky === 'storm') return 'This wind will have the thatch off.';
  if (w.sky === 'rain') return pick(['This rain will rot the seed in the ground.', 'Wet to the bone again.'], n);
  if (w.sky === 'snow') return pick(['Snow on the thatch. The old ones will not see spring.', 'Keep your fire high tonight.'], n);
  if (w.sky === 'fog') return 'Fog on the fields. Keep to the path.';
  if (s.fields.some((f) => f.stage === 'ripe')) return pick(['The corn is ripe. Every hand to the harvest.', 'Pray the rain holds off till it is in.'], n);
  if (bod >= 4) return pick(['Getting dark. I will be indoors before the dog comes out.', 'Good night to you. Bar your door.'], n);
  if (info.season === 'winter') return pick(['Cold enough to crack stones.', 'Wood is getting scarce. Mind the lord\'s trees.'], n);
  if (info.season === 'summer') return pick(['Hot work in the fields today.', 'The hay is high.'], n);
  return null;
}

/** A rumour this villager has heard, about someone else, if any. */
function rumourKnown(v: Villager, s: SimState): string | null {
  const i = s.village.indexOf(v);
  for (let k = s.rumours.length - 1; k >= 0; k--) {
    const r = s.rumours[k]!;
    if (r.knownBy & (1 << i) && r.about >= 0 && r.about !== i) return `Have you heard? ${r.text}`;
  }
  return null;
}

/** Second line: something they remember, owe, want or fear. */
function matter(v: Villager, s: SimState): string {
  const day = Math.floor(s.block / 6);
  const n = seedOf(v, s);
  const mem = v.memory.at(-1);
  if (v.courtship >= COURTSHIP.needed && v.opinion > 0) return 'If you asked me at the church door... I would not say no.';
  if (v.courtship > 0) return 'Will you walk out with me again on the feast day?';
  if (v.owes > 0 && n % 2 === 0) return 'I have not forgotten the day you helped me. Ask, and I will come.';
  if (v.owes < 0 && n % 2 === 0) return `You owe me ${-v.owes === 1 ? 'a kindness' : 'kindnesses'}. I keep count.`;
  if (mem && day - mem.day < 30 && n % 3 === 0) return mem.delta < 0 ? `I have not forgotten. ${mem.text}` : 'I hear good things of your house.';
  switch (v.role) {
    case 'priest':
      if (s.obligations.penanceSundaysLeft > 0) return `Penance yet: ${s.obligations.penanceSundaysLeft} Sundays in the white sheet.`;
      if (hasTag(s, 'heathen')) return 'Your place at mass was empty. God sees the empty place.';
      break;
    case 'reeve':
      if (s.obligations.strikes > 0) return 'I have your name written down. Do not make me write it twice.';
      break;
    case 'steward':
      if (s.obligations.debt > 0) return `You owe the manor ${s.obligations.debt}d. It is written.`;
      if (s.plague.vacant > 0 && n % 2 === 0) return 'There is land lying vacant, for a man with an entry fine.';
      break;
    case 'beggar':
      if (v.opinion > 0 && n % 2 === 0) return 'God bless you. You have been kind to me.';
      break;
    default:
      break;
  }
  const topic = n % 3 === 1 ? topical(s, n) : null;
  if (topic) return topic;
  const rumour = n % 4 === 2 ? rumourKnown(v, s) : null;
  if (rumour) return rumour;
  return pick(VOICE[v.id] ?? ['Keep well.'], n >> 1);
}

/** What someone says, given the state of the world. Pages of dialogue. */
export function talk(who: string, s: SimState, villagerId?: string): { speaker: string; pages: string[] } {
  const v = villagerId ? villager(s, villagerId) : null;
  if (v) {
    return { speaker: v.name, pages: [greeting(v, s), matter(v, s)] };
  }
  const day = Math.floor(s.block / 6);
  const info = dayInfo(day);
  const w = weatherFor(s.seed, day);
  const o = s.obligations;
  const spouse = s.members.find((m) => m.role === 'spouse' && m.alive);
  switch (who) {
    case 'family': {
      const kids = s.members.filter((m) => m.role === 'child' && m.alive);
      const k = kids[day % Math.max(1, kids.length)];
      if (!k) return { speaker: '', pages: ['The house is quiet.'] };
      const a = ageOf(k.bornDay, day);
      return {
        speaker: k.name,
        pages: [a < 2 ? '(A small one, asleep in the rushes.)' : k.body.hunger >= 60 ? 'I am so hungry. Is there bread?' : a < 7 ? pick(['Look, a beetle!', 'Tell me about the black dog again.'], day) : pick(['I scared the crows off the barley all morning.', 'When I am grown I will have my own strips.'], day)],
      };
    }
    case 'townsman':
      return {
        speaker: 'A TOWNSMAN',
        pages: [s.station.fledDay !== null ? 'New here? Keep your head down. The lords send men looking.' : rankOf(s) === 'CRAFTSMAN' ? 'Good day, master.' : 'Town air makes free, they say. A year and a day.'],
      };
    case 'wife': {
      const food = s.wealth.bread + s.wealth.pottage;
      return {
        speaker: spouse?.name ?? 'SPOUSE',
        pages: [
          food < 4 ? 'The pot is near empty. We cannot eat the seed corn.' : 'There is pottage. Sit, eat.',
          (s.members[0]?.body.filth ?? 0) > 60 ? 'And go wash in the stream. You smell of the midden.' : 'Mind the fire tonight.',
        ],
      };
    }
    case 'reeve':
      return {
        speaker: 'THE REEVE',
        pages: [
          o.manorCourtHeld ? 'You stood before the court. Fail once more and you are gone.' : o.strikes > 0 ? 'I have your name written down. Do not make me write it twice.' : 'Your work is owed on Monday, Tuesday and Thursday.',
          'The lord\'s furrows before your own.',
        ],
      };
    case 'priest':
      return {
        speaker: 'FATHER',
        pages: [
          o.penanceSundaysLeft > 0 ? `Penance yet: ${o.penanceSundaysLeft} Sundays in the white sheet.` : hasTag(s, 'heathen') ? 'Your place at mass was empty. God sees the empty place.' : 'Peace be with you, my son.',
          info.isLent ? 'It is Lent. No flesh, no cheese, no merriment.' : 'Come to confession before the feast.',
        ],
      };
    case 'steward':
      return { speaker: 'THE STEWARD', pages: [o.debt > 0 ? `You owe the manor ${o.debt}d. It is written.` : 'Rents fall due at Michaelmas. Every penny.'] };
    case 'lord':
      return { speaker: 'THE LORD', pages: ['...', 'He does not look at you.'] };
    case 'elder':
      return {
        speaker: 'OLD GODRIC',
        pages: [pick(['Do not walk by the barrow after dark. The mound remembers.', 'My father saw the great hunger. Grass in the dead men\'s mouths.', 'When the moon is dark, the black dog walks the lanes.'], day)],
      };
    case 'child':
      return { speaker: 'A CHILD', pages: [pick(['Will you play at knucklebones?', 'I saw a fairy ring! Do not step in it.', 'My brother has the cough.'], day)] };
    case 'beggar':
      return { speaker: 'A BEGGAR', pages: ['Alms... a crust... for the love of Christ.'] };
    case 'dog':
      return { speaker: '', pages: ['It watches you. It does not blink.', 'When you look again, it is gone.'] };
    default:
      return {
        speaker: 'A NEIGHBOUR',
        pages: [
          w.sky === 'rain' || w.sky === 'storm' ? 'This rain will rot the seed in the ground.' : w.sky === 'snow' ? 'Snow on the thatch. The old ones will not see spring.' : pick(['Fair weather. God be thanked.', 'They say there is a sickness in the south. Ships at Melcombe.', 'The miller cheats by the thumb.'], day),
          info.feasts.length ? 'A feast day! There will be ale on the green.' : 'Keep well, neighbour.',
        ],
      };
  }
}

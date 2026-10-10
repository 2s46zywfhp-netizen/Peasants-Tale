import { COURTSHIP } from '../sim/balance';
import { dayInfo } from '../sim/calendar';
import { ageOf, hasTag, type SimState, type Villager } from '../sim/state';
import { rankOf } from '../sim/station';
import { villager } from '../sim/village';
import { weatherFor } from '../sim/weather';

const pick = <T>(xs: readonly T[], n: number): T => xs[Math.abs(n) % xs.length]!;

/** First line: how they greet the family, by what they think of it. */
function greeting(v: Villager, s: SimState, day: number): string {
  const fam = s.familyName;
  const o = v.opinion;
  if (o >= 50) return pick([`God keep you, friend. Any ${fam} is welcome at my door.`, 'There you are! Sit, sit. Tell me everything.'], day);
  if (o >= 20) return pick(['Good day to you, neighbour.', `Well met. How do the ${fam}s fare?`], day);
  if (o > -20) return pick(['Mm. Day.', 'Fair weather. Or not. Who can say.'], day);
  if (o > -50) return pick(['I have nothing to say to you.', `I know what the ${fam}s are.`], day);
  return pick(['Get away from me.', 'I spit on your shadow. Go.'], day);
}

/** Second line: something they remember, owe, want or fear. */
function matter(v: Villager, s: SimState, day: number): string {
  const mem = v.memory.at(-1);
  if (v.courtship >= COURTSHIP.needed && v.opinion > 0) return 'If you asked me at the church door... I would not say no.';
  if (v.courtship > 0) return 'Will you walk out with me again on the feast day?';
  if (v.owes > 0) return `I have not forgotten the day you helped me. Ask, and I will come.`;
  if (v.owes < 0) return `You owe me ${-v.owes === 1 ? 'a kindness' : 'kindnesses'}. I keep count.`;
  if (mem && day - mem.day < 30) return mem.delta < 0 ? `I have not forgotten. ${mem.text}` : 'I hear good things of your house.';
  switch (v.role) {
    case 'priest': return s.obligations.penanceSundaysLeft > 0 ? `Penance yet: ${s.obligations.penanceSundaysLeft} Sundays in the white sheet.` : hasTag(s, 'heathen') ? 'Your place at mass was empty. God sees the empty place.' : 'Come to confession before the feast.';
    case 'reeve': return s.obligations.strikes > 0 ? 'I have your name written down. Do not make me write it twice.' : "The lord's furrows before your own.";
    case 'steward': return s.obligations.debt > 0 ? `You owe the manor ${s.obligations.debt}d. It is written.` : s.plague.vacant > 0 ? 'There is land lying vacant, for a man with an entry fine.' : 'Rents fall due at Michaelmas. Every penny.';
    case 'brewster': return 'Fresh ale today. Whatever the hallmote says about it.';
    case 'miller': return 'Bring your corn to my mill, as the lord commands. My thumb is honest.';
    case 'smith': return 'Your sickle wants an edge. A penny and I will make it sing.';
    case 'beggar': return v.opinion > 0 ? 'God bless you. You have been kind to me.' : 'Alms... a crust... for the love of Christ.';
    default:
      if (v.id === 'godric') return pick(['Do not walk by the barrow after dark. The mound remembers.', "My father saw the great hunger. Grass in the dead men's mouths.", 'When the moon is dark, the black dog walks the lanes.'], day);
      return pick(['They say there is a sickness in the south. Ships at Melcombe.', 'The miller cheats by the thumb.', 'Keep well.'], day + v.name.length);
  }
}

/** What someone says, given the state of the world. Pages of dialogue. */
export function talk(who: string, s: SimState, villagerId?: string): { speaker: string; pages: string[] } {
  const v = villagerId ? villager(s, villagerId) : null;
  if (v) {
    const day0 = Math.floor(s.block / 6);
    return { speaker: v.name, pages: [greeting(v, s, day0), matter(v, s, day0)] };
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

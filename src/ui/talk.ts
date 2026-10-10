import { dayInfo } from '../sim/calendar';
import { hasTag, type SimState } from '../sim/state';
import { weatherFor } from '../sim/weather';

const pick = <T>(xs: readonly T[], n: number): T => xs[Math.abs(n) % xs.length]!;

/** What someone says, given the state of the world. Pages of dialogue. */
export function talk(who: string, s: SimState): { speaker: string; pages: string[] } {
  const day = Math.floor(s.block / 6);
  const info = dayInfo(day);
  const w = weatherFor(s.seed, day);
  const o = s.obligations;
  const spouse = s.members[1];
  switch (who) {
    case 'wife': {
      const food = s.wealth.bread + s.wealth.pottage;
      return {
        speaker: spouse?.name ?? 'WIFE',
        pages: [
          food < 4 ? 'The pot is near empty. We cannot eat the seed corn.' : 'There is pottage. Sit, eat.',
          s.members[0]!.body.filth > 60 ? 'And go wash in the stream. You smell of the midden.' : 'Mind the fire tonight.',
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

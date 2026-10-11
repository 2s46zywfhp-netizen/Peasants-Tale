import { PLAGUE } from './balance';
import { sicken } from './body';
import { dayIndexOf, type DayInfo } from './calendar';
import { note } from './family';
import { log } from './log';
import { clamp, rand, type PlaguePhase, type SimState } from './state';
import { present } from './village';

const d = (ymd: readonly number[]) => dayIndexOf(ymd[0]!, ymd[1]!, ymd[2]!);
export const PLAGUE_DAYS = { omens: d(PLAGUE.omenFrom), outbreak: d(PLAGUE.outbreakFrom), aftermath: d(PLAGUE.outbreakTo) + 1, over: d(PLAGUE.resolveOn) };

export function phaseOn(day: number): PlaguePhase {
  if (day >= PLAGUE_DAYS.over) return 'over';
  if (day >= PLAGUE_DAYS.aftermath) return 'aftermath';
  if (day >= PLAGUE_DAYS.outbreak) return 'outbreak';
  if (day >= PLAGUE_DAYS.omens) return 'omens';
  return 'none';
}

/** The world is tinted while the pestilence is near. */
export function plagueTint(s: SimState): boolean {
  return s.plague.phase === 'outbreak' || s.plague.phase === 'omens';
}

const OMENS = [
  'Rats in the thatch, bold in daylight. Then dead ones on the path, many, and no cat did it.',
  'Dead birds in the furrows, rooks and pigeons both, without a mark.',
  'A stranger came up the road from the port at Melcombe, asking for water. He was sweating, though the day was cool.',
  'A pedlar says the pestilence is in Bristol. In Bristol, they say, the grass grows in the High Street.',
  'A red star over the church tower three nights running. Father Walter says it means nothing. He says it twice.',
] as const;

const TRANSITION: Record<Exclude<PlaguePhase, 'none'>, string> = {
  omens: 'June, 1348. The rain will not stop. Travellers speak of a sickness come from over the sea.',
  outbreak: 'The pestilence is in Ashby. Swellings in the armpit and groin, black as plums. Three days, and the bell.',
  aftermath: 'The dying slows. Half the houses have smoke; half do not. Land lies untilled, and men ask three times the wage.',
  over: 'Lady Day, 1350. The pestilence has passed. One in three of Ashby lies in the new pit beyond the churchyard wall.',
};

/** Once a day at dawn: the Black Death's course, fixed to the calendar. Returns household members it kills. */
export function dailyPlague(s: SimState, info: DayInfo): void {
  const ph = phaseOn(info.dayIndex);
  const p = s.plague;
  if (ph !== p.phase) {
    p.phase = ph;
    if (ph !== 'none') log(s, 'plague', TRANSITION[ph]);
    if (ph === 'aftermath') {
      s.wageMult = PLAGUE.wageMult;
      s.lordGrip = PLAGUE.lordGrip;
      log(s, 'plague', `${p.dead} of the village are dead. ${p.vacant} holdings lie vacant. The steward reads the Ordinance of Labourers: wages as before the pestilence, on pain of the stocks.`);
    }
    if (ph === 'over') {
      s.lordGrip = 1 + (PLAGUE.lordGrip - 1) / 2;
      note(s, `Lived through the Great Pestilence. ${p.dead} of Ashby died.`);
    }
  }
  if (ph === 'omens' && rand(s) < PLAGUE.omenChance) log(s, 'plague', OMENS[Math.floor(rand(s) * OMENS.length)]!);
  if (ph !== 'outbreak') return;
  s.soul.morale = clamp(s.soul.morale + PLAGUE.morale);
  for (const v of s.village) {
    if (!present(v) || rand(s) >= PLAGUE.villagerDeathDaily) continue;
    v.alive = false;
    p.dead += 1;
    if (v.role !== 'priest' && v.role !== 'beggar' && v.role !== 'steward') p.vacant += 1;
    log(s, 'plague', `${v.name} is dead of the pestilence.`, [v.name]);
  }
  for (const m of s.members) {
    if (!m.alive) continue;
    const b = m.body;
    if (b.illness?.kind === 'pestilence') {
      if (rand(s) < PLAGUE.deathDaily) b.health = 0;
    } else if (rand(s) < PLAGUE.infectDaily * (1 + b.filth / 100)) {
      sicken(b, 'pestilence', rand(s));
      log(s, 'plague', `${m.name} has the swellings. The tokens are on the skin.`, [m.name]);
    }
  }
}

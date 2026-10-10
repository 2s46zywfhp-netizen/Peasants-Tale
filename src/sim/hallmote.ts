import {
  BAD_ALE_CHANCE, DEED, HALLMOTE_EVERY_DAYS, HALLMOTE_FINES, HALLMOTE_STANDING_HIT, RANK_ACRES, REEVE, STRAY_CHANCE_PER_BEAST,
} from './balance';
import type { DayInfo } from './calendar';
import { note } from './family';
import { log } from './log';
import { charge } from './obligations';
import { clamp, peasant, rand, type SimState } from './state';
import { isReeve } from './station';
import { deed, idx, present, ROSTER } from './village';

type Offence = keyof typeof HALLMOTE_FINES;
const OFFENCE_TEXT: Record<Offence, string> = {
  brawling: 'brawling in the alehouse', badAle: 'selling thin ale', strayBeast: 'a beast straying in the lord\'s corn', missedWork: 'work owed and not done',
};

/** Everyone present hears the fine: the village thinks less of whoever paid it. */
function fineFamily(s: SimState, offence: Offence): void {
  const amount = Math.round(HALLMOTE_FINES[offence] * s.lordGrip);
  const owed = charge(s, amount);
  s.standing.village = clamp(s.standing.village + HALLMOTE_STANDING_HIT);
  const all = s.village.map((v, i) => (present(v) ? i : -1)).filter((i) => i >= 0);
  deed(s, DEED.fined, `${peasant(s).name} ${s.familyName} was amerced for ${OFFENCE_TEXT[offence]}.`, all);
  log(s, 'court', `Hallmote: amerced ${amount}d for ${OFFENCE_TEXT[offence]}${owed ? ` (${owed}d owed)` : ''}.`);
}

function fineVillager(s: SimState, i: number, offence: Offence): void {
  const v = s.village[i]!;
  s.village.forEach((o, j) => {
    if (j !== i) o.ties[i] = clamp(o.ties[i]! + HALLMOTE_STANDING_HIT, -100, 100);
  });
  log(s, 'court', `Hallmote: ${v.name} amerced for ${OFFENCE_TEXT[offence]}.`, [v.name]);
}

/** Who can stand for reeve: men of the village with land, and the head of the family if well thought of. */
function election(s: SimState, info: DayInfo): void {
  s.hallmote.electedYear = info.year;
  const candidates = s.village
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => present(v) && v.sex === 'm' && ['reeve', 'neighbour', 'miller', 'smith', 'shepherd'].includes(v.role) && v.id !== 'godric');
  const playerEligible =
    !s.obligations.evicted && !s.station.free && s.station.residence === 'village' && s.wealth.acres >= RANK_ACRES.villein &&
    s.standing.village >= REEVE.minVillage && s.standing.lord >= REEVE.minLord;
  const votes = new Map<number, number>();
  for (const voter of s.village) {
    if (!present(voter)) continue;
    let best = -2;
    let bestScore = -Infinity;
    if (playerEligible) {
      best = -1;
      bestScore = voter.opinion;
    }
    for (const c of candidates) {
      const score = c.v === voter ? 15 : voter.ties[c.i]!;
      if (score > bestScore) {
        best = c.i;
        bestScore = score;
      }
    }
    votes.set(best, (votes.get(best) ?? 0) + 1);
  }
  let winner = -2;
  let most = -1;
  for (const [k, n] of votes) if (n > most || (n === most && k === -1)) [winner, most] = [k, n];
  if (winner === -1) {
    s.station.reeveUntil = info.dayIndex + REEVE.termDays;
    s.hallmote.reeve = 'player';
    s.standing.lord = clamp(s.standing.lord + REEVE.lord);
    log(s, 'court', `The village elects ${peasant(s).name} ${s.familyName} reeve for the year. ${most} voices. No week-work and no rent, but every grudge is now yours.`);
    note(s, `Elected reeve, ${info.year}.`);
  } else if (winner >= 0) {
    const v = s.village[winner]!;
    s.hallmote.reeve = v.id;
    log(s, 'court', `${v.name} is chosen reeve for the year.`, [v.name]);
  }
}

/** Every few weeks at dawn: the manor court sits in the hall. Presentments, fines, and once a year the reeve. */
export function dailyHallmote(s: SimState, info: DayInfo): void {
  const day = info.dayIndex;
  if (day < s.hallmote.nextDay) return;
  s.hallmote.nextDay = day + HALLMOTE_EVERY_DAYS;
  const c = s.counters;
  const home = s.station.residence === 'village' && !s.station.outlaw;
  log(s, 'court', 'The hallmote sits in the manor hall. The steward reads the presentments.');
  if (home) {
    for (let k = 0; k < Math.min(2, c.brawls); k++) fineFamily(s, 'brawling');
    if (c.aleSold > 0 && rand(s) < BAD_ALE_CHANCE) fineFamily(s, 'badAle');
    const beasts = s.wealth.pig + s.wealth.cow + s.wealth.ox;
    for (let k = 0; k < beasts; k++) if (rand(s) < STRAY_CHANCE_PER_BEAST) fineFamily(s, 'strayBeast');
    if (c.strikesSince > 0) fineFamily(s, 'missedWork');
  }
  // The village's own sins. Alice Brewster is fined for her ale nearly every time, as everywhere.
  const brew = idx('brewster');
  if (present(s.village[brew]!) && rand(s) < 0.6) fineVillager(s, brew, 'badAle');
  const live = s.village.map((v, i) => (present(v) ? i : -1)).filter((i) => i >= 0);
  if (live.length && rand(s) < 0.5) fineVillager(s, live[Math.floor(rand(s) * live.length)]!, rand(s) < 0.5 ? 'brawling' : 'strayBeast');
  c.brawls = 0;
  c.aleSold = 0;
  c.strikesSince = 0;
  if (info.month >= 10 && s.hallmote.electedYear < info.year) election(s, info);
}

/** Sunday dawn: the reeve's small wage, and the cost of collecting dues from neighbours. */
export function weeklyReeve(s: SimState): void {
  if (!isReeve(s)) {
    if (s.hallmote.reeve === 'player') s.hallmote.reeve = ROSTER[1]!.id;
    return;
  }
  s.wealth.pence += REEVE.wagePerWeek;
  deed(s, DEED.reeveDues, `${peasant(s).name} the reeve came for the lord's dues.`);
}

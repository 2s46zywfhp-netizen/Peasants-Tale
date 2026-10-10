import { GRIEF_MORALE, HEIR_MIN_AGE, INHERIT_OPINION, INHERIT_STANDING } from './balance';
import { dayInfo } from './calendar';
import { eldestChild, spouse } from './family';
import { log } from './log';
import { ageOf, clamp, today, type ChronicleEntry, type Member, type SimState } from './state';
import { rankOf } from './station';

const yearOf = (day: number): number => dayInfo(day).year;

export function chronicleEntry(s: SimState, m: Member): ChronicleEntry {
  return { generation: s.generation, name: `${m.name} ${s.familyName}`, bornYear: yearOf(m.bornDay), diedYear: null, cause: '', rank: rankOf(s), notes: [] };
}

/** The heir: eldest child of age, else the widow(er), else the eldest child however young. */
export function heirOf(s: SimState): Member | null {
  const day = today(s);
  const kid = eldestChild(s);
  if (kid && ageOf(kid.bornDay, day) >= HEIR_MIN_AGE) return kid;
  return spouse(s) ?? kid;
}

/** The lord's heriot: the best beast in the house. */
function heriot(s: SimState): string {
  const w = s.wealth;
  for (const b of ['ox', 'cow', 'pig'] as const) {
    if (w[b] > 0) {
      w[b] -= 1;
      return `the ${b}`;
    }
  }
  if (w.hens > 0) {
    w.hens -= 1;
    return 'a hen, there being nothing better';
  }
  const d = Math.min(w.pence, 6);
  w.pence -= d;
  return d ? `${d}d, there being no beast` : 'nothing, there being nothing';
}

/**
 * A member of the household has died. If it was the head of the house, the lord takes his heriot,
 * the chronicle closes the generation and the heir takes over land, debts, standing and grudges.
 */
export function bury(s: SimState, m: Member, cause: string): void {
  m.alive = false;
  const i = s.members.indexOf(m);
  const head = i === 0;
  log(s, 'death', `${m.name} is dead${cause ? ` (${cause})` : ''}. The bell tolls.`, [m.name]);
  if (!head) {
    if (i >= 0) s.members.splice(i, 1);
    s.soul.morale = clamp(s.soul.morale + GRIEF_MORALE / 2);
    s.chronicle[s.chronicle.length - 1]?.notes.push(`${m.name} died (${cause}), ${dayInfo(today(s)).year}.`);
    return;
  }
  const entry = s.chronicle[s.chronicle.length - 1];
  if (entry) Object.assign(entry, { diedYear: dayInfo(today(s)).year, cause, rank: rankOf(s) });
  s.members.splice(0, 1);
  const beast = heriot(s);
  if (s.station.residence === 'village' && !s.station.outlaw) log(s, 'manor', `Heriot: the steward takes ${beast} for the lord.`);
  const heir = heirOf(s);
  if (!heir) {
    s.dead = true;
    s.plan = null;
    log(s, 'death', `No one is left of the ${s.familyName}s. The cottage stands empty; the village will remember the name a while.`);
    return;
  }
  // The heir to the front; the surviving parent of a child heir becomes 'parent'.
  s.members.splice(s.members.indexOf(heir), 1);
  const wasChild = heir.role === 'child';
  heir.role = 'peasant';
  s.members.unshift(heir);
  for (const o of s.members) if (o.role === 'spouse' && wasChild) o.role = 'parent';
  s.generation += 1;
  for (const k of ['lord', 'priest', 'village'] as const) s.standing[k] = clamp(50 + (s.standing[k] - 50) * INHERIT_STANDING);
  for (const v of s.village) v.opinion = Math.round(v.opinion * INHERIT_OPINION);
  for (const v of s.village) v.courtship = 0;
  s.soul.morale = clamp(s.soul.morale + GRIEF_MORALE);
  s.tags = s.tags.filter((t) => t.id === 'debtor' || t.id === 'witch');
  s.station.outlaw = false;
  if (s.station.residence === 'camp') s.station.residence = 'village';
  s.station.reeveUntil = 0;
  s.plan = null;
  if (s.location === 'camp') s.location = 'home';
  s.chronicle.push(chronicleEntry(s, heir));
  const age = ageOf(heir.bornDay, today(s));
  log(s, 'death', `${heir.name}, ${age} years old, is now head of the ${s.familyName} house. The land, the debts and the grudges pass with it.`, [heir.name]);
}

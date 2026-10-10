import {
  ACCUSE, DAYS_PER_YEAR, DEED, FAVOUR, GOSSIP, MEMORY_MAX, OPINION_DECAY, OPINION_START, RUMOUR_HEARD_SHARE, TAG_DAYS, TIE_START,
  VILLAGE_FROM_OPINION, WITCH,
} from './balance';
import type { DayInfo } from './calendar';
import { workStrips, fieldTask } from './farm';
import { log } from './log';
import { addTag, ageOf, clamp, hasTag, peasant, rand, today, type Sex, type SimState, type Villager, type VillagerRole } from './state';

interface RosterEntry {
  id: string;
  name: string;
  role: VillagerRole;
  sex: Sex;
  age: number;
  married: boolean;
}

/** The village of Ashby: fifteen souls besides your own household. Ids are stable across saves. */
export const ROSTER: readonly RosterEntry[] = [
  { id: 'priest', name: 'FATHER WALTER', role: 'priest', sex: 'm', age: 52, married: false },
  { id: 'reeve', name: 'ROBERT REEVE', role: 'reeve', sex: 'm', age: 44, married: true },
  { id: 'steward', name: 'MASTER HUGH', role: 'steward', sex: 'm', age: 47, married: true },
  { id: 'miller', name: 'SIMON MILLER', role: 'miller', sex: 'm', age: 39, married: true },
  { id: 'brewster', name: 'ALICE BREWSTER', role: 'brewster', sex: 'f', age: 35, married: true },
  { id: 'smith', name: 'GILBERT SMITH', role: 'smith', sex: 'm', age: 41, married: true },
  { id: 'godric', name: 'OLD GODRIC', role: 'neighbour', sex: 'm', age: 71, married: false },
  { id: 'matilda', name: 'MATILDA ATTE WELL', role: 'neighbour', sex: 'f', age: 58, married: false },
  { id: 'shepherd', name: 'JOHN SHEPHERD', role: 'shepherd', sex: 'm', age: 33, married: true },
  { id: 'emma', name: 'EMMA WEBBE', role: 'neighbour', sex: 'f', age: 19, married: false },
  { id: 'thomas', name: 'THOMAS CARTER', role: 'neighbour', sex: 'm', age: 21, married: false },
  { id: 'isabel', name: 'ISABEL COOKE', role: 'neighbour', sex: 'f', age: 17, married: false },
  { id: 'peter', name: 'PETER HAYWARD', role: 'neighbour', sex: 'm', age: 24, married: false },
  { id: 'margery', name: 'MARGERY THATCHER', role: 'neighbour', sex: 'f', age: 29, married: true },
  { id: 'nicholas', name: 'NICHOLAS', role: 'beggar', sex: 'm', age: 46, married: false },
];

const range = (s: SimState, r: { min: number; max: number }) => Math.round(r.min + rand(s) * (r.max - r.min)) + 0; // never -0: saves round-trip through JSON

export function createVillage(s: SimState): void {
  const n = ROSTER.length;
  s.village = ROSTER.map((r) => ({
    id: r.id, name: r.name, role: r.role, sex: r.sex, bornDay: -r.age * DAYS_PER_YEAR - Math.floor(rand(s) * 300), alive: true, gone: false,
    married: r.married, opinion: range(s, OPINION_START), ties: new Array<number>(n).fill(0), memory: [], owes: 0, courtship: 0,
  }));
  for (const v of s.village) for (let j = 0; j < n; j++) if (s.village[j] !== v) v.ties[j] = range(s, TIE_START);
  // A few fixed feelings: the beggar is pitied or scorned; the brewster and the miller are always at odds.
  s.village[idx('brewster')]!.ties[idx('miller')] = -35;
  s.village[idx('miller')]!.ties[idx('brewster')] = -30;
}

const IDS = ROSTER.map((r) => r.id);
export function idx(id: string): number {
  return IDS.indexOf(id);
}

export function villager(s: SimState, id: string | null): Villager | null {
  if (!id) return null;
  const i = idx(id);
  return i < 0 ? null : s.village[i] ?? null;
}

/** Present in the village and alive. */
export const present = (v: Villager): boolean => v.alive && !v.gone;

export function remember(v: Villager, day: number, text: string, delta: number): void {
  v.opinion = clamp(v.opinion + delta, -100, 100);
  v.memory.push({ day, text, delta });
  if (v.memory.length > MEMORY_MAX) v.memory.splice(0, v.memory.length - MEMORY_MAX);
}

export function meanOpinion(s: SimState): number {
  const vs = s.village.filter(present);
  return vs.length ? vs.reduce((n, v) => n + v.opinion, 0) / vs.length : 0;
}

export function opinionWord(o: number): string {
  return o >= 50 ? 'DEVOTED' : o >= 20 ? 'FRIENDLY' : o > -20 ? 'CIVIL' : o > -50 ? 'COLD' : 'HOSTILE';
}

/** Mean feeling of the rest of the village toward villager `i`. */
export function regard(s: SimState, i: number): number {
  let sum = 0;
  let n = 0;
  s.village.forEach((v, j) => {
    if (j !== i && present(v)) {
      sum += v.ties[i]!;
      n++;
    }
  });
  return n ? sum / n : 0;
}

function addRumour(s: SimState, about: number, delta: number, text: string, knownBy: number): void {
  s.rumours.push({ about, delta, text, day: today(s), knownBy, heard: about === -1 });
  if (s.rumours.length > GOSSIP.maxRumours) s.rumours.splice(0, s.rumours.length - GOSSIP.maxRumours);
}

/**
 * Something the family did that the village will talk about. The witnesses (by default one or two
 * villagers at random) feel it at once; the rest hear it as gossip over the following days.
 */
export function deed(s: SimState, delta: number, text: string, witnesses: number[] | null = null): void {
  const day = today(s);
  const live = s.village.map((v, i) => (present(v) ? i : -1)).filter((i) => i >= 0);
  if (!live.length) return;
  const w = witnesses ?? [live[Math.floor(rand(s) * live.length)]!];
  let mask = 0;
  for (const i of w) {
    const v = s.village[i];
    if (!v || !present(v)) continue;
    remember(v, day, text, delta);
    mask |= 1 << i;
  }
  addRumour(s, -1, delta, text, mask);
}

/** A villager's deed toward another: ties change, and the story spreads. */
function villagerDeed(s: SimState): void {
  const live = s.village.map((v, i) => (present(v) ? i : -1)).filter((i) => i >= 0);
  if (live.length < 2) return;
  const a = live[Math.floor(rand(s) * live.length)]!;
  let b = live[Math.floor(rand(s) * live.length)]!;
  if (b === a) b = live[(live.indexOf(a) + 1) % live.length]!;
  const va = s.village[a]!;
  const vb = s.village[b]!;
  const r = rand(s);
  const [delta, text] =
    r < 0.3 ? [-12, `${va.name} cheated ${vb.name} over a measure of barley.`]
    : r < 0.5 ? [-15, `${va.name} and ${vb.name} came to blows behind the alehouse.`]
    : r < 0.75 ? [10, `${va.name} helped ${vb.name} mend a fallen wall.`]
    : r < 0.9 ? [-8, `${va.name} says ${vb.name} moves boundary stones by night.`]
    : [12, `${va.name} sat up with ${vb.name}'s sick child.`];
  vb.ties[a] = clamp(vb.ties[a]! + delta, -100, 100);
  // The story is about the doer.
  addRumour(s, a, delta, text, 1 << b);
}

/** One day of talk: every knower may pass each rumour on to the people they like. */
function gossip(s: SimState, day: number): void {
  const n = s.village.length;
  s.rumours = s.rumours.filter((r) => day - r.day < GOSSIP.lifeDays);
  for (const r of s.rumours) {
    let newly = 0;
    for (let k = 0; k < n; k++) {
      if (!(r.knownBy & (1 << k)) || !present(s.village[k]!)) continue;
      const teller = s.village[k]!;
      for (let j = 0; j < n; j++) {
        if (j === k || r.knownBy & (1 << j) || newly & (1 << j)) continue;
        const listener = s.village[j]!;
        if (!present(listener) || listener.ties[k]! <= GOSSIP.friendTie || teller.ties[j]! <= GOSSIP.friendTie) continue;
        if (rand(s) < GOSSIP.tellChance) newly |= 1 << j;
      }
    }
    for (let j = 0; j < n; j++) {
      if (!(newly & (1 << j))) continue;
      const v = s.village[j]!;
      const d = r.delta * RUMOUR_HEARD_SHARE;
      if (r.about === -1) remember(v, day, r.text, d);
      else if (r.about !== j) v.ties[r.about] = clamp(v.ties[r.about]! + d, -100, 100);
    }
    r.knownBy |= newly;
  }
}

/** The family hears a rumour about a villager (at the alehouse or on the green). Returns its text. */
export function hearGossip(s: SimState): string | null {
  if (rand(s) >= GOSSIP.playerHearsChance) return null;
  const r = s.rumours.find((x) => !x.heard);
  if (!r) return null;
  r.heard = true;
  log(s, 'village', `Gossip: ${r.text}`);
  return r.text;
}

/* ───────────── favours ───────────── */

/** A block of labour for a neighbour: they owe you (up to a cap) and think better of you. */
export function helpNeighbour(s: SimState, id: string): string {
  const v = villager(s, id);
  if (!v || !present(v)) return 'finds nobody to help';
  if (v.owes < FAVOUR.cap) v.owes += 1;
  deed(s, DEED.helped, `${peasant(s).name} ${s.familyName} gave a day's work to ${v.name}.`, [idx(id)]);
  return `helps ${v.name}`;
}

/**
 * Calls in a favour: the neighbour works your strips if they need it, else brings bread. Without credit,
 * a friend still helps, but now you owe them.
 */
export function askFavour(s: SimState, id: string, info: DayInfo): string {
  const v = villager(s, id);
  if (!v || !present(v)) return 'finds nobody at home';
  if (v.owes <= 0 && v.opinion < FAVOUR.askOpinionMin) {
    remember(v, today(s), `${peasant(s).name} ${s.familyName} came begging help, owed none.`, -2);
    return `asks ${v.name} for help and is refused`;
  }
  v.owes -= 1;
  const task = fieldTask(s, info);
  if (task && !s.obligations.evicted) {
    for (let i = 0; i < FAVOUR.labourBlocks; i++) workStrips(s, info);
    return `has ${v.name}'s help in the strips`;
  }
  s.wealth.bread += FAVOUR.breadGift;
  return `is given ${FAVOUR.breadGift} loaves by ${v.name}`;
}

export function favourShort(s: SimState, id: string | null): string | null {
  const v = villager(s, id);
  if (!v || !present(v)) return 'NOBODY';
  if (v.owes <= 0 && v.opinion < FAVOUR.askOpinionMin) return 'OWES YOU NOTHING';
  return null;
}

/** Old favours you owe are called in. */
function callIns(s: SimState, day: number): void {
  for (const v of s.village) {
    if (!present(v) || v.owes > FAVOUR.grudgeOwed + 1 || v.owes >= 0) continue;
    if (rand(s) >= FAVOUR.callInChance) continue;
    if (s.wealth.grain >= FAVOUR.callInGrain) {
      s.wealth.grain -= FAVOUR.callInGrain;
      v.owes += 1;
      log(s, 'village', `${v.name} calls in a favour: a bushel of grain.`);
    } else {
      remember(v, day, `${peasant(s).name} ${s.familyName} did not repay a kindness.`, FAVOUR.calledInOpinion);
      log(s, 'village', `${v.name} asked for what is owed. You had nothing to give.`);
    }
  }
}

/* ───────────── accusation ───────────── */

/** The family accuses a rival before the priest. */
export function accuse(s: SimState, id: string): string {
  const i = idx(id);
  const v = s.village[i];
  if (!v || !present(v)) return 'accuses the empty air';
  const day = today(s);
  const threshold = ACCUSE.meanTieBelow + (s.lastHarvest < WITCH.badHarvest ? ACCUSE.badHarvestBonus : 0);
  if (regard(s, i) < threshold) {
    v.gone = true;
    s.standing.priest = clamp(s.standing.priest + ACCUSE.priestGain);
    // The accused's friends will not forget it.
    s.village.forEach((o, j) => {
      if (j !== i && present(o) && o.ties[i]! > 30) remember(o, day, `${peasant(s).name} ${s.familyName} helped drive out ${v.name}.`, DEED.accuseFail);
    });
    deed(s, DEED.accuseWin, `${peasant(s).name} ${s.familyName} named ${v.name} before the priest.`);
    log(s, 'village', `${v.name} is named before the parish and driven from Ashby. Nobody meets your eye.`);
    return `accuses ${v.name}, and is believed`;
  }
  v.opinion = ACCUSE.grudge;
  s.standing.priest = clamp(s.standing.priest - ACCUSE.priestGain);
  deed(s, DEED.accuseFail, `${peasant(s).name} ${s.familyName} slandered ${v.name}.`);
  log(s, 'village', `The priest hears you out and sends you away. ${v.name} will not forget this.`);
  return `accuses ${v.name}, and is not believed`;
}

/** Bad harvest + low standing: somebody says the family has the evil eye. Cleared only by oath-helpers. */
function witchRisk(s: SimState, info: DayInfo): void {
  if (s.lastHarvest >= WITCH.badHarvest || s.standing.village >= WITCH.standing || hasTag(s, 'witch')) return;
  if (rand(s) >= WITCH.dailyChance) return;
  const live = s.village.filter(present);
  if (!live.length) return;
  const accuser = live.reduce((a, v) => (v.opinion < a.opinion ? v : a));
  const helpers = live.filter((v) => v !== accuser && v.opinion >= WITCH.helperOpinion);
  log(s, 'dark', `${accuser.name} says the ${s.familyName} blight came from your door: a hare seen at dusk, milk turned in the pail.`, [accuser.name]);
  if (helpers.length >= WITCH.oathHelpers) {
    log(s, 'court', `Before the church court ${helpers.slice(0, WITCH.oathHelpers).map((v) => v.name).join(', ')} swear for you. Cleared.`);
    remember(accuser, info.dayIndex, `The ${s.familyName}s shamed me before the church court.`, -10);
    return;
  }
  addTag(s, 'witch', info.dayIndex + TAG_DAYS.witch);
  s.soul.morale = clamp(s.soul.morale + WITCH.convictMorale);
  s.standing.village = clamp(s.standing.village + WITCH.convictVillage);
  s.wealth.pence = Math.max(0, s.wealth.pence - WITCH.convictFine);
  deed(s, DEED.accused, `The ${s.familyName}s could not find four to swear for them.`);
  log(s, 'court', `Not enough neighbours will swear for you. Penance, a fine of ${WITCH.convictFine}d, and the name will stick.`);
}

/* ───────────── daily ───────────── */

/** Once a day at dawn: memories fade, talk spreads, favours are called in, the old die, suspicion grows. */
export function dailyVillage(s: SimState, info: DayInfo): void {
  const day = info.dayIndex;
  for (const v of s.village) {
    if (!present(v)) continue;
    v.opinion -= v.opinion * OPINION_DECAY;
    // The very old go quietly.
    const age = ageOf(v.bornDay, day);
    if (age > 60 && rand(s) < (age - 60) * 0.00008) {
      v.alive = false;
      log(s, 'village', `${v.name} is dead, full of years. The bell tolls for an hour.`, [v.name]);
    }
  }
  const target = 50 + meanOpinion(s) / 2;
  s.standing.village = clamp(s.standing.village + (target - s.standing.village) * VILLAGE_FROM_OPINION);
  if (rand(s) < GOSSIP.villagerDeedChance) villagerDeed(s);
  gossip(s, day);
  callIns(s, day);
  witchRisk(s, info);
}

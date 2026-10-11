import { FAE } from '../sim/balance';
import { reserveTier } from '../sim/body';
import { MOON_PHASES, formatDate } from '../sim/calendar';
import { clock } from '../sim/sim';
import { ageOf, type Body, type Member, type SimState } from '../sim/state';
import { rankOf } from '../sim/station';
import { present, opinionWord } from '../sim/village';

/** The stat screen speaks in symptoms, never numbers. */

const TIER = {
  stout: ['Your belt strains at the buckle.', 'is stout and well fed.'],
  healthy: ['You are hale and whole.', 'is hale.'],
  thin: ['Your belt is looser.', 'is thinner than before.'],
  gaunt: ['Your ribs show through.', 'has gone gaunt.'],
  skeletal: ['Bones press at your skin.', 'is wasting away.'],
} as const;

const ILL = {
  ague: ['The ague shakes you.', 'shakes with the ague.'],
  flux: ['The flux has you.', 'has the flux.'],
  fever: ['A fever burns in you.', 'burns with fever.'],
  infectedInjury: ['Your wound festers.', 'has a festering wound.'],
  pestilence: ['Black swellings under your arms. The tokens.', 'has the black swellings.'],
} as const;

function bodyLines(b: Body, self: boolean, name: string): string[] {
  const out: string[] = [];
  const say = (you: string, she: string) => out.push(self ? you : `${name} ${she}`);
  const [you, she] = TIER[reserveTier(b.reserve)];
  say(you, she);
  if (b.hunger >= 70) say('You are faint with hunger.', 'is faint with hunger.');
  else if (b.hunger >= 45) say('Your belly growls.', 'is hungry.');
  else if (b.hunger < 15) say('Your belly is full.', 'is fed.');
  if (b.fatigue >= 80) say('You are spent. You could sleep standing.', 'is worn to the bone.');
  else if (b.fatigue >= 55) say('Your limbs are heavy.', 'is tired.');
  if (b.warmth < 30) say('You shiver to the bone.', 'is shivering.');
  else if (b.warmth < 45) say('A chill sits in your bones.', 'is cold.');
  if (b.filth >= 70) say('Lice crawl in your hair.', 'is crawling with lice.');
  else if (b.filth >= 45) say('You stink.', 'needs a wash.');
  if (b.illness) say(ILL[b.illness.kind][0], ILL[b.illness.kind][1]);
  if (b.injuredDays > 0) say('Your leg will not take your weight.', 'is lame.');
  if (b.health < 35) say('Death is close. You can feel it.', 'may not live.');
  else if (b.health < 70) say('You feel weak.', 'is weak.');
  return out;
}

const RANK_WORD: Record<string, string> = {
  OUTLAW: 'an outlaw, wolf\'s-head, outside the law', FUGITIVE: 'a runaway serf hiding in the town', BEGGAR: 'a beggar at the church door',
  LABOURER: 'a landless labourer', COTTAR: 'a cottar with a few acres', VILLEIN: 'a villein of the manor', VIRGATER: 'a villein with a full virgate',
  REEVE: 'reeve of the manor', 'FREE TENANT': 'a free tenant', YEOMAN: 'a yeoman, free and landed', CRAFTSMAN: 'a free craftsman',
};

function ageWord(m: Member, day: number): string {
  const a = ageOf(m.bornDay, day);
  return a < 1 ? 'a babe in arms' : a < 4 ? 'a small child' : a < 7 ? 'a child' : a < 14 ? 'old enough to work' : a < 18 ? 'nearly grown' : a < 50 ? 'grown' : 'old';
}

const KIN: Record<string, [string, string]> = { spouse: ['Your husband', 'Your wife'], parent: ['Your father', 'Your mother'], child: ['Your son', 'Your daughter'] };

export function selfLines(s: SimState): string[] {
  const p = s.members[0];
  if (!p || s.dead) return [`The ${s.familyName} line has ended.`];
  const day = Math.floor(s.block / 6);
  const out = [`${p.name} ${s.familyName}, ${RANK_WORD[rankOf(s)]}.`];
  if (ageOf(p.bornDay, day) < 14) out.push('Young to be the head of a house.');
  out.push(...bodyLines(p.body, true, p.name));
  if (s.family.pregnantSince !== null && p.sex === 'f') out.push('You are with child.');
  return out;
}

export function householdLines(s: SimState): string[] {
  const out: string[] = [];
  const day = Math.floor(s.block / 6);
  for (const m of s.members.slice(1)) {
    if (!m.alive) continue;
    const kin = KIN[m.role] ?? ['Kin', 'Kin'];
    out.push(`${kin[m.sex === 'm' ? 0 : 1]} ${m.name}, ${ageWord(m, day)}.`);
    out.push(...bodyLines(m.body, false, m.name));
    if (m.role === 'spouse' && m.sex === 'f' && s.family.pregnantSince !== null) out.push(`${m.name} is with child.`);
  }
  if (s.members.length === 1) out.push('You are alone in the house.');
  const w = s.wealth;
  out.push(w.grain >= 40 ? 'The grain chest is full.' : w.grain >= 15 ? 'The grain chest is half empty.' : w.grain >= 3 ? 'The grain chest is nearly bare.' : 'There is no grain.');
  const cooked = w.bread + w.pottage;
  out.push(cooked >= 10 ? 'Bread and pottage on the shelf.' : cooked >= 2 ? 'A little bread is left.' : 'The pot is empty.');
  out.push(w.pence >= 40 ? 'A heavy purse.' : w.pence >= 10 ? 'A few pennies.' : w.pence > 0 ? 'Barely a penny.' : 'Not a penny to your name.');
  out.push(w.firewood >= 4 ? 'Wood stacked by the hearth.' : w.firewood >= 1 ? 'The woodpile is low.' : 'No wood for the fire.');
  if (w.ale >= 2) out.push('Ale in the jug.');
  const beasts = [w.hens ? `${w.hens === 1 ? 'a hen' : `${['', '', 'two', 'three', 'four', 'five', 'six'][w.hens] ?? 'many'} hens`}` : '', w.pig ? 'a pig' : '', w.cow ? 'a cow' : '', w.ox ? 'an ox' : ''].filter(Boolean);
  out.push(beasts.length ? `In the toft: ${beasts.join(', ')}.` : 'No beasts left.');
  if (w.tools < 30) out.push('Your tools are worn and blunt.');
  return out;
}

export function soulLines(s: SimState): string[] {
  const m = s.soul.morale;
  const out = [m > 75 ? 'Your heart is light.' : m > 50 ? 'You are content.' : m > 30 ? 'A weight sits on your heart.' : m > 15 ? 'Black thoughts come at night.' : 'Despair. You see no reason to rise.'];
  const pp = s.soul.privatePiety;
  out.push(pp > 60 ? 'You pray often and it comforts you.' : pp > 30 ? 'Your prayers are few.' : 'You have forgotten how to pray.');
  const pub = s.soul.publicPiety;
  out.push(pub > 60 ? 'The parish sees you at mass.' : pub > 30 ? 'You are seen at church, now and then.' : 'Your place in church stands empty.');
  return out;
}

const regard = (v: number, good: string, mid: string, bad: string) => (v > 65 ? good : v > 35 ? mid : bad);
const TAGS: Record<string, string> = {
  heathen: 'Mothers pull their children away from you.',
  drunkard: 'They call you a drunkard.',
  goodNeighbour: 'They call you a good neighbour.',
  debtor: 'You owe the manor.',
  suspect: 'The reeve has marked you a shirker.',
  penitent: 'You wear the penitent\'s sheet.',
  witch: 'They cross themselves when you pass. Witch, they whisper.',
  omen: 'Since the black dog, you cannot get warm.',
  brawler: 'Men remember the fight at the alehouse.',
};

export function standingLines(s: SimState): string[] {
  const st = s.standing;
  return [
    regard(st.lord, 'The steward nods to you.', 'The reeve watches you.', 'The reeve scowls when you pass.'),
    regard(st.priest, 'The priest greets you by name.', 'The priest says nothing to you.', 'The priest will not meet your eye.'),
    regard(st.village, 'Neighbours share their fire with you.', 'Neighbours keep to themselves.', 'Doors close when you walk by.'),
    ...s.tags.map((t) => TAGS[t.id] ?? ''),
    s.station.free ? 'You are free: no man\'s villein.' : 'You are the lord\'s villein, body and chattels.',
    s.hallmote.reeve === 'player' && rankOf(s) === 'REEVE' ? 'You are reeve this year: the lord\'s man among your neighbours.' : '',
  ].filter(Boolean);
}

const FEELING: Record<string, string> = {
  DEVOTED: 'would do anything for you', FRIENDLY: 'is fond of your house', CIVIL: 'is civil', COLD: 'is cold to you', HOSTILE: 'hates your house',
};

/** What each soul in Ashby thinks of the family, and what is owed either way. */
export function villageLines(s: SimState): string[] {
  const out: string[] = [];
  for (const v of s.village) {
    if (!v.alive) {
      out.push(`${v.name} lies in the churchyard.`);
      continue;
    }
    if (v.gone) {
      if (!s.members.some((m) => m.name === v.name.split(' ')[0] && m.role === 'spouse')) out.push(`${v.name} is gone from Ashby.`);
      continue;
    }
    let line = `${v.name} ${FEELING[opinionWord(v.opinion)]}`;
    if (v.owes > 0) line += v.owes > 1 ? ', and owes you favours' : ', and owes you a favour';
    else if (v.owes < 0) line += v.owes < -1 ? '. You owe them favours' : '. You owe them a favour';
    out.push(`${line}.`);
  }
  const live = s.village.filter(present).length;
  if (s.plague.vacant > 0) out.push(s.plague.vacant > 1 ? 'Holdings lie vacant for want of tenants.' : 'One holding lies vacant.');
  if (live < 8) out.push('The village is half empty.');
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Every generation of the family, in order. */
export function chronicleLines(s: SimState): string[] {
  const out: string[] = [`THE ${s.familyName} FAMILY OF ASHBY`];
  for (const c of s.chronicle) {
    const life = c.diedYear === null ? `born ${c.bornYear}, living` : `${c.bornYear}-${c.diedYear}`;
    out.push(`${ROMAN[c.generation - 1] ?? c.generation}. ${c.name}, ${life}. ${c.rank.toLowerCase()}.`);
    out.push(...c.notes);
    if (c.diedYear !== null) out.push(`Died ${c.cause}.`);
  }
  if (s.dead) out.push('The line is ended.');
  return out;
}

const STAGE: Record<string, string> = {
  fallow: 'lies fallow', unsown: 'waits for the plough and seed', growing: 'is green and growing', ripe: 'is ripe for the sickle', harvested: 'is stubble',
};

export function dutyLines(s: SimState): string[] {
  const o = s.obligations;
  const out = s.fields.map((f) => (f.acres === 0 ? `The ${f.id} strips are another man's now.` : `The ${f.id} field${f.crop ? ` (${f.crop})` : ''} ${STAGE[f.stage]}.`));
  if (o.evicted) out.push('You have been put off your holding.');
  else if (o.manorCourtHeld) out.push('One more failing and the steward will cast you out.');
  else if (o.strikes > 0) out.push('The reeve has your name in his roll.');
  if (o.manorCourtDay !== null) out.push('You are summoned to the manor court.');
  if (o.debt > 0) out.push('You are in debt to the manor.');
  if (o.churchCourtDay !== null) out.push('You are summoned before the church court.');
  if (o.penanceSundaysLeft > 0) out.push('Penance: you must stand in the white sheet on Sundays.');
  return out;
}

export function almanacLines(s: SimState, now: number): string[] {
  const k = clock(s, now);
  const i = k.info;
  const feasts = i.feasts.filter((f) => f !== 'lent' && f !== 'twelveDays');
  return [
    formatDate(i),
    `The ${k.blockName}. ${i.season[0]!.toUpperCase()}${i.season.slice(1)}.`,
    `The moon is ${MOON_PHASES[i.moon]}.`,
    k.weather.sky === 'fair' ? 'Fair skies.' : k.weather.sky === 'cloud' ? 'Grey skies.' : k.weather.sky === 'fog' ? 'Fog lies on the fields.' : k.weather.sky === 'rain' ? 'Rain.' : k.weather.sky === 'storm' ? 'A storm.' : 'Snow.',
    ...(feasts.length ? feasts.map((f) => `Today is ${f.replace(/([A-Z])/g, ' $1').toLowerCase()}.`) : []),
    ...(i.isLent ? ['It is Lent.'] : i.feasts.includes('twelveDays') ? ['The Twelve Days of Christmas.'] : []),
    ...(i.isFastDay ? ['A fast day: no meat.'] : []),
  ];
}

const n1 = (v: number) => Math.floor(v + 1e-9);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The household's stores, counted: what there is to eat, burn, sell and give. */
export function storesLines(s: SimState): string[] {
  const w = s.wealth;
  const out = [
    `Bread: ${plural(n1(w.bread), 'loaf', 'loaves')}.`,
    `Pottage: ${plural(n1(w.pottage), 'bowl', 'bowls')}.`,
    `Meat: ${plural(n1(w.meat), 'portion', 'portions')}.`,
    `Eggs: ${n1(w.eggs)}.`,
    `Grain: ${plural(n1(w.grain), 'bushel', 'bushels')}.`,
    `Ale: ${plural(n1(w.ale), 'jug', 'jugs')}.`,
    `Firewood: ${plural(n1(w.firewood), 'bundle', 'bundles')}.`,
    `Purse: ${n1(w.pence)}d.`,
  ];
  const beasts = [w.hens ? plural(w.hens, 'hen', 'hens') : '', w.pig ? 'a pig' : '', w.cow ? 'a cow' : '', w.ox ? 'an ox' : ''].filter(Boolean);
  out.push(`Beasts: ${beasts.length ? beasts.join(', ') : 'none'}.`);
  out.push(`Tools: ${w.tools >= 60 ? 'sound' : w.tools >= 30 ? 'worn' : 'nearly useless'}.`);
  if (s.obligations.debt > 0) out.push(`Owed to the manor: ${n1(s.obligations.debt)}d.`);
  out.push(`An offering at the barrow takes ${FAE.offeringBread === 2 ? 'two loaves' : `${FAE.offeringBread} loaves`} or ${FAE.offeringAle === 1 ? 'a jug' : `${FAE.offeringAle} jugs`} of ale.`);
  return out;
}

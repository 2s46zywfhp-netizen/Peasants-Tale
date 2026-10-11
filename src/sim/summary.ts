import type { ActionId } from './balance';
import { BLOCK_NAMES, dayInfo, formatDate } from './calendar';
import type { LogEntry, LogType } from './state';

/** Absolute block index at which a log entry was written. */
export function entryBlock(e: LogEntry): number {
  return e.day * 6 + BLOCK_NAMES.indexOf(e.block);
}

/** Entries kept verbatim in the Parchment Log: things that happened, not routine. */
export const NOTABLE: ReadonlySet<LogType> = new Set([
  'farm', 'manor', 'church', 'illness', 'death', 'event', 'feast', 'neglect', 'body', 'weather', 'trade',
  'village', 'family', 'court', 'dark', 'plague', 'rank',
]);

/** How each kind of action is told in summary: [phrase for one, phrase for many]. */
/** Every deed but eating (meals are counted on their own) has words: the type makes a missing one an error. */
export const PHRASE: Readonly<Record<Exclude<ActionId, 'eat'>, readonly [string, string]>> = {
  workStrips: ['worked the strips once', 'worked the strips # times'],
  weekWork: ['laboured for the lord once', 'laboured for the lord # times'],
  attendMass: ['heard mass', 'heard mass # times'],
  pray: ['prayed in church once', 'prayed in church # times'],
  prayHome: ['prayed at home once', 'prayed at home # times'],
  confess: ['confessed', 'confessed # times'],
  tavern: ['drank at the alehouse', 'drank at the alehouse # times'],
  gatherFirewood: ['gathered wood once', 'gathered wood # times'],
  wash: ['washed once', 'washed # times'],
  cook: ['cooked once', 'cooked # times'],
  brew: ['brewed ale', 'brewed ale # times'],
  socialise: ['went to the green', 'went to the green # times'],
  trade: ['traded once', 'traded # times'],
  sleep: ['slept once', 'slept # times'],
  rest: ['rested once', 'rested # times'],
  hire: ['worked for wages once', 'worked for wages # times'],
  beg: ['begged once', 'begged # times'],
  poach: ['poached once', 'poached # times'],
  helpNeighbour: ['helped a neighbour', 'helped neighbours # times'],
  court: ['went courting', 'went courting # times'],
  marry: ['was wed at the church door', 'was wed # times'],
  askFavour: ['asked a favour', 'asked favours # times'],
  accuse: ['accused a neighbour before the priest', 'made # accusations'],
  takeHolding: ['took up a holding', 'took up # holdings'],
  buyFreedom: ['bought freedom from the lord', 'tried # times to buy freedom'],
  flee: ['fled toward the town', 'fled # times'],
  rob: ['robbed travellers on the road', 'robbed travellers # times'],
  offering: ['left an offering at the barrow', 'left # offerings at the barrow'],
  surrender: ['gave up the greenwood', 'gave up the greenwood # times'],
  stokeFire: ['fed the fire', 'fed the fire # times'],
};

export interface Summary {
  fromBlock: number;
  toBlock: number;
  days: number;
  /** Times each action was begun in the period (meals counted separately). */
  counts: Partial<Record<ActionId, number>>;
  meals: number;
  notable: LogEntry[];
  /** The Parchment Log text, one sentence or entry per item. */
  lines: string[];
}

/** Summarise the log written in blocks [fromBlock, toBlock). */
export function summarize(log: readonly LogEntry[], fromBlock: number, toBlock: number, name: string): Summary {
  const counts: Partial<Record<ActionId, number>> = {};
  let meals = 0;
  const notable: LogEntry[] = [];
  for (const e of log) {
    const b = entryBlock(e);
    if (b < fromBlock || b >= toBlock) continue;
    if (e.action === 'eat') meals++;
    else if (e.action && (e.type === 'auto' || e.type === 'action')) counts[e.action] = (counts[e.action] ?? 0) + 1;
    else if (NOTABLE.has(e.type)) notable.push(e);
  }
  const days = Math.max(0, Math.round((toBlock - fromBlock) / 6));
  const from = formatDate(dayInfo(Math.floor(fromBlock / 6)), false);
  const to = formatDate(dayInfo(Math.floor(Math.max(fromBlock, toBlock - 1) / 6)), false);
  const lines: string[] = [];
  lines.push(days === 1 ? 'A day has passed.' : `${days} days have passed.`);
  lines.push(`${from} to ${to}.`);
  const did = (Object.keys(PHRASE) as ActionId[])
    .filter((a) => (counts[a] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .map((a) => {
      const n = counts[a]!;
      const [one, many] = PHRASE[a as Exclude<ActionId, 'eat'>];
      return n === 1 ? one : many.replace('#', String(n));
    });
  if (did.length) lines.push(`${name} ${did.join(', ')}.`);
  lines.push(meals === 0 ? 'Nothing was eaten.' : meals === 1 ? 'One meal was eaten.' : `${meals} meals were eaten.`);
  for (const e of notable) lines.push(`${e.date.slice(0, 6)}: ${e.text}`);
  if (!notable.length) lines.push('Nothing else of note.');
  return { fromBlock, toBlock, days, counts, meals, notable, lines };
}

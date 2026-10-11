import type { ActionId, TradeKind } from '../sim/balance';
import type { Field } from '../sim/state';
import type { BeltTool } from '../save/schema';

/** The icon for every action (and trade, food) in menus. */
export const ACTION_ICON: Readonly<Record<ActionId, string>> = {
  eat: 'bowl', cook: 'ladle', brew: 'ale', sleep: 'bed', workStrips: 'hoe', weekWork: 'sickle', attendMass: 'prayer', pray: 'prayer',
  confess: 'prayer', tavern: 'ale', gatherFirewood: 'axe', wash: 'bucket', socialise: 'ale', trade: 'coin', rest: 'bed', court: 'prayer',
  marry: 'prayer', helpNeighbour: 'hoe', askFavour: 'coin', accuse: 'prayer', takeHolding: 'coin', buyFreedom: 'pence', hire: 'flail',
  beg: 'bowl', flee: 'seedbag', poach: 'axe', rob: 'coin', offering: 'bread', surrender: 'prayer', prayHome: 'prayer',
};
export const PARAM_ICON: Readonly<Record<string, string>> = {
  pottage: 'pottage', bread: 'bread', eggs: 'eggs', meat: 'meat', grain: 'grain',
  sellGrain: 'grain', buyGrain: 'grain', sellEggs: 'eggs', buyFirewood: 'firewood', sellAle: 'ale',
  buyHen: 'hen', sellHen: 'hen', buyPig: 'pig', sellPig: 'pig', buyCow: 'cow', sellCow: 'cow', buyOx: 'ox', sellOx: 'ox', mendTools: 'hoe',
};

/** What each tool on the belt is for: A on a place picks the first of these it offers. */
export const TOOL_ACTIONS: Readonly<Record<BeltTool, readonly ActionId[]>> = {
  axe: ['gatherFirewood', 'poach'],
  hoe: ['workStrips', 'helpNeighbour', 'weekWork'],
  sickle: ['workStrips', 'weekWork', 'hire'],
  flail: ['weekWork', 'hire', 'workStrips'],
  seedbag: ['workStrips'],
  ladle: ['cook', 'brew'],
  bucket: ['wash', 'brew'],
};

export type WorkAnim = 'chop' | 'split' | 'hoe' | 'reap' | 'flail' | 'sow' | 'carry' | 'stir' | 'milk' | 'pray' | 'eat' | 'sleep';

/** The work animation for an action, from the field's state and the tool on the belt. */
export function workAnim(action: ActionId, belt: BeltTool, field: Field | null, alt = false): WorkAnim | null {
  switch (action) {
    case 'gatherFirewood':
    case 'poach':
      return alt ? 'split' : 'chop';
    case 'workStrips':
      if (field?.stage === 'unsown') return 'sow';
      if (field?.stage === 'ripe') return 'reap';
      if (field?.stage === 'harvested') return 'flail';
      if (field?.stage === 'growing') return 'hoe';
      return belt === 'sickle' ? 'reap' : belt === 'flail' ? 'flail' : belt === 'seedbag' ? 'sow' : 'hoe';
    case 'weekWork':
    case 'hire':
    case 'helpNeighbour':
      return belt === 'sickle' ? 'reap' : belt === 'flail' ? 'flail' : belt === 'hoe' ? 'hoe' : belt === 'seedbag' ? 'sow' : 'carry';
    case 'cook':
    case 'brew':
      return 'stir';
    case 'wash':
    case 'trade':
      return 'carry';
    case 'pray':
    case 'prayHome':
    case 'attendMass':
    case 'confess':
    case 'offering':
      return 'pray';
    case 'sleep':
      return 'sleep';
    case 'eat':
      return 'eat';
    default:
      return null;
  }
}

/** Market lines in menus and the queue. */
export const TRADE_LABEL: Readonly<Record<TradeKind, string>> = {
  sellGrain: 'SELL GRAIN', buyGrain: 'BUY GRAIN', sellEggs: 'SELL EGGS', buyFirewood: 'BUY FIREWOOD', sellAle: 'SELL ALE',
  buyHen: 'BUY A HEN', sellHen: 'SELL A HEN', buyPig: 'BUY A PIG', sellPig: 'SELL THE PIG', buyCow: 'BUY A COW', sellCow: 'SELL THE COW',
  buyOx: 'BUY AN OX', sellOx: 'SELL THE OX', mendTools: 'MEND THE TOOLS',
};

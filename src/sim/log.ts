import { LOG_MAX_ENTRIES } from './balance';
import { BLOCK_NAMES, dayInfo, formatDate } from './calendar';
import type { ActionId } from './balance';
import type { LogEntry, LogType, SimState } from './state';

export function log(s: SimState, type: LogType, text: string, actors: string[] = s.members[0] ? [s.members[0].name] : [], action?: ActionId): void {
  const day = Math.floor(s.block / 6);
  const e: LogEntry = { day, date: formatDate(dayInfo(day), false), block: BLOCK_NAMES[s.block % 6]!, type, actors, text };
  if (action) e.action = action;
  s.log.push(e);
  if (s.log.length > LOG_MAX_ENTRIES) s.log.splice(0, s.log.length - LOG_MAX_ENTRIES);
}

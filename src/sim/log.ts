import { LOG_MAX_ENTRIES } from './balance';
import { BLOCK_NAMES, dayInfo, formatDate } from './calendar';
import type { LogType, SimState } from './state';

export function log(s: SimState, type: LogType, text: string, actors: string[] = [s.members[0]!.name]): void {
  const day = Math.floor(s.block / 6);
  s.log.push({ day, date: formatDate(dayInfo(day), false), block: BLOCK_NAMES[s.block % 6]!, type, actors, text });
  if (s.log.length > LOG_MAX_ENTRIES) s.log.splice(0, s.log.length - LOG_MAX_ENTRIES);
}

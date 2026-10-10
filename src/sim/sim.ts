import { MAX_CATCHUP_BLOCKS, SIM_BLOCK_MS, START_DAY, START_HOUR, START_MONTH, START_YEAR } from './balance';
import { mulberry32Next } from './rng';

export interface SimState {
  seed: number;
  rngState: number;
  /** Real-world ms timestamp at which this life began. */
  startedAt: number;
  /** Real-world ms timestamp up to which blocks have been processed. */
  processedTo: number;
  /** Total sim blocks processed. */
  blocks: number;
}

export function createSim(seed: number, now: number): SimState {
  return { seed: seed >>> 0, rngState: seed >>> 0, startedAt: now, processedTo: now, blocks: 0 };
}

function runBlock(s: SimState): SimState {
  // Phase 1: a block only advances the PRNG and the counter. Later phases simulate life here.
  const { state } = mulberry32Next(s.rngState);
  return { ...s, rngState: state, blocks: s.blocks + 1, processedTo: s.processedTo + SIM_BLOCK_MS };
}

/** Processes every whole block between processedTo and now. Pure: returns a new state. */
export function advance(state: SimState, now: number): { state: SimState; blocksRun: number } {
  if (now < state.processedTo) return { state, blocksRun: 0 };
  let due = Math.floor((now - state.processedTo) / SIM_BLOCK_MS);
  let s = state;
  if (due > MAX_CATCHUP_BLOCKS) {
    // Skip ancient history in one jump; only the most recent window is simulated in detail.
    const skipped = due - MAX_CATCHUP_BLOCKS;
    s = { ...s, processedTo: s.processedTo + skipped * SIM_BLOCK_MS, blocks: s.blocks + skipped };
    due = MAX_CATCHUP_BLOCKS;
  }
  for (let i = 0; i < due; i++) s = runBlock(s);
  return { state: s, blocksRun: due };
}

export interface GameClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Day number of this life, starting at 1. */
  dayOfLife: number;
}

/** The peasant lives in real time: game time is real elapsed time offset onto 1345. */
export function gameClock(state: SimState, now: number): GameClock {
  const elapsedMin = Math.max(0, Math.floor((now - state.startedAt) / 60_000)) + START_HOUR * 60;
  const dayOffset = Math.floor(elapsedMin / 1440);
  const minOfDay = elapsedMin % 1440;
  // Calendar maths only, not a clock read. 2001 shares 1345's leap-year phase (Julian 1348 ~ 2004).
  const d = new Date(Date.UTC(2001, START_MONTH - 1, START_DAY + dayOffset));
  const yearOffset = d.getUTCFullYear() - 2001;
  return {
    year: START_YEAR + yearOffset,
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: Math.floor(minOfDay / 60),
    minute: minOfDay % 60,
    dayOfLife: dayOffset + 1,
  };
}

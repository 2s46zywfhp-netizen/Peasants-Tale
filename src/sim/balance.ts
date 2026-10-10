// Every tunable number in the game lives here.

/** Real milliseconds per sim block. The sim advances in whole blocks; the game autosaves after each. */
export const SIM_BLOCK_MS = 60_000;
/** Most blocks processed in one advance() call when catching up after the app was closed. */
export const MAX_CATCHUP_BLOCKS = 60 * 24 * 7;

/** Game calendar origin: the peasant's story begins on Lady Day, 25 March 1345. */
export const START_YEAR = 1345;
export const START_MONTH = 3;
export const START_DAY = 25;
/** In-game hour at which a fresh life begins. */
export const START_HOUR = 6;

/** Held D-pad directions: delay before the first repeat, then interval between repeats (ms). */
export const INPUT_REPEAT_DELAY_MS = 280;
export const INPUT_REPEAT_INTERVAL_MS = 90;
/** navigator.vibrate pulse length for a button press (ms). */
export const HAPTIC_TICK_MS = 8;

/** Full scene transition duration (fade out + fade in), ms. */
export const FADE_MS = 400;

/** Typewriter text speeds, characters per second. */
export const TEXT_SPEED_CPS = { slow: 18, normal: 40, fast: 120 } as const;

/** Title screen. */
export const TITLE_BLINK_MS = 530;
export const CANDLE_FLICKER_MS = 70;

/** Placeholder village: peasant walk step in screen pixels. */
export const WALK_STEP_PX = 2;

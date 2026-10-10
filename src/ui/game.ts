import type { Audio, Sfx } from '../audio/sfx';
import type { Input } from '../input/input';
import type { SaveManager } from '../save/saveManager';
import type { Settings } from '../save/schema';
import type { ActionId } from '../sim/balance';
import type { SimState } from '../sim/sim';
import type { SceneManager } from './scene';

/** What scenes are allowed to touch. */
export interface Game {
  readonly scenes: SceneManager;
  readonly input: Input;
  readonly save: SaveManager;
  readonly audio: Audio;
  /** Wall-clock ms (Date.now): for the sim. */
  now(): number;
  /** Frame clock: integer ms since boot, as passed to update/draw. For UI timers and animation. */
  frameNow(): number;
  newSeed(): number;
  sfx(name: Sfx): void;
  updateSettings(patch: Partial<Settings>): void;
  /** Re-apply settings after the whole save changed (import). */
  applySettings(): void;
  /** The current life (read-only for rendering). */
  sim(): SimState;
  /** Dispatch a player action to the sim; persists on success. */
  act(id: ActionId, param?: string | null): { ok: boolean; message: string };
  /** Replace the whole sim state (debug tools, new life); persists. */
  setSim(s: SimState): void;
  /** The player has read the log up to this block. */
  markSeen(block: number): void;
}

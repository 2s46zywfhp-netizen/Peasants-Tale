import type { Audio, Sfx } from '../audio/sfx';
import type { Input } from '../input/input';
import type { SaveManager } from '../save/saveManager';
import type { Settings } from '../save/schema';
import type { SceneManager } from './scene';

/** What scenes are allowed to touch. */
export interface Game {
  readonly scenes: SceneManager;
  readonly input: Input;
  readonly save: SaveManager;
  readonly audio: Audio;
  now(): number;
  newSeed(): number;
  sfx(name: Sfx): void;
  updateSettings(patch: Partial<Settings>): void;
  /** Re-apply settings after the whole save changed (import). */
  applySettings(): void;
}

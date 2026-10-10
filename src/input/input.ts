import { INPUT_REPEAT_DELAY_MS, INPUT_REPEAT_INTERVAL_MS } from '../sim/balance';

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';
export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'start' | 'select';

/** Physical button -> logical action. Scenes only ever see actions. */
export const BUTTON_ACTIONS: Readonly<Record<Button, Action>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  a: 'confirm',
  b: 'cancel',
  start: 'start',
  select: 'select',
};


export interface ActionEvent {
  action: Action;
  repeat: boolean;
}
export type ActionListener = (e: ActionEvent) => void;

const INDEX: Readonly<Record<Button, number>> = { up: 0, down: 1, left: 2, right: 3, a: 4, b: 5, start: 6, select: 7 };
/** One frozen event per (button, repeat): emitting allocates nothing. */
const EVENTS: readonly (readonly [ActionEvent, ActionEvent])[] = BUTTONS.map((b) => [
  Object.freeze({ action: BUTTON_ACTIONS[b], repeat: false }),
  Object.freeze({ action: BUTTON_ACTIONS[b], repeat: true }),
] as const);

/**
 * Collects presses from any number of sources (touch pointers, keyboard) and
 * emits actions. Held directions repeat; other buttons fire once per press.
 * State lives in fixed per-button arrays so update() allocates nothing.
 */
export class Input {
  private sources: Set<string>[] = BUTTONS.map(() => new Set<string>());
  private nextRepeat = new Float64Array(BUTTONS.length);
  private listeners: ActionListener[] = [];
  /** Called on every fresh press (haptics, sound). */
  onPress: ((b: Button) => void) | null = null;

  subscribe(fn: ActionListener): () => void {
    this.listeners = [...this.listeners, fn];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  isHeld(b: Button): boolean {
    return this.sources[INDEX[b]]!.size > 0;
  }

  press(b: Button, source: string, now: number): void {
    const set = this.sources[INDEX[b]]!;
    const fresh = set.size === 0;
    set.add(source);
    if (!fresh) return;
    this.nextRepeat[INDEX[b]] = now + INPUT_REPEAT_DELAY_MS;
    this.onPress?.(b);
    this.emit(EVENTS[INDEX[b]]![0]!);
  }

  release(b: Button, source: string): void {
    this.sources[INDEX[b]]!.delete(source);
  }

  releaseAll(): void {
    for (let i = 0; i < this.sources.length; i++) this.sources[i]!.clear();
  }

  update(now: number): void {
    for (let i = 0; i < 4; i++) {
      if (this.sources[i]!.size === 0) continue;
      while (now >= this.nextRepeat[i]!) {
        this.nextRepeat[i] = this.nextRepeat[i]! + INPUT_REPEAT_INTERVAL_MS;
        this.emit(EVENTS[i]![1]!);
      }
    }
  }

  /** Listeners are replaced, never mutated, so iterating the current array is safe without a copy. */
  private emit(e: ActionEvent): void {
    const ls = this.listeners;
    for (let i = 0; i < ls.length; i++) ls[i]!(e);
  }
}

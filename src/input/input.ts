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

const REPEATS: ReadonlySet<Button> = new Set(['up', 'down', 'left', 'right']);

export interface ActionEvent {
  action: Action;
  repeat: boolean;
}
export type ActionListener = (e: ActionEvent) => void;

interface Held {
  sources: Set<string>;
  nextRepeat: number;
}

/**
 * Collects presses from any number of sources (touch pointers, keyboard) and
 * emits actions. Held directions repeat; other buttons fire once per press.
 */
export class Input {
  private held = new Map<Button, Held>();
  private listeners = new Set<ActionListener>();
  /** Called on every fresh press (haptics, sound). */
  onPress: ((b: Button) => void) | null = null;

  subscribe(fn: ActionListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  isHeld(b: Button): boolean {
    return this.held.has(b);
  }

  press(b: Button, source: string, now: number): void {
    const h = this.held.get(b);
    if (h) {
      h.sources.add(source);
      return;
    }
    this.held.set(b, { sources: new Set([source]), nextRepeat: now + INPUT_REPEAT_DELAY_MS });
    this.onPress?.(b);
    this.emit({ action: BUTTON_ACTIONS[b], repeat: false });
  }

  release(b: Button, source: string): void {
    const h = this.held.get(b);
    if (!h) return;
    h.sources.delete(source);
    if (h.sources.size === 0) this.held.delete(b);
  }

  releaseAll(): void {
    this.held.clear();
  }

  update(now: number): void {
    for (const [b, h] of this.held) {
      if (!REPEATS.has(b)) continue;
      while (now >= h.nextRepeat) {
        h.nextRepeat += INPUT_REPEAT_INTERVAL_MS;
        this.emit({ action: BUTTON_ACTIONS[b], repeat: true });
      }
    }
  }

  private emit(e: ActionEvent): void {
    for (const fn of [...this.listeners]) fn(e);
  }
}

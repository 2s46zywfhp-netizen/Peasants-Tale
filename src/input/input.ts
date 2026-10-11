import { INPUT_REPEAT_DELAY_MS, INPUT_REPEAT_INTERVAL_MS } from '../sim/balance';

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select' | 'l' | 'r';
export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select', 'l', 'r'];

/** `belt`: L cycles the tool on the belt. `queue`: R queues a task, or shows the queue. */
export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'start' | 'select' | 'belt' | 'queue';

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
  l: 'belt',
  r: 'queue',
};


export interface ActionEvent {
  action: Action;
  repeat: boolean;
}
export type ActionListener = (e: ActionEvent) => void;

const INDEX: Readonly<Record<Button, number>> = { up: 0, down: 1, left: 2, right: 3, a: 4, b: 5, start: 6, select: 7, l: 8, r: 9 };
const START = 6;
const SELECT = 7;
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
  /**
   * START and SELECT act on release, and not at all if the other was held meanwhile: holding both is the
   * debug combo, which must not also open the title's game or settings.
   */
  private metaPending = new Uint8Array(BUTTONS.length);
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
    const i = INDEX[b];
    this.nextRepeat[i] = now + INPUT_REPEAT_DELAY_MS;
    this.onPress?.(b);
    if (i === START || i === SELECT) {
      const other = i === START ? SELECT : START;
      if (this.sources[other]!.size > 0 || this.metaPending[other] === 2) {
        this.metaPending[i] = 2; // part of the combo
        this.metaPending[other] = 2;
      } else this.metaPending[i] = 1;
      return;
    }
    this.emit(EVENTS[i]![0]!);
  }

  release(b: Button, source: string): void {
    const i = INDEX[b];
    const set = this.sources[i]!;
    if (!set.delete(source) || set.size > 0) return;
    if (i === START || i === SELECT) {
      const was = this.metaPending[i];
      this.metaPending[i] = 0;
      if (was === 1) this.emit(EVENTS[i]![0]!);
    }
  }

  releaseAll(): void {
    for (let i = 0; i < this.sources.length; i++) this.sources[i]!.clear();
    this.metaPending.fill(0);
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

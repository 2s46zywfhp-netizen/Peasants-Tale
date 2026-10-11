import { fade } from '../render/draw';
import { FADE_MS } from '../sim/balance';
import type { ActionEvent, Input } from '../input/input';

export interface Scene {
  /** Opaque scenes hide everything beneath them; overlays (dialogs) draw on top of the scene below. */
  readonly opaque: boolean;
  enter?(): void;
  exit?(): void;
  onAction?(e: ActionEvent): void;
  update?(dtMs: number, nowMs: number): void;
  /** Draws into the 256x224 indexed frame (render/fb). */
  draw(nowMs: number): void;
}

type Op = { kind: 'push' | 'replace'; scene: Scene } | { kind: 'pop' };

/** Stack of scenes with push / pop / replace and a dithered fade through black. */
export class SceneManager {
  private stack: Scene[] = [];
  private pending: Op | null = null;
  /** Transition progress in ms, or -1 when idle. */
  private t = -1;

  constructor(input: Input) {
    input.subscribe((e) => {
      if (this.t >= 0) return; // swallow input mid-fade
      this.top?.onAction?.(e);
    });
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }
  get depth(): number {
    return this.stack.length;
  }
  get transitioning(): boolean {
    return this.t >= 0;
  }

  push(scene: Scene, fade = true): void {
    this.start({ kind: 'push', scene }, fade);
  }
  replace(scene: Scene, fade = true): void {
    this.start({ kind: 'replace', scene }, fade);
  }
  pop(fade = true): void {
    this.start({ kind: 'pop' }, fade);
  }

  private start(op: Op, fade: boolean): void {
    if (this.t >= 0) return;
    if (!fade || this.stack.length === 0) {
      this.apply(op);
      return;
    }
    this.pending = op;
    this.t = 0;
  }

  private apply(op: Op): void {
    if (op.kind !== 'push') this.stack.pop()?.exit?.();
    if (op.kind !== 'pop') {
      this.stack.push(op.scene);
      op.scene.enter?.();
    }
  }

  update(dt: number, now: number): void {
    if (this.t >= 0) {
      const half = FADE_MS / 2;
      const before = this.t;
      this.t += dt;
      if (before < half && this.t >= half && this.pending) {
        this.apply(this.pending);
        this.pending = null;
      }
      if (this.t >= FADE_MS) this.t = -1;
    }
    this.top?.update?.(dt, now);
  }

  /** 0 = fully visible, 1 = fully black. */
  fadeAmount(): number {
    if (this.t < 0) return 0;
    const half = FADE_MS / 2;
    return this.t < half ? this.t / half : Math.max(0, 1 - (this.t - half) / half);
  }

  draw(now: number): void {
    let from = this.stack.length - 1;
    while (from > 0 && !this.stack[from]!.opaque) from--;
    for (let i = Math.max(0, from); i < this.stack.length; i++) this.stack[i]!.draw(now);
    // Quantise to a few steps so the fade reads as a retro palette fade.
    fade(Math.round(this.fadeAmount() * 4) / 4);
  }
}

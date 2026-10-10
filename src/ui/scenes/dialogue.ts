import { frame, rect } from '../../render/draw';
import { drawText, wrap } from '../../render/font';
import { C, useUiRemap } from '../../render/palette';
import { TEXT_SPEED_CPS } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';

const LINES = 3;

/** A dialogue box: typewriter text at the player's text speed, with a blip per letter. */
export class DialogueScene implements Scene {
  readonly opaque = false;
  private page = 0;
  private startedAt = 0;
  private lines: string[] = [];
  private blipped = 0;

  constructor(
    private game: Game,
    private speaker: string,
    private pages: readonly string[],
    private onClose?: () => void,
  ) {}

  enter(): void {
    this.open(0);
  }

  private open(p: number): void {
    this.page = p;
    this.lines = wrap(this.pages[p]!.toUpperCase(), 18).slice(0, LINES);
    this.startedAt = this.game.frameNow();
    this.blipped = 0;
  }

  private shown(now: number): number {
    const cps = TEXT_SPEED_CPS[this.game.save.data.settings.textSpeed];
    return Math.floor(((now - this.startedAt) / 1000) * cps);
  }

  private total(): number {
    return this.lines.reduce((n, l) => n + l.length, 0);
  }

  onAction(e: ActionEvent): void {
    if (e.repeat) return;
    if (e.action === 'confirm') {
      if (this.shown(this.game.frameNow()) < this.total()) {
        this.startedAt = -1e12; // finish the page at once
        return;
      }
      if (this.page + 1 < this.pages.length) return this.open(this.page + 1);
    }
    if (e.action === 'confirm' || e.action === 'cancel') {
      this.game.scenes.pop(false);
      this.onClose?.();
    }
  }

  update(_dt: number, now: number): void {
    const n = Math.min(this.shown(now), this.total());
    if (n > this.blipped) {
      if (n - this.blipped >= 2 || n === this.total()) {
        this.game.sfx('blip');
        this.blipped = n;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    useUiRemap();
    frame(ctx, 2, 96, 156, 40, C.parchment, C.night);
    if (this.speaker) {
      rect(ctx, 6, 90, this.speaker.length * 8 + 4, 10, C.night);
      drawText(ctx, this.speaker, 8, 91, C.gold);
    }
    let left = this.shown(now);
    for (let i = 0; i < this.lines.length && left > 0; i++) {
      const l = this.lines[i]!;
      drawText(ctx, left >= l.length ? l : l.slice(0, left), 8, 102 + i * 10, C.bone);
      left -= l.length;
    }
    if (left >= 0 && Math.floor(now / 400) % 2 === 0) drawText(ctx, this.page + 1 < this.pages.length ? '>' : '.', 146, 126, C.ember);
  }
}

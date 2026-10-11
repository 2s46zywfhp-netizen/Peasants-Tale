import { darkPanel, parchment, INK } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, wrap } from '../../render/font';
import { C } from '../../render/palette';
import { TEXT_SPEED_CPS } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';

const LINES = 4;
const COLS = 29;
const TOP = 142;

/** A dialogue box: typewriter text at the player's text speed, with a blip per letter. */
export class DialogueScene implements Scene {
  readonly opaque = false;
  private page = 0;
  private startedAt = 0;
  private lines: string[] = [];
  private blipped = 0;
  private total = 0;

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
    this.lines = wrap(this.pages[p]!.toUpperCase(), COLS).slice(0, LINES);
    this.total = this.lines.reduce((n, l) => n + l.length, 0);
    this.startedAt = this.game.frameNow();
    this.blipped = 0;
  }

  private shown(now: number): number {
    const cps = TEXT_SPEED_CPS[this.game.save.data.settings.textSpeed];
    return Math.floor(((now - this.startedAt) / 1000) * cps);
  }

  onAction(e: ActionEvent): void {
    if (e.repeat) return;
    if (e.action === 'confirm') {
      if (this.shown(this.game.frameNow()) < this.total) {
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
    const n = Math.min(this.shown(now), this.total);
    if (n > this.blipped && (n - this.blipped >= 2 || n === this.total)) {
      this.game.sfx('blip');
      this.blipped = n;
    }
  }

  draw(now: number): void {
    darkPanel(4, TOP, W - 8, 62);
    if (this.speaker) {
      parchment(10, TOP - 14, this.speaker.length * 8 + 16, 20);
      drawText(this.speaker, 18, TOP - 8, INK.title);
    }
    let left = this.shown(now);
    for (let i = 0; i < this.lines.length && left > 0; i++) {
      const l = this.lines[i]!;
      drawText(left >= l.length ? l : l.slice(0, left), 12, TOP + 12 + i * 11, C.bone);
      left -= l.length;
    }
    if (left >= 0 && Math.floor(now / 400) % 2 === 0) drawText(this.page + 1 < this.pages.length ? '>' : '.', W - 22, TOP + 48, C.flame);
  }
}

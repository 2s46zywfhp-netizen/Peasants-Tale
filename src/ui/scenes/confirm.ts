import { INK, parchment } from '../../render/draw';
import { H, W } from '../../render/fb';
import { drawTextCentered } from '../../render/font';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';

/** Yes/no dialog drawn over the scene beneath it. */
export class ConfirmScene implements Scene {
  readonly opaque = false;
  constructor(
    private game: Game,
    private lines: readonly string[],
    private onYes: () => void,
  ) {}

  onAction(e: ActionEvent): void {
    if (e.action === 'confirm') {
      this.game.sfx('confirm');
      this.game.scenes.pop(false);
      this.onYes();
    } else if (e.action === 'cancel') {
      this.game.sfx('cancel');
      this.game.scenes.pop(false);
    }
  }

  draw(): void {
    const h = 36 + this.lines.length * 12;
    const y = (H - h) >> 1;
    parchment(16, y, W - 32, h);
    for (let i = 0; i < this.lines.length; i++) drawTextCentered(this.lines[i]!, y + 12 + i * 12, INK.text);
    drawTextCentered('A: YES    B: NO', y + h - 18, INK.title);
  }
}

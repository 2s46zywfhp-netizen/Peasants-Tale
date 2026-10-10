import { frame } from '../../render/draw';
import { drawTextCentered } from '../../render/font';
import { C } from '../../render/palette';
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

  draw(ctx: CanvasRenderingContext2D): void {
    const h = 28 + this.lines.length * 12;
    const y = Math.floor((144 - h) / 2);
    frame(ctx, 8, y, 144, h, C.blood, C.night);
    this.lines.forEach((l, i) => drawTextCentered(ctx, l, y + 8 + i * 12, C.bone));
    drawTextCentered(ctx, 'A:YES   B:NO', y + h - 14, C.gold);
  }
}

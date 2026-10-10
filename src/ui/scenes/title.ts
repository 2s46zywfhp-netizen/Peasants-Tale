import { atlasImage, drawSprite, spriteId } from '../../render/atlas';
import { clear, ditherFill, rect } from '../../render/draw';
import { drawTextCentered } from '../../render/font';
import { C, currentRemap, useUiRemap, type Ci } from '../../render/palette';
import { CANDLE_FLICKER_MS, TITLE_BLINK_MS } from '../../sim/balance';
import { Rng } from '../../sim/rng';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { SettingsScene } from './settings';
import { ParchmentLogScene } from './parchmentLog';
import { WorldScene } from './world';

/** Candle-light glow: concentric dithered rings [radius offset, colour, density]. */
const RINGS: readonly (readonly [number, Ci, number])[] = [
  [10, C.night, 0.5],
  [0, C.navy, 0.6],
  [-8, C.teal, 0.35],
];

export class TitleScene implements Scene {
  readonly opaque = true;
  private rng = new Rng(1345);
  private flame = 0;
  private glow = 22;
  private nextFlicker = 0;
  private candle = spriteId('ui.candle');
  private flames = [0, 1, 2, 3].map((i) => spriteId(`ui.flame.${i}`));

  constructor(private game: Game) {}

  onAction(e: ActionEvent): void {
    if (e.action === 'start' || e.action === 'confirm') {
      const g = this.game;
      g.sfx('start');
      g.scenes.replace(new WorldScene(g));
      // Returning after time away: the Parchment Log tells what happened.
      const seen = g.save.data.seenBlock;
      if (g.sim().block > seen) g.scenes.push(new ParchmentLogScene(g, seen, g.sim().block), false);
    } else if (e.action === 'select') {
      this.game.sfx('confirm');
      this.game.scenes.push(new SettingsScene(this.game));
    }
  }

  update(_dt: number, now: number): void {
    if (now >= this.nextFlicker) {
      this.nextFlicker = now + CANDLE_FLICKER_MS * (1 + this.rng.int(3));
      this.flame = this.rng.int(this.flames.length);
      this.glow = 19 + this.rng.int(6);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    useUiRemap();
    clear(ctx, C.black);
    const cx = 80;
    const fy = 62;
    for (let k = 0; k < RINGS.length; k++) {
      const [dr, c, amt] = RINGS[k]!;
      const r = this.glow + dr;
      for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        ditherFill(ctx, amt, c, cx - half, fy + 14 + y, half * 2, 1);
      }
    }
    const img = atlasImage(currentRemap());
    rect(ctx, cx - 14, 102, 28, 3, C.wood);
    rect(ctx, cx - 10, 105, 20, 2, C.mud);
    rect(ctx, cx - 2, 99, 4, 3, C.wood);
    drawSprite(ctx, img, this.candle, cx - 5, 83);
    rect(ctx, cx, 80, 1, 3, C.black);
    drawSprite(ctx, img, this.flames[this.flame]!, cx - 2, fy + 11);

    drawTextCentered(ctx, "PEASANT'S LIFE", 16, C.gold);
    drawTextCentered(ctx, 'ANNO DOMINI 1345', 30, C.blood);
    if (Math.floor(now / TITLE_BLINK_MS) % 2 === 0) drawTextCentered(ctx, 'PRESS START', 118, C.bone);
    drawTextCentered(ctx, 'SELECT: SETTINGS', 134, C.slate);
  }
}

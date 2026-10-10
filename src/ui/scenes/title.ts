import { clear, ditherFill, rect, sprite } from '../../render/draw';
import { drawTextCentered } from '../../render/font';
import { C } from '../../render/palette';
import { CANDLE_FLICKER_MS, TITLE_BLINK_MS } from '../../sim/balance';
import { Rng } from '../../sim/rng';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { SettingsScene } from './settings';
import { VillageScene } from './village';

const FLAMES = [
  ['..y..', '..yy.', '.yyy.', '.yoy.', '.ywy.', '.yoy.', '..o..'],
  ['.y...', '..y..', '.yyy.', 'yyoy.', '.ywy.', '.yoy.', '..o..'],
  ['...y.', '..y..', '.yyy.', '.yoyy', '.ywy.', '.yoy.', '..o..'],
  ['.....', '..y..', '..y..', '.yyy.', '.ywy.', '.yoy.', '..o..'],
] as const;
const FLAME_KEYS = { y: C.gold, o: C.ember, w: C.bone } as const;

const CANDLE = [
  '..pbbbb.',
  '..pbbbbb',
  '..pbbbb.',
  '..pbbbb.',
  '..pbbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
  '...pbbb.',
];
const CANDLE_KEYS = { b: C.bone, p: C.parchment } as const;

export class TitleScene implements Scene {
  readonly opaque = true;
  private rng = new Rng(1345);
  private flame = 0;
  private glow = 22;
  private nextFlicker = 0;

  constructor(private game: Game) {}

  onAction(e: ActionEvent): void {
    if (e.action === 'start' || e.action === 'confirm') {
      this.game.sfx('start');
      this.game.scenes.replace(new VillageScene(this.game));
    } else if (e.action === 'select') {
      this.game.sfx('confirm');
      this.game.scenes.push(new SettingsScene(this.game));
    }
  }

  update(_dt: number, now: number): void {
    if (now >= this.nextFlicker) {
      this.nextFlicker = now + CANDLE_FLICKER_MS * (1 + this.rng.int(3));
      this.flame = this.rng.int(FLAMES.length);
      this.glow = 19 + this.rng.int(6);
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    clear(ctx, C.black);
    const cx = 80;
    const fy = 62; // flame top
    // Candle-light glow: concentric dithered rings, flickering in radius.
    for (const [r, c, amt] of [
      [this.glow + 10, C.night, 0.5],
      [this.glow, C.navy, 0.6],
      [this.glow - 8, C.teal, 0.35],
    ] as const) {
      for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        ditherFill(ctx, amt, c, cx - half, fy + 14 + y, half * 2, 1);
      }
    }
    // Holder and candle.
    rect(ctx, cx - 14, 102, 28, 3, C.wood);
    rect(ctx, cx - 10, 105, 20, 2, C.mud);
    rect(ctx, cx - 2, 99, 4, 3, C.wood);
    sprite(ctx, CANDLE, CANDLE_KEYS, cx - 5, 83);
    rect(ctx, cx, 80, 1, 3, C.black); // wick
    sprite(ctx, FLAMES[this.flame]!, FLAME_KEYS, cx - 2, fy + 11);

    drawTextCentered(ctx, "PEASANT'S LIFE", 16, C.gold);
    drawTextCentered(ctx, 'ANNO DOMINI 1345', 30, C.blood);
    if (Math.floor(now / TITLE_BLINK_MS) % 2 === 0) drawTextCentered(ctx, 'PRESS START', 118, C.bone);
    drawTextCentered(ctx, 'SELECT: SETTINGS', 134, C.slate);
  }
}

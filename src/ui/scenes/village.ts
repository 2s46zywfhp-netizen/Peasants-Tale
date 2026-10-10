import { clear, rect, sprite } from '../../render/draw';
import { drawText } from '../../render/font';
import { C } from '../../render/palette';
import { WALK_STEP_PX } from '../../sim/balance';
import { gameClock } from '../../sim/sim';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { TitleScene } from './title';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const PEASANT = ['..hhhh..', '.hhhhhh.', '.hssssh.', '..s..s..', '..ssss..', '.tttttt.', '.tttttt.', '..l..l..'];
const PEASANT_KEYS = { h: C.wood, s: C.parchment, t: C.mud, l: C.slate } as const;
const pad = (n: number) => String(n).padStart(2, '0');

/** Phase 1 placeholder: shows the real-time clock and a peasant walking with the D-pad. */
export class VillageScene implements Scene {
  readonly opaque = true;
  private x = 76;
  private y = 84;

  constructor(private game: Game) {}

  onAction(e: ActionEvent): void {
    const step = WALK_STEP_PX;
    if (e.action === 'up') this.y = Math.max(40, this.y - step);
    else if (e.action === 'down') this.y = Math.min(112, this.y + step);
    else if (e.action === 'left') this.x = Math.max(0, this.x - step);
    else if (e.action === 'right') this.x = Math.min(152, this.x + step);
    else if (e.action === 'cancel' || e.action === 'start') {
      this.game.sfx('cancel');
      this.game.scenes.replace(new TitleScene(this.game));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = this.game.now();
    const c = gameClock(this.game.save.data.sim, now);
    clear(ctx, C.night);
    rect(ctx, 0, 36, 160, 88, C.moss);
    for (let i = 0; i < 12; i++) rect(ctx, (i * 37) % 157, 40 + ((i * 23) % 80), 2, 1, C.mud);
    drawText(ctx, `${pad(c.day)} ${MONTHS[c.month - 1]} ${c.year}`, 4, 4, C.parchment);
    drawText(ctx, `${pad(c.hour)}:${pad(c.minute)}`, 116, 4, C.gold);
    drawText(ctx, `DAY ${c.dayOfLife}`, 4, 18, C.mist);
    drawText(ctx, `B${this.game.save.data.sim.blocks}`, 156 - 8 * String(`B${this.game.save.data.sim.blocks}`).length, 18, C.slate);
    sprite(ctx, PEASANT, PEASANT_KEYS, this.x, this.y);
    drawText(ctx, 'B: TITLE', 4, 132, C.slate);
  }
}

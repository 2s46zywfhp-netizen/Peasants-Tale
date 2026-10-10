import { drawVillage } from '../../render/village';
import { placeAt } from '../../render/places';
import { WALK_STEP_PX } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { ActionMenuScene } from './actionMenu';
import { StatusScene } from './status';

const MESSAGE_MS = 2500;

/** Phase 2 placeholder: walk the village, press A at a place to act there. START opens the status menu. */
export class VillageScene implements Scene {
  readonly opaque = true;
  private x = 20;
  private y = 50;
  private message = '';
  private messageUntil = 0;

  constructor(private game: Game) {}

  say(text: string): void {
    this.message = text;
    this.messageUntil = this.game.now() + MESSAGE_MS;
  }

  onAction(e: ActionEvent): void {
    const step = WALK_STEP_PX;
    switch (e.action) {
      case 'up': this.y = Math.max(22, this.y - step); return;
      case 'down': this.y = Math.min(114, this.y + step); return;
      case 'left': this.x = Math.max(4, this.x - step); return;
      case 'right': this.x = Math.min(156, this.x + step); return;
      case 'confirm': {
        const place = placeAt(this.x, this.y);
        if (!place || this.game.sim().dead) return this.game.sfx('error');
        this.game.sfx('confirm');
        this.game.scenes.push(new ActionMenuScene(this.game, place.id, place.label, (m) => this.say(m)), false);
        return;
      }
      case 'start':
        this.game.sfx('confirm');
        this.game.scenes.push(new StatusScene(this.game));
        return;
      default:
        return;
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    if (now > this.messageUntil) this.message = '';
    drawVillage(ctx, this.game.sim(), now, { px: this.x, py: this.y, here: placeAt(this.x, this.y)?.label ?? null, message: this.message });
  }
}

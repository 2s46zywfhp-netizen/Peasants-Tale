import { blit, spriteId } from '../../render/atlas';
import { INK, parchment, rect } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, drawTextRight } from '../../render/font';
import { C } from '../../render/palette';
import { ACTIONS, QUEUE_MAX } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';
import { ACTION_ICON, PARAM_ICON } from '../work';

const COUNTS = Array.from({ length: QUEUE_MAX + 1 }, (_, i) => `${i}/${QUEUE_MAX}`);

/** R in the world: the tasks waiting their turn. A takes one out; B closes. */
export class QueueScene implements Scene {
  readonly opaque = false;
  private cursor = 0;
  private labels: string[] = [];
  private icons: number[] = [];

  constructor(private game: Game) {}

  enter(): void {
    this.build();
  }

  private build(): void {
    const q = this.game.save.data.queue;
    this.labels = q.map((t, i) => `${i + 1}. ${ACTIONS[t.action].label}${t.param && PARAM_ICON[t.param] ? ` ${t.param.replace(/^(sell|buy)/, '$1 ').toUpperCase()}` : ''}`.slice(0, 24));
    this.icons = q.map((t) => spriteId(`icon.${(t.param && PARAM_ICON[t.param]) || ACTION_ICON[t.action]}`));
    if (this.cursor >= q.length) this.cursor = Math.max(0, q.length - 1);
    probe('queue', this.labels.join('|'));
  }

  onAction(e: ActionEvent): void {
    const g = this.game;
    const q = g.save.data.queue;
    if (e.action === 'cancel' || (e.action === 'queue' && !e.repeat)) {
      g.sfx('cancel');
      g.scenes.pop(false);
    } else if ((e.action === 'up' || e.action === 'down') && q.length) {
      this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + q.length) % q.length;
      g.sfx('move');
    } else if (e.action === 'confirm' && !e.repeat && q.length) {
      g.setQueue(q.filter((_, i) => i !== this.cursor));
      g.sfx('cancel');
      this.build();
    }
  }

  draw(): void {
    const n = this.labels.length;
    const h = 46 + Math.max(1, n) * 18;
    const x = 24, y = 200 - h;
    parchment(x, y, W - 48, h);
    drawText('TASKS WAITING', x + 12, y + 9, INK.title);
    drawTextRight(COUNTS[n]!, W - 36, y + 9, INK.dim);
    rect(x + 10, y + 19, W - 68, 1, INK.dim);
    if (!n) drawText('NONE. R IN A MENU ADDS.', x + 12, y + 28, INK.dim);
    for (let i = 0; i < n; i++) {
      const yy = y + 24 + i * 18;
      if (i === this.cursor) rect(x + 8, yy - 1, W - 64, 18, C.parchment);
      blit(this.icons[i]!, x + 12, yy);
      drawText(this.labels[i]!, x + 32, yy + 5, i === this.cursor ? INK.pick : INK.text);
    }
    drawText(n ? 'A: TAKE OUT   B: CLOSE' : 'B: CLOSE', x + 12, y + h - 16, INK.dim);
  }
}

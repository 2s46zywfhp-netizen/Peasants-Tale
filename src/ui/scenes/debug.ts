import { clear, rect } from '../../render/draw';
import { drawText, drawTextCentered, wrap } from '../../render/font';
import { C, useUiRemap } from '../../render/palette';
import { BLOCKS_PER_DAY } from '../../sim/balance';
import { EVENT_IDS } from '../../sim/events';
import { createLife, debugFastForward, debugTrigger, stateHash } from '../../sim/sim';
import { GalleryScene } from './gallery';
import { ParchmentLogScene } from './parchmentLog';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import { withActivation } from '../gesture';
import type { Scene } from '../scene';

type Item = { label: string; run: () => void };

/** Developer panel: SELECT + START held for 2 seconds. */
export class DebugScene implements Scene {
  readonly opaque = true;
  private cursor = 0;
  private scroll = 0;
  private events = false;
  private note = '';

  constructor(private game: Game) {}

  private ff(days: number, label: string): Item {
    return {
      label,
      run: () => {
        const g = this.game;
        const from = g.sim().block;
        g.setSim(debugFastForward(g.sim(), days * BLOCKS_PER_DAY, g.now()));
        this.note = `+${days} DAYS`;
        g.scenes.push(new ParchmentLogScene(g, from, g.sim().block, label.replace('FF', 'AFTER')), false);
      },
    };
  }

  private items(): Item[] {
    const g = this.game;
    if (this.events) {
      return [
        ...EVENT_IDS.map((id) => ({ label: id.toUpperCase(), run: () => { g.setSim(debugTrigger(g.sim(), id)); this.note = `FIRED ${id.toUpperCase()}`; } })),
        { label: '< BACK', run: () => { this.events = false; this.cursor = 0; } },
      ];
    }
    return [
      this.ff(1, 'FF 1 DAY'),
      this.ff(7, 'FF 1 WEEK'),
      this.ff(91, 'FF 1 SEASON'),
      this.ff(365, 'FF 1 YEAR'),
      {
        label: 'DUMP STATE',
        run: () => {
          const json = JSON.stringify(g.sim(), null, 1);
          console.log(json);
          withActivation(() => void navigator.clipboard?.writeText(json).catch(() => {}));
          this.note = `HASH ${stateHash(g.sim())}`;
        },
      },
      {
        label: 'SET SEED',
        run: () => withActivation(() => {
          const v = window.prompt('Seed for a new life (integer):', String(g.sim().seed));
          if (v === null || !/^\d+$/.test(v.trim())) return;
          g.setSim(createLife(Number(v.trim()) >>> 0, g.now()));
          this.note = `NEW LIFE SEED ${v.trim()}`;
        }),
      },
      { label: 'TRIGGER EVENT >', run: () => { this.events = true; this.cursor = 0; this.scroll = 0; } },
      { label: 'SPRITE GALLERY', run: () => g.scenes.push(new GalleryScene(g), false) },
      { label: 'CLOSE', run: () => g.scenes.pop(false) },
    ];
  }

  onAction(e: ActionEvent): void {
    const items = this.items();
    if (e.action === 'up' || e.action === 'down') {
      this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + items.length) % items.length;
      this.scroll = Math.min(Math.max(this.scroll, this.cursor - 9), this.cursor);
    } else if (e.action === 'confirm' && !e.repeat) {
      items[this.cursor]?.run();
      this.game.sfx('confirm');
    } else if (e.action === 'cancel') {
      if (this.events) this.events = false;
      else this.game.scenes.pop(false);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.game.sim();
    useUiRemap();
    clear(ctx, C.black);
    drawTextCentered(ctx, 'DEBUG', 2, C.blood);
    drawText(ctx, `SEED ${s.seed}`.slice(0, 20), 0, 12, C.mist);
    drawText(ctx, `BLOCK ${s.block}`, 0, 21, C.mist);
    rect(ctx, 0, 30, 160, 1, C.slate);
    this.items().slice(this.scroll, this.scroll + 10).forEach((it, i) => {
      const idx = this.scroll + i;
      if (idx === this.cursor) drawText(ctx, '>', 0, 34 + i * 9, C.ember);
      drawText(ctx, it.label.slice(0, 18), 10, 34 + i * 9, idx === this.cursor ? C.bone : C.mist);
    });
    wrap(this.note, 20).slice(0, 2).forEach((l, i) => drawText(ctx, l, 0, 126 + i * 9, C.sea));
  }
}

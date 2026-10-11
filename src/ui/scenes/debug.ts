import { clear, rect } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, drawTextCentered, wrap } from '../../render/font';
import { C } from '../../render/palette';
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
const ROWS = 14;

/** Developer panel: SELECT + START held for 2 seconds. */
export class DebugScene implements Scene {
  readonly opaque = true;
  private cursor = 0;
  private scroll = 0;
  private events = false;
  private note = '';
  private noteLines: string[] = [];
  /** Built when the panel opens or its mode changes, not every frame. */
  private list: Item[] = [];
  private header = ['', ''];

  constructor(private game: Game) {}

  enter(): void {
    this.rebuild();
  }

  private rebuild(): void {
    const s = this.game.sim();
    this.list = this.items();
    this.header = [`SEED ${s.seed}`.slice(0, 30), `BLOCK ${s.block}`];
    this.noteLines = wrap(this.note, 30).slice(0, 2);
  }

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
      {
        label: 'UNLOCK DMG MODE',
        run: () => {
          g.save.data = { ...g.save.data, dmgUnlocked: true };
          void g.save.save(g.now());
          this.note = 'DMG MODE UNLOCKED';
        },
      },
      { label: 'SPRITE GALLERY', run: () => g.scenes.push(new GalleryScene(g), false) },
      { label: 'CLOSE', run: () => g.scenes.pop(false) },
    ];
  }

  onAction(e: ActionEvent): void {
    const items = this.list;
    if (e.action === 'up' || e.action === 'down') {
      this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + items.length) % items.length;
      this.scroll = Math.min(Math.max(this.scroll, this.cursor - ROWS + 1), this.cursor);
    } else if (e.action === 'confirm' && !e.repeat) {
      items[this.cursor]?.run();
      this.game.sfx('confirm');
      this.rebuild();
    } else if (e.action === 'cancel') {
      if (this.events) {
        this.events = false;
        this.rebuild();
      } else this.game.scenes.pop(false);
    }
  }

  draw(): void {
    clear(C.black);
    drawTextCentered('DEBUG', 4, C.blood);
    drawText(this.header[0]!, 4, 16, C.mist);
    drawText(this.header[1]!, 4, 26, C.mist);
    rect(0, 36, W, 1, C.slate);
    const n = Math.min(ROWS, this.list.length - this.scroll);
    for (let i = 0; i < n; i++) {
      const idx = this.scroll + i;
      if (idx === this.cursor) drawText('>', 4, 42 + i * 11, C.flame);
      drawText(this.list[idx]!.label, 16, 42 + i * 11, idx === this.cursor ? C.bone : C.mist);
    }
    for (let i = 0; i < this.noteLines.length; i++) drawText(this.noteLines[i]!, 4, 200 + i * 10, C.aqua);
  }
}

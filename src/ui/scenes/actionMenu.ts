import { frame } from '../../render/draw';
import { drawText } from '../../render/font';
import { C } from '../../render/palette';
import { ACTIONS, SERVING_COST, type ActionId, type Location } from '../../sim/balance';
import { ACTION_IDS, FOODS, TRADE_KINDS, availability } from '../../sim/actions';
import { clock } from '../../sim/sim';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';

interface Item {
  label: string;
  action: ActionId;
  param: string | null;
  why: string | null;
}

const TRADE_LABEL = { sellGrain: 'SELL GRAIN', buyGrain: 'BUY GRAIN', sellEggs: 'SELL EGGS', buyFirewood: 'BUY WOOD', sellAle: 'SELL ALE' } as const;
const ROWS = 7;

/** The actions possible at a place right now (unavailable ones are shown with the reason). */
export class ActionMenuScene implements Scene {
  readonly opaque = false;
  private cursor = 0;
  private scroll = 0;

  constructor(
    private game: Game,
    private place: Location,
    private title: string,
    private report: (msg: string) => void,
  ) {}

  private items(): Item[] {
    const s = this.game.sim();
    const k = clock(s, this.game.now());
    const out: Item[] = [];
    for (const id of ACTION_IDS) {
      const def = ACTIONS[id];
      if (def.location !== this.place && !(id === 'eat' && this.place === 'home')) continue;
      if (id === 'eat') {
        for (const f of FOODS) {
          const n = Math.floor((s.wealth[f] + 1e-9) / SERVING_COST[f]);
          if (n > 0) out.push({ label: `EAT ${f.toUpperCase()} ${n}`, action: id, param: f, why: availability(s, id, k.info, k.bod, f) });
        }
      } else if (id === 'trade') {
        for (const t of TRADE_KINDS) out.push({ label: TRADE_LABEL[t], action: id, param: t, why: availability(s, id, k.info, k.bod, t) });
      } else {
        out.push({ label: def.label, action: id, param: null, why: availability(s, id, k.info, k.bod) });
      }
    }
    return out;
  }

  onAction(e: ActionEvent): void {
    const items = this.items();
    if (e.action === 'cancel') {
      this.game.sfx('cancel');
      this.game.scenes.pop(false);
    } else if (e.action === 'up' || e.action === 'down') {
      this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + items.length) % Math.max(1, items.length);
      this.scroll = Math.min(Math.max(this.scroll, this.cursor - ROWS + 1), this.cursor);
      this.game.sfx('move');
    } else if (e.action === 'confirm') {
      const it = items[this.cursor];
      if (!it) return;
      if (it.why) {
        this.game.sfx('error');
        return this.report(it.why);
      }
      const r = this.game.act(it.action, it.param);
      this.game.sfx(r.ok ? 'confirm' : 'error');
      this.report(r.ok ? `${it.label.replace(/ \d+$/, '')}` : r.message);
      this.game.scenes.pop(false);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const items = this.items();
    const rows = Math.min(ROWS, Math.max(1, items.length));
    const h = 14 + rows * 10;
    const y = 118 - h;
    frame(ctx, 4, y, 152, h, C.parchment, C.night);
    drawText(ctx, this.title, 10, y + 3, C.gold);
    if (!items.length) drawText(ctx, 'NOTHING HERE', 14, y + 14, C.slate);
    items.slice(this.scroll, this.scroll + rows).forEach((it, i) => {
      const idx = this.scroll + i;
      const yy = y + 14 + i * 10;
      if (idx === this.cursor) drawText(ctx, '>', 6, yy, C.ember);
      drawText(ctx, it.label.slice(0, 17), 14, yy, it.why ? C.slate : idx === this.cursor ? C.bone : C.mist);
    });
  }
}

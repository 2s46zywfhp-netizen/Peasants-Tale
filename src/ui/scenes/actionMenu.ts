import { frame } from '../../render/draw';
import { drawText } from '../../render/font';
import { C } from '../../render/palette';
import { ACTIONS, SERVING_COST, type ActionId, type Location } from '../../sim/balance';
import { ACTION_IDS, FOODS, TRADE_KINDS, availability } from '../../sim/actions';
import { clock } from '../../sim/sim';
import { placeFor, stationShort } from '../../sim/station';
import { opinionWord, present } from '../../sim/village';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';

interface Item {
  label: string;
  action: ActionId;
  param: string | null;
  why: string | null;
}

const TRADE_LABEL = { sellGrain: 'SELL GRAIN', buyGrain: 'BUY GRAIN', sellEggs: 'SELL EGGS', buyFirewood: 'BUY WOOD', sellAle: 'SELL ALE' } as const;
const ROWS = 7;
/** Actions done to or with a villager: choosing one opens a list of people. */
const WITH_SOMEONE: ReadonlySet<ActionId> = new Set(['court', 'marry', 'helpNeighbour', 'askFavour', 'accuse']);
/** Places where the household eats. */
const MEAL_PLACES: ReadonlySet<Location> = new Set(['home', 'town', 'camp']);

function drawList(ctx: CanvasRenderingContext2D, title: string, items: readonly Item[], cursor: number, scroll: number): void {
  const rows = Math.min(ROWS, Math.max(1, items.length));
  const h = 14 + rows * 10;
  const y = 118 - h;
  frame(ctx, 4, y, 152, h, C.parchment, C.night);
  drawText(ctx, title, 10, y + 3, C.gold);
  if (!items.length) drawText(ctx, 'NOTHING HERE', 14, y + 14, C.slate);
  items.slice(scroll, scroll + rows).forEach((it, i) => {
    const idx = scroll + i;
    const yy = y + 14 + i * 10;
    if (idx === cursor) drawText(ctx, '>', 6, yy, C.ember);
    drawText(ctx, it.label.slice(0, 17), 14, yy, it.why ? C.slate : idx === cursor ? C.bone : C.mist);
  });
}

/** Choosing whom: everyone still in the village, with why not if they cannot be chosen. */
class PickScene implements Scene {
  readonly opaque = false;
  private cursor = 0;
  private scroll = 0;
  private items: Item[];
  private why: string | null = null;

  constructor(
    private game: Game,
    private action: ActionId,
    private report: (msg: string) => void,
    private done: () => void,
  ) {
    this.items = this.build();
    probe('menu', this.items.map((i) => `${i.param}${i.why ? `(${i.why})` : ''}`).join('|'));
  }

  private build(): Item[] {
    const s = this.game.sim();
    const k = clock(s, this.game.now());
    return s.village.filter(present).map((v) => ({
      label: `${v.name.split(' ')[0]} ${opinionWord(v.opinion).slice(0, 4)}${v.owes > 0 ? ` +${v.owes}` : v.owes < 0 ? ` ${v.owes}` : ''}`,
      action: this.action,
      param: v.id,
      why: availability(s, this.action, k.info, k.bod, v.id),
    }));
  }

  onAction(e: ActionEvent): void {
    const n = this.items.length;
    if (e.action === 'cancel') {
      this.game.sfx('cancel');
      this.game.scenes.pop(false);
    } else if ((e.action === 'up' || e.action === 'down') && n) {
      this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + n) % n;
      this.scroll = Math.min(Math.max(this.scroll, this.cursor - ROWS + 1), this.cursor);
      this.why = this.items[this.cursor]!.why;
      this.game.sfx('move');
    } else if (e.action === 'confirm') {
      const it = this.items[this.cursor];
      if (!it) return;
      if (it.why) {
        this.game.sfx('error');
        this.why = it.why;
        return this.report(it.why);
      }
      const r = this.game.act(it.action, it.param);
      this.game.sfx(r.ok ? 'confirm' : 'error');
      this.report(r.ok ? ACTIONS[it.action].label : r.message);
      this.game.scenes.pop(false);
      this.done();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawList(ctx, `${ACTIONS[this.action].label}: WHO?`, this.items, this.cursor, this.scroll);
    if (this.why) {
      frame(ctx, 4, 120, 152, 13, C.parchment, C.night);
      drawText(ctx, this.why.slice(0, 18), 10, 123, C.blood);
    }
  }
}

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

  enter(): void {
    probe('menu', this.items().map((i) => `${i.label}${i.why ? `(${i.why})` : ''}`).join('|'));
  }

  private items(): Item[] {
    const s = this.game.sim();
    const k = clock(s, this.game.now());
    const out: Item[] = [];
    for (const id of ACTION_IDS) {
      const def = ACTIONS[id];
      if (id === 'eat' ? !MEAL_PLACES.has(this.place) : placeFor(s, id, def.location) !== this.place) continue;
      // What the town or the greenwood rules out altogether is not offered there at all.
      const barred = stationShort(s, id);
      if (barred === 'IN THE TOWN' || barred === 'OUTLAWED') continue;
      if (id === 'eat') {
        for (const f of FOODS) {
          const n = Math.floor((s.wealth[f] + 1e-9) / SERVING_COST[f]);
          if (n > 0) out.push({ label: `EAT ${f.toUpperCase()} ${n}`, action: id, param: f, why: availability(s, id, k.info, k.bod, f) });
        }
      } else if (id === 'trade') {
        for (const t of TRADE_KINDS) out.push({ label: TRADE_LABEL[t], action: id, param: t, why: availability(s, id, k.info, k.bod, t) });
      } else if (WITH_SOMEONE.has(id)) {
        // Time, place and station first; whether the person will is asked in the list of people.
        const why = availability(s, id, k.info, k.bod, s.village.find(present)?.id ?? null);
        out.push({ label: `${def.label}...`, action: id, param: null, why: why === 'NOT NOW' || why === 'OUTLAWED' || why === 'IN THE TOWN' || why === 'ALREADY WED' || why === 'TOO YOUNG' ? why : null });
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
      if (WITH_SOMEONE.has(it.action)) {
        this.game.sfx('confirm');
        this.game.scenes.push(new PickScene(this.game, it.action, this.report, this.closeSelf), false);
        return;
      }
      const r = this.game.act(it.action, it.param);
      this.game.sfx(r.ok ? 'confirm' : 'error');
      this.report(r.ok ? `${it.label.replace(/ \d+$/, '')}` : r.message);
      this.game.scenes.pop(false);
    }
  }

  private readonly closeSelf = (): void => {
    if (this.game.scenes.top === this) this.game.scenes.pop(false);
  };

  draw(ctx: CanvasRenderingContext2D): void {
    drawList(ctx, this.title, this.items(), this.cursor, this.scroll);
  }
}

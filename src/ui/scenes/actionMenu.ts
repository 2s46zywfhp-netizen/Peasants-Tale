import { blit, spriteId } from '../../render/atlas';
import { INK, parchment, rect } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, drawTextRight } from '../../render/font';
import { C } from '../../render/palette';
import { ACTIONS, SERVING_COST, type ActionId, type Location } from '../../sim/balance';
import { ACTION_IDS, FOODS, TRADE_KINDS, availability } from '../../sim/actions';
import { clock } from '../../sim/sim';
import { placeFor, stationShort } from '../../sim/station';
import { opinionWord, present } from '../../sim/village';
import { QUEUE_MAX } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';
import { ACTION_ICON, PARAM_ICON, TOOL_ACTIONS, TRADE_LABEL } from '../work';
import { WorkingScene } from './working';

interface Item {
  label: string;
  action: ActionId;
  param: string | null;
  why: string | null;
  icon: number;
}

/** Market lines that make no sense for this household right now are left off the list. */
const HIDE_TRADE = new Set(['NO ROOM', 'NONE TO SELL', 'TOOLS ARE SOUND']);
const ROWS = 7;
const ROW_H = 18;
const BOX_W = 232;
/** Actions done to or with a villager: choosing one opens a list of people. */
const WITH_SOMEONE: ReadonlySet<ActionId> = new Set(['court', 'marry', 'helpNeighbour', 'askFavour', 'accuse']);
/** Places where the household eats. */
const MEAL_PLACES: ReadonlySet<Location> = new Set(['home', 'town', 'camp']);

const iconIds = new Map<string, number>();
function iconOf(name: string): number {
  let id = iconIds.get(name);
  if (id === undefined) iconIds.set(name, (id = spriteId(`icon.${name}`)));
  return id;
}

/** A list in a parchment window above the HUD: icon, label, and why not in red when it cannot be done. */
function drawList(title: string, items: readonly Item[], cursor: number, scroll: number, why: string | null, footer: string): void {
  const rows = Math.min(ROWS, Math.max(1, items.length));
  const h = 32 + rows * ROW_H + (why ? 12 : 0);
  const x = (W - BOX_W) >> 1;
  const y = 202 - h;
  parchment(x, y, BOX_W, h);
  drawText(title, x + 12, y + 9, INK.title);
  drawTextRight(footer, x + BOX_W - 10, y + 9, INK.dim);
  rect(x + 10, y + 19, BOX_W - 20, 1, INK.dim);
  if (!items.length) drawText('NOTHING HERE NOW', x + 30, y + 26, INK.dim);
  const n = Math.min(rows, items.length - scroll);
  for (let i = 0; i < n; i++) {
    const idx = scroll + i;
    const it = items[idx]!;
    const yy = y + 23 + i * ROW_H;
    const sel = idx === cursor;
    if (sel) rect(x + 8, yy - 1, BOX_W - 16, ROW_H, C.parchment);
    blit(it.icon, x + 12, yy);
    drawText(it.label, x + 32, yy + 5, it.why ? INK.dim : sel ? INK.pick : INK.text);
    if (sel) drawText('>', x + BOX_W - 20, yy + 5, INK.pick);
  }
  if (scroll > 0) drawText('^', x + BOX_W - 20, y + 23, INK.title);
  if (scroll + rows < items.length) drawText('v', x + BOX_W - 20, y + 23 + (rows - 1) * ROW_H + 6, INK.title);
  if (why) drawText(why, x + 12, y + h - 16, INK.warn);
}

/** Choosing whom: everyone still in the village, with why not if they cannot be chosen. */
class PickScene implements Scene {
  readonly opaque = false;
  private cursor = 0;
  private scroll = 0;
  private items: Item[];
  private why: string | null = null;
  private title: string;

  constructor(
    private game: Game,
    private action: ActionId,
    private report: (msg: string) => void,
    private done: () => void,
  ) {
    this.items = this.build();
    this.title = `${ACTIONS[action].label}: WHO?`.slice(0, 20);
    probe('menu', this.items.map((i) => `${i.param}${i.why ? `(${i.why})` : ''}`).join('|'));
  }

  private build(): Item[] {
    const s = this.game.sim();
    const k = clock(s, this.game.now());
    const icon = iconOf(ACTION_ICON[this.action]);
    return s.village.filter(present).map((v) => ({
      label: `${v.name.split(' ')[0]} ${opinionWord(v.opinion).slice(0, 6)}${v.owes > 0 ? ` +${v.owes}` : v.owes < 0 ? ` ${v.owes}` : ''}`.slice(0, 22),
      action: this.action,
      param: v.id,
      why: availability(s, this.action, k.info, k.bod, v.id),
      icon,
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
      if (r.ok) this.game.scenes.push(new WorkingScene(this.game, it.action), false);
    }
  }

  draw(): void {
    drawList(this.title, this.items, this.cursor, this.scroll, this.why, 'B: BACK');
  }
}

/**
 * The actions possible at a place right now (unavailable ones shown with the reason). A does one now;
 * R puts it in the queue, to be done when what is in hand is finished.
 */
export class ActionMenuScene implements Scene {
  readonly opaque = false;
  private cursor = 0;
  private scroll = 0;
  private items: Item[] = [];
  private builtFor = -1;
  private why: string | null = null;
  private title: string;

  constructor(
    private game: Game,
    private place: Location,
    title: string,
    private report: (msg: string) => void,
    /** Only these actions (a spot in a room: the bed, the hearth, the table). */
    private only: readonly ActionId[] | null = null,
  ) {
    this.title = title.slice(0, 18);
  }

  enter(): void {
    this.rebuild();
    // The tool on the belt picks the work it is for.
    const want = TOOL_ACTIONS[this.game.save.data.belt];
    let i = this.items.findIndex((it) => want.includes(it.action) && !it.why);
    if (i < 0) i = this.items.findIndex((it) => want.includes(it.action));
    if (i >= 0) this.moveTo(i);
    probe('menu', this.items.map((i) => `${i.label}${i.why ? `(${i.why})` : ''}`).join('|'));
  }

  /** The list is built when the menu opens, after input and when the block changes: never while drawing. */
  private rebuild(): void {
    const s = this.game.sim();
    this.builtFor = s.block;
    const k = clock(s, this.game.now());
    const out: Item[] = [];
    // A spot's own list keeps its own order (the hearth: feed the fire first).
    for (const id of this.only ?? ACTION_IDS) {
      const def = ACTIONS[id];
      if (id === 'eat' ? !MEAL_PLACES.has(this.place) : placeFor(s, id, def.location) !== this.place) continue;
      if (this.only && !this.only.includes(id)) continue;
      // What the town or the greenwood rules out altogether is not offered there at all.
      const barred = stationShort(s, id);
      if (barred === 'IN THE TOWN' || barred === 'OUTLAWED') continue;
      if (id === 'eat') {
        for (const f of FOODS) {
          const n = Math.floor((s.wealth[f] + 1e-9) / SERVING_COST[f]);
          if (n > 0) out.push({ label: `EAT ${f.toUpperCase()} ${n}`, action: id, param: f, why: availability(s, id, k.info, k.bod, f), icon: iconOf(PARAM_ICON[f]!) });
        }
      } else if (id === 'trade') {
        for (const t of TRADE_KINDS) {
          const why = availability(s, id, k.info, k.bod, t);
          if (why && HIDE_TRADE.has(why)) continue;
          out.push({ label: TRADE_LABEL[t], action: id, param: t, why, icon: iconOf(PARAM_ICON[t]!) });
        }
      } else if (WITH_SOMEONE.has(id)) {
        // Time, place and station first; whether the person will is asked in the list of people.
        const why = availability(s, id, k.info, k.bod, s.village.find(present)?.id ?? null);
        out.push({
          label: `${def.label}...`, action: id, param: null, icon: iconOf(ACTION_ICON[id]),
          why: why === 'NOT NOW' || why === 'OUTLAWED' || why === 'IN THE TOWN' || why === 'ALREADY WED' || why === 'TOO YOUNG' ? why : null,
        });
      } else {
        out.push({ label: def.label, action: id, param: null, why: availability(s, id, k.info, k.bod), icon: iconOf(ACTION_ICON[id]) });
      }
    }
    this.items = out;
    if (this.cursor >= out.length) this.cursor = Math.max(0, out.length - 1);
    this.why = out[this.cursor]?.why ?? null;
  }

  private moveTo(i: number): void {
    this.cursor = i;
    this.scroll = Math.min(Math.max(this.scroll, this.cursor - ROWS + 1), this.cursor);
    this.why = this.items[i]?.why ?? null;
  }

  update(): void {
    if (this.game.sim().block !== this.builtFor) this.rebuild();
  }

  onAction(e: ActionEvent): void {
    const items = this.items;
    if (e.action === 'cancel') {
      this.game.sfx('cancel');
      this.game.scenes.pop(false);
    } else if (e.action === 'up' || e.action === 'down') {
      if (!items.length) return;
      this.moveTo((this.cursor + (e.action === 'up' ? -1 : 1) + items.length) % items.length);
      this.game.sfx('move');
    } else if (e.action === 'queue' && !e.repeat) {
      // Do this when what is in hand is done (even if it cannot be done this very moment).
      const it = items[this.cursor];
      if (!it || ACTIONS[it.action].duration === 0 || WITH_SOMEONE.has(it.action)) return this.game.sfx('error');
      const q = this.game.save.data.queue;
      if (q.length >= QUEUE_MAX) {
        this.game.sfx('error');
        return this.report('QUEUE IS FULL');
      }
      this.game.setQueue([...q, { action: it.action, param: it.param }]);
      this.game.sfx('confirm');
      this.report(`QUEUED ${it.label}`.slice(0, 26));
      this.game.scenes.pop(false);
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
      // A task (not a meal) plays out for a moment, then its time passes.
      if (r.ok && ACTIONS[it.action].duration > 0) this.game.scenes.push(new WorkingScene(this.game, it.action), false);
    }
    if (this.game.scenes.top === this) this.rebuild();
  }

  private readonly closeSelf = (): void => {
    if (this.game.scenes.top === this) this.game.scenes.pop(false);
  };

  draw(): void {
    drawList(this.title, this.items, this.cursor, this.scroll, this.why, 'R: QUEUE');
  }
}

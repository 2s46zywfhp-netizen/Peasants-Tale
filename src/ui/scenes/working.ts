import { INK, parchment, rect } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, wrap } from '../../render/font';
import { C } from '../../render/palette';
import { WORK_SHOW_MS, type ActionId } from '../../sim/balance';
import type { LogType } from '../../sim/state';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';

/** What the peasant is doing, in words. */
const DOING: Partial<Record<ActionId, string>> = {
  workStrips: 'WORKING THE STRIPS', weekWork: "THE LORD'S WORK", sleep: 'SLEEPING', rest: 'RESTING', cook: 'COOKING',
  brew: 'BREWING', prayHome: 'PRAYING', pray: 'PRAYING', attendMass: 'AT MASS', confess: 'CONFESSING', gatherFirewood: 'GATHERING WOOD',
  wash: 'WASHING', socialise: 'ON THE GREEN', tavern: 'AT THE ALEHOUSE', trade: 'AT MARKET', hire: 'WORKING FOR HIRE',
  poach: 'POACHING', offering: 'AT THE BARROW', helpNeighbour: 'HELPING A NEIGHBOUR',
};

const NOW_IS = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'] as const;

/** Log entries worth telling when the work is done. */
const TOLD: ReadonlySet<LogType> = new Set(['farm', 'manor', 'church', 'family', 'village', 'court', 'trade', 'event', 'body', 'illness', 'dark', 'rank']);

const TOP = 6;

/**
 * The chosen task plays out for a moment (the peasant at work in the world beneath) while a bar fills, then
 * the rest of its time passes at once, as far as the haste allowance lets it, and what came of it is shown.
 * B leaves the task running in real time instead.
 */
export class WorkingScene implements Scene {
  readonly opaque = false;
  private start = 0;
  private result: string[] | null = null;
  private shownAt = 0;
  private label: string;

  constructor(
    private game: Game,
    action: ActionId,
  ) {
    this.label = DOING[action] ?? 'BUSY';
  }

  enter(): void {
    this.start = this.game.frameNow();
    probe('working', 'busy');
  }

  exit(): void {
    probe('working', '');
  }

  private finish(): void {
    const g = this.game;
    const before = g.sim().log.length;
    const plan = g.sim().plan;
    g.hasten();
    const s = g.sim();
    const fresh = s.log.slice(before).filter((e) => TOLD.has(e.type));
    const unfinished = plan && s.block < plan.until;
    const text = fresh.length ? fresh.slice(-2).map((e) => e.text) : [unfinished ? 'The day will not be hurried. The work goes on.' : `Done. It is ${NOW_IS[s.block % 6]} now.`];
    this.result = text.flatMap((t) => wrap(t.toUpperCase(), 28)).slice(0, 6);
    this.shownAt = g.frameNow();
    probe('working', 'done');
    g.sfx('confirm');
  }

  onAction(e: ActionEvent): void {
    if (e.repeat) return;
    if (this.result) {
      if (e.action === 'confirm' || e.action === 'cancel') this.game.scenes.pop(false);
    } else if (e.action === 'cancel') {
      this.game.scenes.pop(false); // carry on in real time
    }
  }

  update(_dt: number, now: number): void {
    if (!this.result && now - this.start >= WORK_SHOW_MS) this.finish();
    if (this.result && now - this.shownAt > 6000) this.game.scenes.pop(false);
  }

  draw(now: number): void {
    if (this.result) {
      const h = 18 + this.result.length * 11;
      parchment(8, TOP, W - 16, h);
      for (let i = 0; i < this.result.length; i++) drawText(this.result[i]!, 18, TOP + 10 + i * 11, INK.text);
      return;
    }
    parchment(8, TOP, W - 16, 46);
    drawText(this.label, 18, TOP + 9, INK.title);
    const p = Math.min(1, (now - this.start) / WORK_SHOW_MS);
    rect(18, TOP + 21, W - 36, 7, C.soil);
    rect(19, TOP + 22, Math.round((W - 38) * p), 5, C.ember);
    rect(19, TOP + 22, Math.round((W - 38) * p), 1, C.gold);
    drawText('B: LET IT RUN IN REAL TIME', 18, TOP + 32, INK.dim);
  }
}

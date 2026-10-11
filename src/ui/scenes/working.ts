import { frame, rect } from '../../render/draw';
import { drawText, wrap } from '../../render/font';
import { C, useUiRemap } from '../../render/palette';
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
};

const NOW_IS = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'] as const;

/** Log entries worth telling when the work is done. */
const TOLD: ReadonlySet<LogType> = new Set(['farm', 'manor', 'church', 'family', 'village', 'court', 'trade', 'event', 'body', 'illness', 'dark', 'rank']);

/**
 * The chosen task plays out for a moment while a bar fills, then the rest of its time passes at once
 * (the sim is hastened) and what came of it is shown. B leaves the task running in real time instead.
 */
export class WorkingScene implements Scene {
  readonly opaque = false;
  private start = 0;
  private result: string[] | null = null;
  private shownAt = 0;

  constructor(
    private game: Game,
    private action: ActionId,
  ) {}

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
    g.hasten();
    const fresh = g.sim().log.slice(before).filter((e) => TOLD.has(e.type));
    const text = fresh.length ? fresh.slice(-2).map((e) => e.text) : [`Done. It is ${NOW_IS[g.sim().block % 6]} now.`];
    this.result = text.flatMap((t) => wrap(t.toUpperCase(), 18)).slice(0, 5);
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

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    useUiRemap();
    if (this.result) {
      const h = 8 + this.result.length * 9;
      frame(ctx, 4, 132 - h - 6, 152, h + 6, C.parchment, C.night);
      for (let i = 0; i < this.result.length; i++) drawText(ctx, this.result[i]!, 9, 132 - h - 1 + i * 9, C.bone);
      return;
    }
    const label = DOING[this.action] ?? 'BUSY';
    frame(ctx, 4, 106, 152, 26, C.parchment, C.night);
    drawText(ctx, label, 9, 109, C.gold);
    const p = Math.min(1, (now - this.start) / WORK_SHOW_MS);
    rect(ctx, 9, 120, 142, 7, C.black);
    rect(ctx, 10, 121, Math.round(140 * p), 5, C.ember);
  }
}

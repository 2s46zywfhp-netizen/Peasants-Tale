import { wrap } from '../../render/font';
import { PARCHMENT_COLS, PARCHMENT_LINES, drawParchment } from '../../render/parchment';
import { useUiRemap } from '../../render/palette';
import { summarize } from '../../sim/summary';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import { probe } from '../probe';
import type { Scene } from '../scene';

/** "While you were away": the event log since the last session, summarised on parchment. */
export class ParchmentLogScene implements Scene {
  readonly opaque = true;
  private lines: string[] = [];
  private scroll = 0;

  constructor(
    private game: Game,
    private fromBlock: number,
    private toBlock: number,
    private title = 'WHILE YOU WERE AWAY',
  ) {}

  enter(): void {
    const s = this.game.sim();
    const sum = summarize(s.log, this.fromBlock, this.toBlock, s.members[0]?.name ?? `The ${s.familyName}s`);
    this.lines = sum.lines.flatMap((l) => [...wrap(l.toUpperCase(), PARCHMENT_COLS), '']);
    probe('parchment', sum.lines.join(' | '));
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'up' || e.action === 'down') {
      this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - PARCHMENT_LINES), this.scroll + (e.action === 'up' ? -1 : 1)));
    } else if ((e.action === 'confirm' || e.action === 'cancel' || e.action === 'start') && !e.repeat) {
      this.game.markSeen(this.toBlock);
      this.game.sfx('confirm');
      this.game.scenes.pop();
    }
  }

  /** Visible for tests and debugging. */
  text(): string {
    return this.lines.join('\n');
  }

  draw(ctx: CanvasRenderingContext2D): void {
    useUiRemap();
    drawParchment(ctx, this.title, this.lines, this.scroll, 'A: CLOSE');
  }
}

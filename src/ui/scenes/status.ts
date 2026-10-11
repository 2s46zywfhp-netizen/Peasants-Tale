import { wrap } from '../../render/font';
import { PARCHMENT_COLS, PARCHMENT_LINES, drawParchment } from '../../render/parchment';
import { useUiRemap } from '../../render/palette';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { almanacLines, chronicleLines, storesLines, dutyLines, householdLines, selfLines, soulLines, standingLines, villageLines } from '../symptoms';
import { probe } from '../probe';
import { TitleScene } from './title';

const PAGES = [
  ['YOURSELF', (g: Game) => selfLines(g.sim())],
  ['STORES', (g: Game) => storesLines(g.sim())],
  ['FAMILY', (g: Game) => householdLines(g.sim())],
  ['SOUL', (g: Game) => soulLines(g.sim())],
  ['STANDING', (g: Game) => standingLines(g.sim())],
  ['VILLAGE', (g: Game) => villageLines(g.sim())],
  ['FIELDS & DUTIES', (g: Game) => dutyLines(g.sim())],
  ['CHRONICLE', (g: Game) => chronicleLines(g.sim())],
  ['ALMANAC', (g: Game) => almanacLines(g.sim(), g.now())],
] as const;

/** The stat screen: symptoms on parchment, never numbers. */
export class StatusScene implements Scene {
  readonly opaque = true;
  private page = 0;
  private scroll = 0;
  private lines: string[] = [];

  constructor(private game: Game) {}

  enter(): void {
    this.build();
  }

  private build(): void {
    const raw = PAGES[this.page]![1](this.game);
    this.lines = raw.flatMap((l) => [...wrap(l.toUpperCase(), PARCHMENT_COLS), '']);
    this.scroll = 0;
    probe('page', `${PAGES[this.page]![0]}: ${raw.join(' ')}`);
  }

  onAction(e: ActionEvent): void {
    const g = this.game;
    if (e.action === 'left' || e.action === 'right') {
      this.page = (this.page + (e.action === 'left' ? -1 : 1) + PAGES.length) % PAGES.length;
      this.build();
      g.sfx('move');
    } else if (e.action === 'up' || e.action === 'down') {
      this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - PARCHMENT_LINES), this.scroll + (e.action === 'up' ? -1 : 1)));
    } else if (e.action === 'cancel' || e.action === 'start') {
      g.sfx('cancel');
      g.scenes.pop();
    } else if (e.action === 'select' && !e.repeat) {
      g.sfx('cancel');
      g.scenes.pop(false);
      g.scenes.replace(new TitleScene(g));
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    useUiRemap();
    drawParchment(ctx, `< ${PAGES[this.page]![0]} >`, this.lines, this.scroll, 'B:BACK SELECT:TITLE');
  }
}

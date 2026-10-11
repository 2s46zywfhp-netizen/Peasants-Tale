import { blit, spriteId } from '../../render/atlas';
import { INK, clear, darkPanel, parchment, rect } from '../../render/draw';
import { H, W } from '../../render/fb';
import { drawText, drawTextCentered, drawTextRight, wrap } from '../../render/font';
import { C } from '../../render/palette';
import { TEXT_SPEED_CPS } from '../../sim/balance';
import { FAMILY_NAMES, MALE_NAMES } from '../../sim/state';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';
import { WorldScene } from './world';

const KEYS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', ' ', '-', 'DEL', 'END'] as const;
const GRID_COLS = 7;
const CELL_W = 28;
const CELL_H = 20;
const GRID_X = 36;
const GRID_Y = 78;

/** A letter grid, as on old handhelds: D-pad to a letter, A to write it, B to rub out. */
export class NameEntryScene implements Scene {
  readonly opaque = true;
  private cursor = 0;
  private stage: 'name' | 'family' = 'name';
  private name = '';
  private family = '';

  constructor(private game: Game) {
    // A suggestion to start from, changeable: the life's own seed picks it.
    const n = game.newSeed();
    this.name = MALE_NAMES[n % MALE_NAMES.length]!;
    this.family = FAMILY_NAMES[(n >>> 8) % FAMILY_NAMES.length]!;
    probe('scene', 'naming');
  }

  private get text(): string {
    return this.stage === 'name' ? this.name : this.family;
  }

  private set text(v: string) {
    if (this.stage === 'name') this.name = v;
    else this.family = v;
  }

  private max(): number {
    return this.stage === 'name' ? 8 : 10;
  }

  onAction(e: ActionEvent): void {
    const g = this.game;
    const n = KEYS.length;
    const rows = Math.ceil(n / GRID_COLS);
    if (e.action === 'left' || e.action === 'right') {
      this.cursor = (this.cursor + (e.action === 'left' ? -1 : 1) + n) % n;
      g.sfx('move');
    } else if (e.action === 'up' || e.action === 'down') {
      let c = this.cursor + (e.action === 'up' ? -GRID_COLS : GRID_COLS);
      if (c < 0) c += rows * GRID_COLS;
      if (c >= rows * GRID_COLS) c -= rows * GRID_COLS;
      this.cursor = Math.min(n - 1, c);
      g.sfx('move');
    } else if (e.action === 'cancel') {
      if (this.text.length) this.text = this.text.slice(0, -1);
      else if (this.stage === 'family') this.stage = 'name';
      g.sfx('cancel');
    } else if (e.action === 'start') {
      this.submit();
    } else if (e.action === 'confirm') {
      const k = KEYS[this.cursor]!;
      if (k === 'END') return this.submit();
      if (k === 'DEL') {
        this.text = this.text.slice(0, -1);
        g.sfx('cancel');
        return;
      }
      if (this.text.length >= this.max() || (k === ' ' && (!this.text.length || this.text.endsWith(' ')))) return g.sfx('error');
      this.text += k;
      g.sfx('blip');
    }
  }

  private submit(): void {
    const g = this.game;
    const t = this.text.trim();
    if (!t) return g.sfx('error');
    this.text = t;
    g.sfx('confirm');
    if (this.stage === 'name') {
      this.stage = 'family';
      this.cursor = KEYS.length - 1;
      return;
    }
    g.newLife({ name: this.name, familyName: this.family });
    g.scenes.replace(new IntroScene(g));
  }

  draw(now: number): void {
    clear(C.black);
    parchment(6, 6, W - 12, H - 12);
    drawTextCentered(this.stage === 'name' ? 'YOUR NAME?' : 'YOUR FAMILY NAME?', 20, INK.title);
    darkPanel(40, 36, W - 80, 26);
    drawText(this.text, 52, 45, C.bone);
    if (Math.floor(now / 400) % 2 === 0 && this.text.length < this.max()) drawText('_', 52 + this.text.length * 8, 45, C.gold);
    for (let i = 0; i < KEYS.length; i++) {
      const k = KEYS[i]!;
      // DEL and END sit in a wide last row of their own.
      const x = k.length > 1 ? GRID_X + 24 + (i - 28) * 96 : GRID_X + (i % GRID_COLS) * CELL_W;
      const y = GRID_Y + Math.floor(i / GRID_COLS) * CELL_H;
      if (i === this.cursor) rect(x - 4, y - 4, k.length > 1 ? k.length * 8 + 8 : 16, 16, C.blood);
      drawText(k === ' ' ? '_' : k, x, y, i === this.cursor ? C.bone : k.length > 1 ? INK.title : INK.text);
    }
    drawTextCentered('A: WRITE   B: RUB OUT', 186, INK.dim);
    drawTextCentered('START: DONE', 198, INK.dim);
  }
}

/** A few pages by candlelight before the first morning. */
export class IntroScene implements Scene {
  readonly opaque = true;
  private page = 0;
  private startedAt = 0;
  private pages: string[][];

  constructor(private game: Game) {
    const s = game.sim();
    const [p, wife, son] = s.members;
    const raw = [
      'Lady Day, in the year of Our Lord 1345.',
      'The manor of Ashby. A church, a mill, an alehouse, the lord\'s hall on the rise, and fifteen households besides your own.',
      `You are ${p!.name} ${s.familyName}, villein. Fifteen acres in the common fields; ${wife!.name}, your wife; ${son!.name}, your son; a pig and four hens.`,
      'The lord takes his week-work and his rent. The Church takes its tithe. What is left must feed you.',
      'Your life goes on when you look away. A week passes for every day of yours, and your peasant lives by habit.',
      'Keep them fed. Keep your name clean. Keep the dark at the door.',
    ];
    this.pages = raw.map((t) => wrap(t.toUpperCase(), 26));
  }

  enter(): void {
    this.startedAt = this.game.frameNow();
    probe('scene', 'intro');
  }

  private shown(now: number): number {
    return Math.floor(((now - this.startedAt) / 1000) * TEXT_SPEED_CPS[this.game.save.data.settings.textSpeed]);
  }

  onAction(e: ActionEvent): void {
    if (e.repeat || (e.action !== 'confirm' && e.action !== 'start' && e.action !== 'cancel')) return;
    const g = this.game;
    const total = this.pages[this.page]!.reduce((n, l) => n + l.length, 0);
    if (e.action === 'confirm' && this.shown(g.frameNow()) < total) {
      this.startedAt = -1e12;
      return;
    }
    if (e.action === 'confirm' && this.page + 1 < this.pages.length) {
      this.page++;
      this.startedAt = g.frameNow();
      g.sfx('blip');
      return;
    }
    // The last page, or B/START to skip: the first morning.
    g.sfx('start');
    g.markSeen(g.sim().block);
    g.scenes.replace(new WorldScene(g));
  }

  private candle = spriteId('icon.candle');

  draw(now: number): void {
    clear(C.black);
    blit(this.candle, (W >> 1) - 8, 18);
    rect((W >> 1) - 1 + ((now >> 8) % 2), 19, 1, 2, (now >> 7) % 3 ? C.gold : C.flame);
    const lines = this.pages[this.page]!;
    let left = this.shown(now);
    const top = 112 - lines.length * 6;
    for (let i = 0; i < lines.length && left > 0; i++) {
      const l = lines[i]!;
      drawTextCentered(left >= l.length ? l : l.slice(0, left), top + i * 12, C.parchment);
      left -= l.length;
    }
    if (left >= 0 && Math.floor(now / 400) % 2 === 0) drawTextCentered(this.page + 1 < this.pages.length ? '>' : 'A: BEGIN', 190, C.flame);
    drawTextRight('B: SKIP', W - 8, H - 14, C.stone);
  }
}

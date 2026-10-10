import { ATLAS, anim, atlasImage, drawSprite, frameAt, spriteSize, type Anim } from '../../render/atlas';
import { clear, frame, rect } from '../../render/draw';
import { drawText } from '../../render/font';
import { C, DMG, IDENTITY, PLAGUE, SEASON_REMAPS, TIME_REMAPS, compose, setRemap, useUiRemap, type Remap } from '../../render/palette';
import { ANIMS } from '../../render/sprites';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import { probe } from '../probe';
import type { Scene } from '../scene';

/** Palettes the gallery cycles through. */
const PALETTES: readonly [string, Remap][] = [
  ['BASE', IDENTITY],
  ['SPRING', SEASON_REMAPS.spring],
  ['SUMMER', SEASON_REMAPS.summer],
  ['AUTUMN', SEASON_REMAPS.autumn],
  ['WINTER', SEASON_REMAPS.winter],
  ['DAWN', TIME_REMAPS[0]!],
  ['DUSK', TIME_REMAPS[4]!],
  ['NIGHT', TIME_REMAPS[5]!],
  ['PLAGUE', compose(SEASON_REMAPS.summer, PLAGUE)],
  ['DMG', DMG],
];
const CYCLE_MS = 1800;

interface Entry {
  name: string;
  anim: Anim | null;
  id: number;
  w: number;
  h: number;
}

/** Every animation (animated) and every sprite that is not an animation frame. */
function entries(): Entry[] {
  const inAnim = new Set(Object.values(ANIMS).flatMap((a) => a.frames));
  const out: Entry[] = Object.keys(ANIMS).sort().map((n) => {
    const a = anim(n);
    const [w, h] = spriteSize(a.ids[0]!);
    return { name: n, anim: a, id: a.ids[0]!, w, h };
  });
  ATLAS.names.forEach((n, id) => {
    if (inAnim.has(n)) return;
    const [w, h] = spriteSize(id);
    out.push({ name: n, anim: null, id, w, h });
  });
  return out;
}

/** Pages: a 9x6 grid of small sprites, or one large sprite per page. */
function paginate(all: Entry[]): Entry[][] {
  const pages: Entry[][] = [];
  let cur: Entry[] = [];
  for (const e of all) {
    if (e.w > 16 || e.h > 16) {
      pages.push([e]);
      continue;
    }
    cur.push(e);
    if (cur.length === 54) {
      pages.push(cur);
      cur = [];
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/** Debug: every sprite and animation, cycling the palettes. */
export class GalleryScene implements Scene {
  readonly opaque = true;
  private all = entries();
  private pages = paginate(this.all);
  private page = 0;
  private cursor = 0;
  private hold = false;

  constructor(private game: Game) {}

  /** For tests: how many sprites/animations are shown. */
  count(): number {
    return this.all.length;
  }

  onAction(e: ActionEvent): void {
    const p = this.pages[this.page]!;
    switch (e.action) {
      case 'left': this.page = (this.page - 1 + this.pages.length) % this.pages.length; this.cursor = 0; break;
      case 'right': this.page = (this.page + 1) % this.pages.length; this.cursor = 0; break;
      case 'up': this.cursor = Math.max(0, this.cursor - 9); break;
      case 'down': this.cursor = Math.min(p.length - 1, this.cursor + 9); break;
      case 'confirm': if (!e.repeat) this.hold = !this.hold; break;
      case 'cancel': this.game.scenes.pop(false); break;
      default: break;
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    const pi = this.hold ? 0 : Math.floor(now / CYCLE_MS) % PALETTES.length;
    const [palName, remap] = PALETTES[pi]!;
    probe('gallery', `${this.page + 1}/${this.pages.length} ${palName} ${this.all.length}`);
    useUiRemap();
    clear(ctx, C.night);
    const img = atlasImage(remap);
    const p = this.pages[this.page]!;
    if (p.length === 1 && (p[0]!.w > 16 || p[0]!.h > 16)) {
      const e = p[0]!;
      drawSprite(ctx, img, e.anim ? frameAt(e.anim, now) : e.id, Math.max(0, (160 - e.w) >> 1), 20 + Math.max(0, (96 - e.h) >> 1));
      this.cursor = 0;
    } else {
      for (let i = 0; i < p.length; i++) {
        const e = p[i]!;
        const x = (i % 9) * 17 + 4;
        const y = Math.floor(i / 9) * 17 + 16;
        if (i === this.cursor) frame(ctx, x - 1, y - 1, 18, 18, C.ember, C.night);
        drawSprite(ctx, img, e.anim ? frameAt(e.anim, now, i * 53) : e.id, x, y);
      }
    }
    // Header and footer in the true UI palette.
    useUiRemap();
    rect(ctx, 0, 0, 160, 12, C.black);
    drawText(ctx, `${this.page + 1}/${this.pages.length} ${palName}`, 0, 2, C.gold);
    rect(ctx, 0, 120, 160, 24, C.black);
    const sel = p[Math.min(this.cursor, p.length - 1)]!;
    drawText(ctx, sel.name.toUpperCase().slice(0, 20), 0, 122, C.bone);
    drawText(ctx, `${sel.anim ? `ANIM ${sel.anim.ids.length}F` : 'STILL'} ${sel.w}X${sel.h}`, 0, 132, C.mist);
    setRemap(IDENTITY);
  }
}

import { anim, animNames, blit, frameAt, spriteH, spriteId, spriteNames, spriteW, type Anim } from '../../render/atlas';
import { clear, frame, rect } from '../../render/draw';
import { SCENES, type SceneId } from '../../render/scenes/maps';
import { SCENE_IDS, drawWorld, type WorldView } from '../../render/world';
import { W, finishWorld, resetLight } from '../../render/fb';
import { drawText } from '../../render/font';
import { C, setDmgMode, dmgOn, type SeasonName } from '../../render/palette';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import { probe } from '../probe';
import type { Scene } from '../scene';

/** Looks the gallery cycles through: season, plague, block of the day, DMG. */
const LOOKS: readonly { name: string; season: SeasonName; plague: boolean; bod: number; dmg: boolean }[] = [
  { name: 'BASE', season: 'spring', plague: false, bod: 2, dmg: false },
  { name: 'SUMMER', season: 'summer', plague: false, bod: 2, dmg: false },
  { name: 'AUTUMN', season: 'autumn', plague: false, bod: 2, dmg: false },
  { name: 'WINTER', season: 'winter', plague: false, bod: 2, dmg: false },
  { name: 'DAWN', season: 'spring', plague: false, bod: 0, dmg: false },
  { name: 'DUSK', season: 'spring', plague: false, bod: 4, dmg: false },
  { name: 'NIGHT', season: 'spring', plague: false, bod: 5, dmg: false },
  { name: 'PLAGUE', season: 'summer', plague: true, bod: 2, dmg: false },
  { name: 'DMG', season: 'spring', plague: false, bod: 2, dmg: true },
];
const CYCLE_MS = 1800;
const GRID_COLS = 14;
const GRID_ROWS = 9;
const TOP = 16;
const BOTTOM = 196;

interface Entry {
  /** A whole scene (drawn by the world renderer) rather than a sprite. */
  scene?: SceneId;
  name: string;
  label: string;
  info: string;
  anim: Anim | null;
  id: number;
  w: number;
  h: number;
}

/** Every animation (animated) and every sprite that is neither an animation frame nor a layer. */
function entries(): Entry[] {
  const anims = animNames().sort();
  const inAnim = new Set<number>();
  const out: Entry[] = anims.map((n) => {
    const a = anim(n);
    a.frames.forEach((f) => inAnim.add(f));
    const id = a.frames[0]!;
    return { name: n, label: n.toUpperCase().slice(0, 30), info: `ANIM ${a.frames.length}F ${spriteW(id)}X${spriteH(id)}`, anim: a, id, w: spriteW(id), h: spriteH(id) };
  });
  for (const n of spriteNames()) {
    if (n.includes('@')) continue;
    const id = spriteId(n);
    if (inAnim.has(id)) continue;
    out.push({ name: n, label: n.toUpperCase().slice(0, 30), info: `STILL ${spriteW(id)}X${spriteH(id)}`, anim: null, id, w: spriteW(id), h: spriteH(id) });
  }
  for (const id of SCENE_IDS) out.push({ scene: id, name: id, label: `SCENE: ${SCENES[id].name}`.slice(0, 30), info: SCENES[id].room ? 'ROOM 384X192' : 'OUTDOORS 512X144', anim: null, id: 0, w: 256, h: 224 });
  return out;
}

/** Pages: a grid of small sprites, or one large sprite per page. */
function paginate(all: Entry[]): Entry[][] {
  const pages: Entry[][] = [];
  let cur: Entry[] = [];
  for (const e of all) {
    if (e.w > 16 || e.h > 16) {
      pages.push([e]);
      continue;
    }
    cur.push(e);
    if (cur.length === GRID_COLS * GRID_ROWS) {
      pages.push(cur);
      cur = [];
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/** Debug: every sprite and animation, cycling seasons, hours, the plague and DMG. */
export class GalleryScene implements Scene {
  readonly opaque = true;
  private all = entries();
  private pages = paginate(this.all);
  private page = 0;
  private cursor = 0;
  private hold = false;
  private headers: string[] = [];
  private headerKey = -1;
  private dmgWas = false;
  private view: WorldView = { scene: SCENES.green, cam: 0, actors: [], prompt: '', promptX: 0, promptY: 0, needs: [], belt: 'axe', queued: 0, message: '' };

  constructor(private game: Game) {}

  enter(): void {
    this.dmgWas = dmgOn();
  }

  exit(): void {
    setDmgMode(this.dmgWas);
  }

  /** For tests: how many sprites/animations are shown. */
  count(): number {
    return this.all.length;
  }

  onAction(e: ActionEvent): void {
    const p = this.pages[this.page]!;
    switch (e.action) {
      case 'left': this.page = (this.page - 1 + this.pages.length) % this.pages.length; this.cursor = 0; break;
      case 'right': this.page = (this.page + 1) % this.pages.length; this.cursor = 0; break;
      case 'up': this.cursor = Math.max(0, this.cursor - GRID_COLS); break;
      case 'down': this.cursor = Math.min(p.length - 1, this.cursor + GRID_COLS); break;
      case 'confirm': if (!e.repeat) this.hold = !this.hold; break;
      case 'cancel': this.game.scenes.pop(false); break;
      default: break;
    }
  }

  draw(now: number): void {
    const li = this.hold ? 0 : Math.floor(now / CYCLE_MS) % LOOKS.length;
    const look = LOOKS[li]!;
    const key = this.page * 100 + li;
    if (key !== this.headerKey) {
      this.headerKey = key;
      this.headers[0] = `${this.page + 1}/${this.pages.length} ${look.name}`;
      probe('gallery', `${this.headers[0]} ${this.all.length}`);
    }
    setDmgMode(look.dmg);
    clear(C.deep);
    resetLight();
    const p = this.pages[this.page]!;
    if (p[0]!.scene) {
      // A whole scene, as the world renderer draws it (in the look of the moment, not the gallery's).
      const sc = SCENES[p[0]!.scene];
      this.view.scene = sc;
      this.view.cam = ((now / 40) | 0) % (sc.room ? 128 : 256);
      drawWorld(this.game.sim(), this.view, now, this.game.now);
      rect(0, 0, W, TOP, C.black);
      drawText(this.headers[0]!, 4, 4, C.gold);
      rect(0, BOTTOM, W, 224 - BOTTOM, C.black);
      drawText(p[0]!.label, 4, BOTTOM + 4, C.bone);
      drawText(p[0]!.info, 4, BOTTOM + 15, C.mist);
      return;
    }
    if (p.length === 1 && (p[0]!.w > 16 || p[0]!.h > 16)) {
      const e = p[0]!;
      blit(e.anim ? frameAt(e.anim, now) : e.id, Math.max(0, (W - e.w) >> 1), TOP + Math.max(0, (BOTTOM - TOP - e.h) >> 1));
      this.cursor = 0;
    } else {
      for (let i = 0; i < p.length; i++) {
        const e = p[i]!;
        const x = (i % GRID_COLS) * 18 + 2;
        const y = Math.floor(i / GRID_COLS) * 19 + TOP + 2;
        if (i === this.cursor) frame(x - 1, y - 1, 18, 18, C.ember, C.deep);
        blit(e.anim ? frameAt(e.anim, now, i * 53) : e.id, x, y);
      }
    }
    finishWorld(look.season, look.plague, look.bod, TOP, BOTTOM);
    rect(0, 0, W, TOP, C.black);
    drawText(this.headers[0]!, 4, 4, C.gold);
    rect(0, BOTTOM, W, 224 - BOTTOM, C.black);
    const sel = p[Math.min(this.cursor, p.length - 1)]!;
    drawText(sel.label, 4, BOTTOM + 4, C.bone);
    drawText(sel.info, 4, BOTTOM + 15, C.mist);
  }
}

import { anim, type Anim } from '../../render/atlas';
import { ditherFill } from '../../render/draw';
import { C } from '../../render/palette';
import { COLS, OPPOSITE, SCENES, SCENE_OF, TILE, originY, tileAt, type Dir, type Npc, type SceneDef, type SceneId } from '../../render/scenes/maps';
import { BODY_VARIANTS } from '../../render/sprites';
import { drawWorld, type Actor, type WorldView } from '../../render/world';
import { updateWeather } from '../../render/weather';
import { reserveTier } from '../../sim/body';
import { dayInfo } from '../../sim/calendar';
import { isBoonDay, isWeekWorkDay } from '../../sim/obligations';
import type { Location } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { talk } from '../talk';
import { ActionMenuScene } from './actionMenu';
import { DialogueScene } from './dialogue';
import { StatusScene } from './status';

const SPEED = 42; // px per second
/** SPEED in sixteenths of a pixel per ms, in 8.8 fixed point (42 * 16 / 1000 * 256 ≈ 172). */
const SPEED_SUB_Q8 = Math.round(((SPEED * 16) / 1000) * 256);
const FADE_MS = 360;
const POSE_AFTER_MS = 900;

const POSES = ['idle', 'walk.down', 'walk.up', 'walk.left', 'walk.right', 'work', 'eat', 'sleep', 'pray'] as const;
type Pose = (typeof POSES)[number];
/** [variant][pose] resolved once: no strings built while playing. */
const PEASANT: Anim[][] = BODY_VARIANTS.map((v) => POSES.map((p) => anim(`peasant.${v}.${p}`)));

const SPAWN: Record<SceneId, [number, number]> = {
  cottage: [4, 5], green: [1, 2], fields: [4, 2], woods: [8, 2], churchyard: [4, 2], church: [4, 6], manor: [5, 2],
};

const PROMPT: Record<Location, string> = {
  home: 'A:HOME', green: 'A:GREEN', tavern: 'A:ALEHOUSE', strips: 'A:STRIPS', demesne: 'A:DEMESNE',
  church: 'A:CHURCH', woods: 'A:WOODS', stream: 'A:STREAM',
};
const LOCATION_TITLE: Record<Location, string> = {
  home: 'COTTAGE', green: 'VILLAGE GREEN', tavern: 'ALEHOUSE', strips: 'YOUR STRIPS', demesne: "LORD'S DEMESNE",
  church: 'CHURCH', woods: 'WOODS', stream: 'STREAM',
};

interface NpcRt {
  def: Npc;
  actor: Actor;
  idle: Anim;
  walk: Anim;
  phase: number;
}

const mkActor = (a: Anim, x: number, y: number, offset: number): Actor => ({ anim: a, x, y, offset, eyeX: -1, eyeY: -1, visible: true });

export class WorldScene implements Scene {
  readonly opaque = true;
  private sceneId: SceneId;
  private x = 0;
  private y = 0;
  private dir: Dir | 'up' | 'down' = 'down';
  private moving = false;
  private stillSince = 0;
  private stepAcc = 0;
  /** Sub-pixel movement in sixteenths of a pixel: positions stay integers (no boxed doubles while walking). */
  private subX = 0;
  private subY = 0;
  private eatUntil = 0;
  private fadeT = -1;
  private pending: { to: SceneId; col: number; row: number } | null = null;
  private player: Actor;
  private npcs: NpcRt[] = [];
  private pens: { kind: string; actor: Actor; i: number }[] = [];
  private message = '';
  private messageUntil = 0;
  private logSeen = 0;
  private view: WorldView;

  constructor(private game: Game) {
    const s = game.sim();
    this.sceneId = SCENE_OF[s.location];
    this.player = mkActor(PEASANT[1]![0]!, 0, 0, 0);
    this.view = { scene: SCENES[this.sceneId], px: 0, actors: [], prompt: '' };
    this.load(this.sceneId, ...SPAWN[this.sceneId]);
    this.logSeen = s.log.length;
  }

  private get scene(): SceneDef {
    return SCENES[this.sceneId];
  }

  /** Enter a scene with the player standing on tile (col, row). */
  private load(id: SceneId, col: number, row: number): void {
    this.sceneId = id;
    const sc = SCENES[id];
    this.x = col * TILE;
    this.y = originY(sc) + row * TILE;
    this.npcs = sc.npcs.map((def, i) => {
      const idle = anim(`${def.who}.idle`);
      const walk = anim(`${def.who}.walk`);
      const a = mkActor(idle, def.x, originY(sc) + def.y, i * 331);
      if (def.who === 'blackDog') {
        a.eyeX = 11;
        a.eyeY = 11;
      }
      return { def, actor: a, idle, walk, phase: i * 1.7 };
    });
    this.pens = [];
    for (const p of sc.pens ?? []) {
      const n = p.kind === 'hen' ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const a = mkActor(anim(`${p.kind}.idle${i % 2 ? '.left' : ''}`), p.x + i * 10, originY(sc) + p.y + (i % 2) * 6, i * 177);
        this.pens.push({ kind: p.kind, actor: a, i });
      }
    }
    this.view = { scene: sc, px: this.x, actors: [this.player, ...this.npcs.map((n) => n.actor), ...this.pens.map((p) => p.actor)], prompt: '' };
  }

  private go(to: SceneId, col: number, row: number): void {
    if (this.fadeT >= 0) return;
    this.pending = { to, col, row };
    this.fadeT = 0;
  }

  /** Created once (a closure inside onAction would allocate a context on every button press). */
  private readonly onMenuReport = (m: string): void => {
    this.say(m);
    if (/^EAT/.test(m)) {
      this.eatUntil = this.game.frameNow() + 2400;
      this.game.sfx('eat');
    }
  };

  say(text: string): void {
    this.message = text.slice(0, 12);
    this.messageUntil = this.game.frameNow() + 2500;
  }

  /** The tile in front of the player (written to facingCol/facingRow: no allocation per frame). */
  private facingCol = 0;
  private facingRow = 0;
  private faceTile(): void {
    const sc = this.scene;
    const oy = originY(sc);
    const cx = this.x + 8 + (this.dir === 'west' ? -12 : this.dir === 'east' ? 12 : 0);
    const cy = this.y + 12 + (this.dir === 'up' ? -12 : this.dir === 'down' ? 10 : 0);
    this.facingCol = cx >> 4; // TILE = 16: shifts floor without doubles
    this.facingRow = (cy - oy) >> 4;
  }

  private hotspot(): Location | null {
    this.faceTile();
    const t = tileAt(this.scene, this.facingCol, this.facingRow);
    if (t?.hotspot) return t.hotspot;
    const sc = this.scene;
    const under = tileAt(sc, (this.x + 8) >> 4, (this.y + 12 - originY(sc)) >> 4);
    return under?.hotspot ?? sc.ambient ?? null;
  }

  private nearNpc(): NpcRt | null {
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]!;
      if (!n.actor.visible || !n.def.talk) continue;
      if (Math.abs(n.actor.x - this.x) < 16 && Math.abs(n.actor.y - this.y) < 16) return n;
    }
    return null;
  }

  onAction(e: ActionEvent): void {
    if (this.fadeT >= 0) return;
    const g = this.game;
    if (e.action === 'confirm' && !e.repeat) {
      if (g.sim().dead) return g.sfx('error');
      const npc = this.nearNpc();
      if (npc) {
        const t = talk(npc.def.talk!, g.sim());
        g.scenes.push(new DialogueScene(g, t.speaker, t.pages), false);
        return;
      }
      const loc = this.hotspot();
      if (!loc) return g.sfx('error');
      g.sfx('confirm');
      g.scenes.push(new ActionMenuScene(g, loc, LOCATION_TITLE[loc], this.onMenuReport), false);
    } else if (e.action === 'start' && !e.repeat) {
      g.sfx('confirm');
      g.scenes.push(new StatusScene(g));
    }
  }

  /** Is the feet box at (x, y) on anything solid? Corner by corner, without allocating. */
  private blocked(x: number, y: number): boolean {
    for (let k = 0; k < 4; k++) {
      const fx = x + (k & 1 ? 11 : 4);
      const fy = y + (k & 2 ? 15 : 12);
      if (this.solidAt(fx, fy)) return true;
    }
    return false;
  }

  private solidAt(fx: number, fy: number): boolean {
    const sc = this.scene;
    const col = fx >> 4;
    if (col < 0 || col >= COLS) return false; // edges are handled as exits
    const t = tileAt(sc, col, (fy - originY(sc)) >> 4);
    return !t || t.solid === true;
  }

  update(dt: number, now: number): void {
    const g = this.game;
    updateWeather(dt);
    if (this.fadeT >= 0) {
      const before = this.fadeT;
      this.fadeT += dt;
      if (before < FADE_MS / 2 && this.fadeT >= FADE_MS / 2 && this.pending) {
        this.load(this.pending.to, this.pending.col, this.pending.row);
        this.pending = null;
      }
      if (this.fadeT >= FADE_MS) this.fadeT = -1;
    }

    // Walking: held directions move smoothly.
    const inp = g.input;
    let dx = 0;
    let dy = 0;
    if (this.fadeT < 0 && g.scenes.top === this && !g.sim().dead) {
      if (inp.isHeld('left')) dx -= 1;
      if (inp.isHeld('right')) dx += 1;
      if (inp.isHeld('up')) dy -= 1;
      if (inp.isHeld('down')) dy += 1;
    }
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      this.stillSince = now;
      this.dir = dx < 0 ? 'west' : dx > 0 ? 'east' : dy < 0 ? 'up' : 'down';
      const sub = (dt * SPEED_SUB_Q8) >> 8;
      // Move a pixel at a time so collisions are exact.
      this.subX = dx === 0 ? 0 : this.subX + dx * sub;
      while (this.subX >= 16) {
        this.subX -= 16;
        if (!this.blocked(this.x + 1, this.y)) this.x++;
      }
      while (this.subX <= -16) {
        this.subX += 16;
        if (!this.blocked(this.x - 1, this.y)) this.x--;
      }
      this.subY = dy === 0 ? 0 : this.subY + dy * sub;
      while (this.subY >= 16) {
        this.subY -= 16;
        if (!this.blocked(this.x, this.y + 1)) this.y++;
      }
      while (this.subY <= -16) {
        this.subY += 16;
        if (!this.blocked(this.x, this.y - 1)) this.y--;
      }
      this.stepAcc += sub;
      if (this.stepAcc >= 12 * 16) {
        this.stepAcc = 0;
        g.sfx('step');
      }
      const sc = this.scene;
      const oy = originY(sc);
      const minY = oy - 8;
      const maxY = oy + sc.rows.length * TILE - 16;
      if (this.y < minY) this.y = minY;
      if (this.y > maxY) this.y = maxY;
      // Edges: walk off into the next scene, or stop.
      if (this.x < -6 || this.x > 160 - 10) {
        const d: Dir = this.x < 0 ? 'west' : 'east';
        const to = sc.exits[d];
        if (to) {
          const row = Math.max(0, Math.min(SCENES[to].rows.length - 1, Math.round((this.y - oy) / TILE)));
          this.go(to, OPPOSITE[d] === 'west' ? 0 : COLS - 1, row);
        }
        if (this.x < -6) this.x = -6;
        if (this.x > 150) this.x = 150;
      }
      // Doors underfoot.
      const under = tileAt(sc, (this.x + 8) >> 4, (this.y + 12 - oy) >> 4);
      if (under?.door) {
        g.sfx('door');
        this.go(under.door.to, under.door.col, under.door.row);
      }
    }

    this.updateActors(now);
    this.watchLog();
  }

  private bodyVariant(): number {
    const b = this.game.sim().members[0]!.body;
    if (b.illness) return BODY_VARIANTS.indexOf('sick');
    if (b.warmth < 30) return BODY_VARIANTS.indexOf('cold');
    return BODY_VARIANTS.indexOf(reserveTier(b.reserve));
  }

  private pose(now: number): Pose {
    if (this.moving) return this.dir === 'west' ? 'walk.left' : this.dir === 'east' ? 'walk.right' : this.dir === 'up' ? 'walk.up' : 'walk.down';
    if (now < this.eatUntil) return 'eat';
    if (now - this.stillSince < POSE_AFTER_MS) return 'idle';
    const s = this.game.sim();
    const plan = s.plan && s.block >= s.plan.from && s.block < s.plan.until ? s.plan : null;
    if (!plan) return 'idle';
    const id = this.sceneId;
    if (plan.action === 'sleep' && id === 'cottage') return 'sleep';
    if ((plan.action === 'workStrips' && id === 'fields') || (plan.action === 'weekWork' && id === 'manor') || (plan.action === 'gatherFirewood' && id === 'woods')) return 'work';
    if ((plan.action === 'pray' || plan.action === 'attendMass' || plan.action === 'confess') && id === 'church') return 'pray';
    return 'idle';
  }

  private updateActors(now: number): void {
    const s = this.game.sim();
    const pose = this.pose(now);
    const p = this.player;
    p.anim = PEASANT[this.bodyVariant()]![POSES.indexOf(pose)]!;
    if (pose === 'sleep') {
      p.x = 6 * TILE + 4; // on the pallet
      p.y = originY(this.scene) + TILE - 6;
    } else {
      p.x = this.x;
      p.y = this.y;
    }
    p.visible = !s.dead;
    this.view.px = this.x;

    const day = Math.floor(s.block / 6);
    const bod = s.block % 6;
    const info = dayInfo(day);
    const daytime = bod >= 1 && bod <= 3;
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]!;
      const w = n.def.when;
      n.actor.visible =
        w === undefined ? true
        : w === 'day' ? daytime
        : w === 'night' ? bod >= 4 || bod === 0
        : w === 'sundayMorning' ? info.isSunday && bod <= 2
        : w === 'weekWork' ? (isWeekWorkDay(info) || isBoonDay(info)) && daytime
        : w === 'feast' ? info.feasts.length > 0 || info.isSunday
        : w === 'spouse' ? s.members[1]?.alive === true
        : true;
      const range = n.def.wander ?? 0;
      if (range > 0) {
        const t = now / 2600 + n.phase;
        const nx = n.def.x + Math.sin(t) * range;
        const walking = Math.abs(Math.cos(t)) > 0.35;
        n.actor.anim = walking ? n.walk : n.idle;
        n.actor.x = nx;
      }
    }
    const w = s.wealth;
    for (let i = 0; i < this.pens.length; i++) {
      const pe = this.pens[i]!;
      const owned = pe.kind === 'hen' ? w.hens : pe.kind === 'pig' ? w.pig : pe.kind === 'cow' ? w.cow : w.ox;
      pe.actor.visible = pe.i < owned;
    }

    if (now > this.messageUntil) this.message = '';
    const near = this.nearNpc();
    const loc = near ? null : this.hotspot();
    this.view.prompt = this.message || (near ? 'A:TALK' : loc ? PROMPT[loc] : '');
  }

  /** Dark events in the log since last frame bring a low sting. */
  private watchLog(): void {
    const log = this.game.sim().log;
    if (log.length === this.logSeen) return;
    for (let i = Math.max(0, this.logSeen); i < log.length; i++) {
      const t = log[i]!.type;
      if (t === 'death' || t === 'illness' || t === 'neglect' || (t === 'event' && /dog|thief|fox|quarrel/i.test(log[i]!.text)) || (t === 'manor' && /EVICTED|Summoned/.test(log[i]!.text)) || (t === 'church' && /Summoned|penance/i.test(log[i]!.text))) {
        this.game.sfx('sting');
        break;
      }
    }
    this.logSeen = log.length;
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    drawWorld(ctx, this.game.sim(), this.view, now);
    if (this.fadeT >= 0) {
      const half = FADE_MS / 2;
      const a = this.fadeT < half ? this.fadeT / half : 1 - (this.fadeT - half) / half;
      ditherFill(ctx, Math.round(a * 4) / 4, C.black);
    }
  }
}

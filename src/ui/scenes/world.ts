import { anim, type Anim } from '../../render/atlas';
import { ditherFill } from '../../render/draw';
import { C } from '../../render/palette';
import { OPPOSITE, SCENES, colsOf, SCENE_OF, TILE, originY, tileAt, type Dir, type Npc, type SceneDef, type SceneId } from '../../render/scenes/maps';
import { BODY_VARIANTS } from '../../render/sprites';
import { drawWorld, setDayListener, type Actor, type WorldView } from '../../render/world';
import { BED_SLEEP, DOOR_X, FEET_MAX, FEET_MIN, ROOM_TOP, ROOM_W, SPOTS } from '../../render/cottage';
import { updateWeather } from '../../render/weather';
import { reserveTier } from '../../sim/body';
import { dayInfo } from '../../sim/calendar';
import { idx, present } from '../../sim/village';
import { frame } from '../../render/draw';
import { drawText, wrap } from '../../render/font';
import { isBoonDay, isWeekWorkDay } from '../../sim/obligations';
import type { Location } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';
import { talk } from '../talk';
import { ActionMenuScene } from './actionMenu';
import { DialogueScene } from './dialogue';
import { StatusScene } from './status';
import { TitleScene } from './title';

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
  cottage: [7, 0], green: [1, 2], fields: [4, 2], woods: [8, 2], churchyard: [4, 2], church: [4, 6], manor: [5, 2], town: [1, 2], camp: [1, 2],
};

/** First-day hints, in order; each is passed by doing what it says. */
export const HINTS = [
  'D-PAD: WALK. A: DO SOMETHING HERE',
  'EACH TASK TAKES A PART OF THE DAY',
  'START: SEE HOW YOU AND YOURS FARE',
  'AWAY, LIFE GOES ON BY HABIT. B: OK',
] as const;
/** Probe values per hint step, built once (no strings made per frame). */
const HINT_PROBE = [...HINTS.map((_, i) => String(i)), 'done'];

const PROMPT: Record<Location, string> = {
  home: 'A:HOME', green: 'A:GREEN', tavern: 'A:ALEHOUSE', strips: 'A:STRIPS', demesne: 'A:DEMESNE',
  church: 'A:CHURCH', woods: 'A:WOODS', stream: 'A:STREAM', manor: 'A:MANOR', barrow: 'A:BARROW', town: 'A:TOWN', camp: 'A:CAMP',
};
const LOCATION_TITLE: Record<Location, string> = {
  home: 'COTTAGE', green: 'VILLAGE GREEN', tavern: 'ALEHOUSE', strips: 'YOUR STRIPS', demesne: "LORD'S DEMESNE",
  church: 'CHURCH', woods: 'WOODS', stream: 'STREAM', manor: 'MANOR HALL', barrow: 'THE BARROW', town: 'THE TOWN', camp: 'OUTLAW CAMP',
};

interface NpcRt {
  def: Npc;
  actor: Actor;
  idle: Anim;
  walk: Anim;
  phase: number;
  /** Index of the villager this NPC stands for, or -1. */
  vIdx: number;
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
    setDayListener((day, sky, moon, season) => {
      probe('day', String(day));
      probe('weather', sky);
      probe('moon', String(moon));
      probe('season', season);
    });
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
    probe('scene', id);
    const sc = SCENES[id];
    this.x = col * TILE;
    // In a side room only the x matters: stand on the middle of the floor.
    this.y = sc.side ? ROOM_TOP + ((FEET_MIN + FEET_MAX) >> 1) - 16 : originY(sc) + row * TILE;
    this.npcs = sc.npcs.map((def, i) => {
      const idle = anim(`${def.who}.idle`);
      const walk = anim(`${def.who}.walk`);
      const a = mkActor(idle, def.x, originY(sc) + def.y, i * 331);
      if (def.who === 'blackDog') {
        a.eyeX = 11;
        a.eyeY = 11;
      }
      return { def, actor: a, idle, walk, phase: i * 1.7, vIdx: def.villager ? idx(def.villager) : -1 };
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

  /** Standing just below our own cottage door on the green? */
  private atHomeDoor(): boolean {
    const sc = this.scene;
    const col = (this.x + 8) >> 4;
    const row = (this.y + 12 - originY(sc)) >> 4;
    return tileAt(sc, col, row - 1)?.door?.to === 'cottage' || tileAt(sc, col, row)?.door?.to === 'cottage';
  }

  /** In a side room: the spot the peasant stands at (index into SPOTS), or -1. */
  private sideSpot(): number {
    const mid = this.x + 8;
    for (let i = 0; i < SPOTS.length; i++) if (mid >= SPOTS[i]!.x0 && mid < SPOTS[i]!.x1) return i;
    return -1;
  }

  private hotspot(): Location | null {
    if (this.scene.side) return this.sideSpot() >= 0 ? 'home' : null;
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
      // The line has ended: back to the title, where a new life can begin.
      if (g.sim().dead) return g.scenes.replace(new TitleScene(g));
      const npc = this.nearNpc();
      if (npc) {
        const t = talk(npc.def.talk!, g.sim(), npc.def.villager);
        g.scenes.push(new DialogueScene(g, t.speaker, t.pages), false);
        return;
      }
      const loc = this.hotspot();
      if (!loc) return g.sfx('error');
      g.sfx('confirm');
      g.advanceTutorial(0);
      g.scenes.push(new ActionMenuScene(g, loc, LOCATION_TITLE[loc], this.onMenuReport), false);
    } else if (e.action === 'start' && !e.repeat) {
      g.sfx('confirm');
      g.advanceTutorial(2);
      g.scenes.push(new StatusScene(g));
    } else if (e.action === 'cancel' && !e.repeat && g.tutorial() === 3) {
      g.sfx('confirm');
      g.advanceTutorial(3);
    }
  }

  /** Corner assist: blocked moving vertically, but an opening is a few pixels to one side? Ease toward it. */
  private slideX(dy: number): void {
    for (let k = 1; k <= 6; k++) {
      if (!this.blocked(this.x - k, this.y + dy)) {
        if (!this.blocked(this.x - 1, this.y)) this.x--;
        return;
      }
      if (!this.blocked(this.x + k, this.y + dy)) {
        if (!this.blocked(this.x + 1, this.y)) this.x++;
        return;
      }
    }
  }

  private slideY(dx: number): void {
    for (let k = 1; k <= 6; k++) {
      if (!this.blocked(this.x + dx, this.y - k)) {
        if (!this.blocked(this.x, this.y - 1)) this.y--;
        return;
      }
      if (!this.blocked(this.x + dx, this.y + k)) {
        if (!this.blocked(this.x, this.y + 1)) this.y++;
        return;
      }
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
    if (col < 0 || col >= colsOf(sc)) return false; // edges are handled as exits
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
    if (this.moving && this.scene.side) this.walkSide(dx, dy, dt, now);
    else if (this.moving) {
      this.stillSince = now;
      this.dir = dx < 0 ? 'west' : dx > 0 ? 'east' : dy < 0 ? 'up' : 'down';
      const sub = (dt * SPEED_SUB_Q8) >> 8;
      // Move a pixel at a time so collisions are exact.
      this.subX = dx === 0 ? 0 : this.subX + dx * sub;
      while (this.subX >= 16) {
        this.subX -= 16;
        if (!this.blocked(this.x + 1, this.y)) this.x++;
        else if (dy === 0) this.slideY(1);
      }
      while (this.subX <= -16) {
        this.subX += 16;
        if (!this.blocked(this.x - 1, this.y)) this.x--;
        else if (dy === 0) this.slideY(-1);
      }
      this.subY = dy === 0 ? 0 : this.subY + dy * sub;
      while (this.subY >= 16) {
        this.subY -= 16;
        if (!this.blocked(this.x, this.y + 1)) this.y++;
        else if (dx === 0) this.slideX(1);
      }
      while (this.subY <= -16) {
        this.subY += 16;
        if (!this.blocked(this.x, this.y - 1)) this.y--;
        else if (dx === 0) this.slideX(-1);
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
      const right = colsOf(sc) * TILE - 10;
      if (this.x < -6 || this.x > right) {
        const d: Dir = this.x < 0 ? 'west' : 'east';
        const to = sc.exits[d];
        if (to) {
          const row = Math.max(0, Math.min(SCENES[to].rows.length - 1, Math.round((this.y - oy) / TILE)));
          this.go(to, OPPOSITE[d] === 'west' ? 0 : colsOf(SCENES[to]) - 1, row);
        }
        if (this.x < -6) this.x = -6;
        if (this.x > right) this.x = right;
      }
      // Doors underfoot.
      const under = tileAt(sc, (this.x + 8) >> 4, (this.y + 12 - oy) >> 4);
      if (under?.door) {
        g.sfx('door');
        this.go(under.door.to, under.door.col, under.door.row);
      }
    }

    this.followFortune();
    this.updateActors(now);
    this.watchLog();
  }

  /** Walking in a side room: along the floor and a little into its depth; out through the door on the right. */
  private walkSide(dx: number, dy: number, dt: number, now: number): void {
    this.stillSince = now;
    this.dir = dx < 0 ? 'west' : dx > 0 ? 'east' : dy < 0 ? 'up' : 'down';
    const sub = (dt * SPEED_SUB_Q8) >> 8;
    this.subX = dx === 0 ? 0 : this.subX + dx * sub;
    while (this.subX >= 16) {
      this.subX -= 16;
      this.x++;
    }
    while (this.subX <= -16) {
      this.subX += 16;
      this.x--;
    }
    this.subY = dy === 0 ? 0 : this.subY + dy * sub;
    while (this.subY >= 32) {
      this.subY -= 32;
      this.y++;
    }
    while (this.subY <= -32) {
      this.subY += 32;
      this.y--;
    }
    const minY = ROOM_TOP + FEET_MIN - 16;
    const maxY = ROOM_TOP + FEET_MAX - 16;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;
    if (this.x < 2) this.x = 2;
    if (this.x > ROOM_W - 18) this.x = ROOM_W - 18;
    this.stepAcc += sub;
    if (this.stepAcc >= 12 * 16) {
      this.stepAcc = 0;
      this.game.sfx('step');
    }
    const exit = this.scene.side!.exit;
    if (dx > 0 && this.x >= DOOR_X) {
      this.game.sfx('door');
      this.go(exit.to, exit.col, exit.row);
    }
  }

  /** Flight, outlawry, capture: the sim moves the family; the world follows. */
  private followFortune(): void {
    if (this.fadeT >= 0) return;
    const r = this.game.sim().station.residence;
    const want: SceneId | null = r === 'town' ? 'town' : r === 'camp' ? 'camp' : null;
    if (want !== null && this.sceneId !== want) this.go(want, SPAWN[want][0], SPAWN[want][1]);
    else if (want === null && (this.sceneId === 'town' || this.sceneId === 'camp')) this.go('cottage', SPAWN.cottage[0], SPAWN.cottage[1]);
  }

  private bodyVariant(): number {
    const head = this.game.sim().members[0];
    if (!head) return 0;
    const b = head.body;
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
    if ((plan.action === 'workStrips' && id === 'fields') || ((plan.action === 'weekWork' || plan.action === 'hire') && id === 'manor') || (plan.action === 'gatherFirewood' && id === 'woods') || (plan.action === 'hire' && id === 'town') || (plan.action === 'poach' && (id === 'woods' || id === 'camp'))) return 'work';
    if (plan.action === 'sleep' && (id === 'camp' || id === 'town')) return 'sleep';
    if ((plan.action === 'pray' || plan.action === 'attendMass' || plan.action === 'confess') && id === 'church') return 'pray';
    if (plan.action === 'prayHome' && id === 'cottage') return 'pray';
    return 'idle';
  }

  private hasRole(role: string): boolean {
    const ms = this.game.sim().members;
    for (let i = 0; i < ms.length; i++) if (ms[i]!.role === role && ms[i]!.alive) return true;
    return false;
  }

  private updateActors(now: number): void {
    const s = this.game.sim();
    const pose = this.pose(now);
    const p = this.player;
    p.anim = PEASANT[this.bodyVariant()]![POSES.indexOf(pose)]!;
    if (pose === 'sleep') {
      // On the bed.
      p.x = BED_SLEEP.x;
      p.y = ROOM_TOP + BED_SLEEP.y;
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
        : w === 'spouse' ? this.hasRole('spouse')
        : w === 'children' ? this.hasRole('child')
        : true;
      if (n.vIdx >= 0 && !present(s.village[n.vIdx]!)) n.actor.visible = false;
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
    const spot = this.scene.side ? this.sideSpot() : -1;
    if (!this.scene.side && !near && !this.message && this.atHomeDoor()) {
      this.view.prompt = 'UP:HOME';
      return;
    }
    const label = spot >= 0 ? SPOTS[spot]!.label : this.scene.side && this.x > DOOR_X - 40 ? 'DOOR >' : loc ? PROMPT[loc] : '';
    this.view.prompt = s.dead ? 'THE LINE IS ENDED' : this.message || (near ? 'A:TALK' : label);
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

  /** Wrapped lines of the current hint, rebuilt only when the step changes. */
  private hintStep = -1;
  private hintLines: string[] = [];

  private drawHint(ctx: CanvasRenderingContext2D): void {
    const step = this.game.tutorial();
    probe('hint', HINT_PROBE[Math.min(step, HINTS.length)]!);
    if (step >= HINTS.length || this.game.scenes.top !== this) return;
    if (step !== this.hintStep) {
      this.hintStep = step;
      this.hintLines = wrap(HINTS[step]!, 18);
    }
    const h = 6 + this.hintLines.length * 9;
    // Under the title bar, kept to two lines: the floor where people stand stays in view.
    const y = 9;
    frame(ctx, 2, y, 156, h, C.parchment, C.night);
    for (let i = 0; i < this.hintLines.length; i++) drawText(ctx, this.hintLines[i]!, 7, y + 3 + i * 9, C.gold);
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    drawWorld(ctx, this.game.sim(), this.view, now);
    this.drawHint(ctx);
    if (this.fadeT >= 0) {
      const half = FADE_MS / 2;
      const a = this.fadeT < half ? this.fadeT / half : 1 - (this.fadeT - half) / half;
      ditherFill(ctx, Math.round(a * 4) / 4, C.black);
    }
  }
}

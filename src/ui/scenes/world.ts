import { LAYER_BIT, anim, hasAnim, spriteH, spriteId, type Anim } from '../../render/atlas';
import { INK, parchment, wipe } from '../../render/draw';
import { W } from '../../render/fb';
import { drawText, wrap } from '../../render/font';
import {
  GROUND_H, OPPOSITE, SCENES, SCENE_OF, SCENE_W, TERRAIN_OF, camFor, objAt, solidAt, terrainAt,
  type Dir, type Npc, type Obj, type SceneDef, type SceneId,
} from '../../render/scenes/maps';
import { drawWorld, roomMeta, setDayListener, type Actor, type RoomMeta, type WorldView } from '../../render/world';
import { updateWeather } from '../../render/weather';
import { icos, isin } from '../../render/trig';
import { BELT_TOOLS } from '../../save/schema';
import { reserveTier } from '../../sim/body';
import { dayInfo } from '../../sim/calendar';
import type { Member, SimState } from '../../sim/state';
import { idx, present } from '../../sim/village';
import { isBoonDay, isWeekWorkDay } from '../../sim/obligations';
import { DMG_UNLOCK_DAYS, type ActionId, type Location } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { probe } from '../probe';
import { talk } from '../talk';
import { workAnim, type WorkAnim } from '../work';
import { ActionMenuScene } from './actionMenu';
import { DialogueScene } from './dialogue';
import { QueueScene } from './queue';
import { StatusScene } from './status';
import { TitleScene } from './title';
import { WorkingScene } from './working';

/* ── feel ── */
const WALK = 62; // px per second
const RUN = 98;
/** Holding a direction this long breaks into a run. */
const RUN_AFTER_MS = 900;
const ACCEL = 520; // px/s²
const STOP = 1600; // px/s²: a short stop
/** Camera easing time constant (ms). */
const CAM_TAU = 140;
const WIPE_MS = 520;
/** Fixed-point scale for positions and speeds. */
const Q = 256;
const POSE_AFTER_MS = 700;
/** Feet box half-width and depth. */
const FOOT_W = 5;
const FOOT_D = 3;

/** First-day hints, in order; each is passed by doing what it says. */
export const HINTS = [
  'D-PAD: WALK. A: DO WHAT THE BUBBLE SAYS',
  'EACH TASK TAKES A PART OF THE DAY',
  'START: SEE HOW YOU AND YOURS FARE',
  'AWAY, LIFE GOES ON BY HABIT. B: OK',
] as const;
const HINT_PROBE = [...HINTS.map((_, i) => String(i)), 'done'];

const LOCATION_TITLE: Record<Location, string> = {
  home: 'THE COTTAGE', green: 'THE VILLAGE GREEN', tavern: 'THE ALEHOUSE', strips: 'YOUR STRIPS', demesne: "LORD'S DEMESNE",
  church: 'THE CHURCH', woods: 'THE WOODS', stream: 'THE STREAM', manor: 'THE MANOR HALL', barrow: 'THE BARROW', town: 'THE TOWN', camp: 'THE CAMP',
};

/** What can be done at each spot in a room (same order as the room's spots). */
const SPOTS: Record<'cottage' | 'church', readonly { title: string; verb: string; actions: readonly ActionId[] | null }[]> = {
  cottage: [
    { title: 'THE HEARTH', verb: 'A: COOK', actions: ['cook', 'brew', 'rest', 'eat'] },
    { title: 'THE TABLE', verb: 'A: EAT', actions: ['eat', 'rest'] },
    { title: 'THE BED', verb: 'A: SLEEP', actions: ['sleep', 'rest', 'prayHome'] },
  ],
  church: [
    { title: 'THE PEWS', verb: 'A: PRAY', actions: null },
    { title: 'THE ALTAR', verb: 'A: CONFESS', actions: null },
  ],
};

/** Verbs for the prompts, built once. */
const PROMPTS = new Map<string, string>();
const promptOf = (verb: string): string => {
  let p = PROMPTS.get(verb);
  if (!p) PROMPTS.set(verb, (p = `A: ${verb}`));
  return p;
};

type Face = 'down' | 'up' | 'left' | 'right';
const MOVES = ['walk', 'run', 'idle'] as const;
const FACES = ['down', 'up', 'side'] as const;
const WORKS: readonly WorkAnim[] = ['chop', 'split', 'hoe', 'reap', 'flail', 'sow', 'carry', 'stir', 'milk', 'pray', 'eat', 'sleep'];

interface NpcRt {
  def: Npc;
  actor: Actor;
  idle: Anim;
  walk: Anim;
  phase: number;
  vIdx: number;
  lastX: number;
}

interface Kin {
  member: string;
  actor: Actor;
  idle: Anim;
  walk: Anim;
  home: number;
  phase: number;
}

const mkActor = (a: Anim, x: number, y: number, offset: number): Actor => ({ anim: a, x, y, flip: false, layers: 0, offset, visible: true, eyes: false });

/** The sprite set for a household member: by role, sex and age. */
function kinSprite(m: Member, day: number): string | null {
  const age = (day - m.bornDay) / 365;
  if (m.role === 'peasant') return null;
  if (age < 2) return null; // in the cradle
  if (age < 13) return 'child';
  if (m.role === 'parent') return m.sex === 'm' ? 'elder' : 'goodwife';
  if (m.role === 'spouse') return m.sex === 'f' ? 'wife' : 'shepherd';
  return m.sex === 'f' ? 'maid' : 'shepherd';
}

export class WorldScene implements Scene {
  readonly opaque = true;
  private sceneId: SceneId;
  /** Feet position and velocity, in 1/256 px and 1/256 px per second (integers). */
  private fx = 0;
  private fy = 0;
  private vx = 0;
  private vy = 0;
  private get x(): number {
    return this.fx >> 8;
  }
  private set x(v: number) {
    this.fx = (v * Q) | 0;
  }
  private get y(): number {
    return this.fy >> 8;
  }
  private set y(v: number) {
    this.fy = (v * Q) | 0;
  }
  private face: Face = 'down';
  private heldSince = 0;
  private moving = false;
  private stillSince = 0;
  private stepAcc = 0;
  /** Camera x in 1/256 px. */
  private camQ = 0;
  /** Wipe progress (ms), -1 when idle; the scene changes at the half. */
  private wipeT = -1;
  private pending: { to: SceneId; x: number; y: number } | null = null;
  private player: Actor;
  private npcs: NpcRt[] = [];
  private kin: Kin[] = [];
  private kinKey = '';
  private pens: { kind: string; actor: Actor; i: number }[] = [];
  private messageUntil = 0;
  private logSeen = 0;
  private view: WorldView;
  private room: RoomMeta | null = null;
  /** A cosmetic chore (milking) playing until this frame time. */
  private choreUntil = 0;
  private chore: WorkAnim | null = null;
  private eatUntil = 0;
  private needsAt = 0;
  /** The calendar for the day shown (worked out when the day changes). */
  private infoDay = -1;
  private info: ReturnType<typeof dayInfo> | null = null;
  private anims: Record<string, Anim> = {};
  /** [walk, run, idle] x [down, up, side], looked up by index (no strings while playing). */
  private moveAnims: Anim[] = [];

  constructor(private game: Game) {
    setDayListener((d) => {
      probe('day', String(d.day));
      probe('weather', d.weather.sky);
      probe('moon', String(d.moon));
      probe('season', d.season);
      probe('snow', String(d.snow));
    });
    for (const m of MOVES) for (const f of FACES) this.anims[`${m}.${f}`] = anim(`peasant.${m}.${f}`);
    this.moveAnims = MOVES.flatMap((m) => FACES.map((f) => this.anims[`${m}.${f}`]!));
    for (const w of WORKS) this.anims[w] = anim(`peasant.${w}`);
    const s = game.sim();
    this.sceneId = SCENE_OF[s.location];
    this.player = mkActor(this.anims['idle.down']!, 0, 0, 0);
    this.player.glow = true;
    this.view = { scene: SCENES[this.sceneId], cam: 0, actors: [], prompt: '', promptX: 0, promptY: 0, needs: [], belt: 'axe', queued: 0, message: '' };
    const sp = this.scene.spawn;
    this.load(this.sceneId, sp[0], this.scene.room ? this.roomFeetMid(this.sceneId) : sp[1]);
    this.camQ = this.camTarget() * Q;
    this.logSeen = s.log.length;
  }

  private get scene(): SceneDef {
    return SCENES[this.sceneId];
  }

  private roomFeetMid(id: SceneId): number {
    const m = roomMeta(SCENES[id].room!);
    return ((m.floor + 18 + m.h - 8) >> 1);
  }

  /** Enter a scene with the player's feet at (x, y). */
  private load(id: SceneId, x: number, y: number): void {
    this.sceneId = id;
    probe('scene', id);
    const sc = SCENES[id];
    this.room = sc.room ? roomMeta(sc.room) : null;
    this.x = x;
    this.y = y;
    this.vx = this.vy = 0;
    if (!this.room) this.unstick();
    this.npcs = sc.npcs.map((def, i) => {
      const idle = anim(`${def.who}.idle${def.who === 'dog' ? '' : '.down'}`);
      const walk = anim(`${def.who}.walk${def.who === 'dog' ? '' : '.side'}`);
      const y0 = this.room ? this.roomFeetMid(id) - 6 + ((i * 13) % 20) : def.y;
      const a = mkActor(idle, def.x, y0, i * 331);
      a.eyes = def.who === 'dog';
      return { def, actor: a, idle, walk, phase: i * 70, vIdx: def.villager ? idx(def.villager) : -1, lastX: def.x };
    });
    this.pens = [];
    for (const p of sc.pens ?? []) {
      const n = p.kind === 'hen' ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const a = mkActor(anim(`${p.kind}.idle`), p.x + i * 12, p.y + (i % 2) * 6, i * 177);
        a.flip = i % 2 === 1;
        this.pens.push({ kind: p.kind, actor: a, i });
      }
    }
    this.kinKey = '';
    this.kin = [];
    this.syncKin(this.game.sim());
    this.view.scene = sc;
    this.rebuildActors();
  }

  private rebuildActors(): void {
    this.view.actors = [this.player, ...this.npcs.map((n) => n.actor), ...this.pens.map((p) => p.actor), ...this.kin.map((k) => k.actor)];
  }

  /** The household in the cottage, from the sim's members (rebuilt only when the household changes). */
  private syncKin(s: SimState): void {
    if (this.sceneId !== 'cottage') {
      if (this.kin.length) {
        this.kin = [];
        this.rebuildActors();
      }
      return;
    }
    const day = (s.block / 6) | 0;
    let key = '';
    for (const m of s.members) if (m.alive && m.role !== 'peasant') key += `${m.id}:${kinSprite(m, day)};`;
    if (key === this.kinKey) return;
    this.kinKey = key;
    const mid = this.roomFeetMid('cottage');
    this.kin = [];
    let n = 0;
    for (const m of s.members) {
      if (!m.alive || m.role === 'peasant') continue;
      const who = kinSprite(m, day);
      if (!who) continue;
      const homeX = 120 + ((n * 61) % 200);
      const a = mkActor(anim(`${who}.idle.down`), homeX, mid - 8 + ((n * 11) % 22), n * 97);
      this.kin.push({ member: m.id, actor: a, idle: a.anim, walk: anim(`${who}.walk.side`), home: homeX, phase: n * 94 });
      n++;
    }
    this.rebuildActors();
  }

  /** Nudges the feet off anything solid (arriving at an edge or a door). */
  private unstick(): void {
    if (!this.footBlocked(this.x, this.y)) return;
    for (let r = 2; r < 80; r += 2)
      for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0]] as const)
        if (!this.footBlocked(this.x + dx, this.y + dy) && this.y + dy < GROUND_H - 2) {
          this.x += dx;
          this.y += dy;
          return;
        }
  }

  private footBlocked(x: number, y: number): boolean {
    const sc = this.scene;
    x = Math.round(x);
    y = Math.round(y);
    return solidAt(sc, x - FOOT_W, y) || solidAt(sc, x + FOOT_W, y) || solidAt(sc, x - FOOT_W, y - FOOT_D) || solidAt(sc, x + FOOT_W, y - FOOT_D);
  }

  private go(to: SceneId, x: number, y: number): void {
    if (this.wipeT >= 0) return;
    this.pending = { to, x, y };
    this.wipeT = 0;
  }

  private readonly onMenuReport = (m: string): void => {
    this.say(m);
    if (/^EAT/.test(m)) {
      this.eatUntil = this.game.frameNow() + 2400;
      this.game.sfx('eat');
    }
  };

  say(text: string): void {
    this.view.message = text.slice(0, 28);
    this.messageUntil = this.game.frameNow() + 2600;
  }

  /* ── what is in reach ── */

  /** The point just in front of the feet. */
  private frontX(): number {
    return this.x + (this.face === 'left' ? -12 : this.face === 'right' ? 12 : 0);
  }
  private frontY(): number {
    return this.y + (this.face === 'up' ? -12 : this.face === 'down' ? 8 : -2);
  }

  private nearNpc(): NpcRt | null {
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i]!;
      if (!n.actor.visible || !n.def.talk) continue;
      if (Math.abs(n.actor.x - this.x) < 20 && Math.abs(n.actor.y - this.y) < 14) return n;
    }
    return null;
  }

  private nearKin(): Kin | null {
    for (let i = 0; i < this.kin.length; i++) {
      const k = this.kin[i]!;
      if (k.actor.visible && Math.abs(k.actor.x - this.x) < 20 && Math.abs(k.actor.y - this.y) < 14) return k;
    }
    return null;
  }

  /** In a room: the spot the feet stand at (index into the room's spots), or -1. */
  private roomSpot(): number {
    const m = this.room;
    if (!m) return -1;
    for (let i = 0; i < m.spots.length; i++) if (this.x >= m.spots[i]!.x0 && this.x < m.spots[i]!.x1) return i;
    return -1;
  }

  private target(): Obj | null {
    const sc = this.scene;
    return objAt(sc, this.frontX(), this.frontY(), 6) ?? objAt(sc, this.x, this.y, 4);
  }

  /** Family strip (0..2) or the lord's demesne (3) under the feet, or -1. */
  private fieldUnder(): number {
    const ch = terrainAt(this.scene, Math.round(this.x) >> 4, Math.round(this.y - 1) >> 4);
    return ch >= '1' && ch <= '3' ? ch.charCodeAt(0) - 49 : ch === 'd' ? 3 : -1;
  }

  private waterAhead(): boolean {
    return TERRAIN_OF[terrainAt(this.scene, Math.round(this.frontX()) >> 4, Math.round(this.frontY() + 4) >> 4)] === 'water';
  }

  private nearCow(): boolean {
    if (this.sceneId !== 'fields' || this.game.sim().wealth.cow < 1) return false;
    for (const p of this.pens) if (p.kind === 'cow' && p.actor.visible && Math.abs(p.actor.x - this.x) < 26 && Math.abs(p.actor.y - this.y) < 14) return true;
    return false;
  }

  /* ── input ── */

  onAction(e: ActionEvent): void {
    if (this.wipeT >= 0) return;
    const g = this.game;
    if (e.action === 'confirm' && !e.repeat) {
      if (g.sim().dead) return g.scenes.replace(new TitleScene(g));
      const npc = this.nearNpc();
      if (npc) {
        const t = talk(npc.def.talk!, g.sim(), npc.def.villager);
        g.scenes.push(new DialogueScene(g, t.speaker, t.pages), false);
        return;
      }
      const kin = this.nearKin();
      if (kin && this.roomSpot() < 0) {
        const t = talk('family', g.sim());
        g.scenes.push(new DialogueScene(g, t.speaker, t.pages), false);
        return;
      }
      if (this.nearCow()) {
        g.sfx('confirm');
        this.chore = 'milk';
        this.choreUntil = g.frameNow() + 2400;
        this.say('MILKING THE COW');
        return;
      }
      g.advanceTutorial(0);
      // In a room: the spot's own menu.
      const spot = this.roomSpot();
      if (this.room && spot >= 0) {
        const sp = SPOTS[this.scene.room!][spot]!;
        g.sfx('confirm');
        g.scenes.push(new ActionMenuScene(g, this.scene.ambient!, sp.title, this.onMenuReport, sp.actions), false);
        return;
      }
      if (this.room) return g.sfx('error');
      const o = this.target();
      if (o?.door && o.home) {
        g.sfx('door');
        return this.enterDoor(o);
      }
      const field = this.fieldUnder();
      const loc: Location | null = o?.hot ?? (field === 3 ? 'demesne' : field >= 0 ? 'strips' : this.waterAhead() ? 'stream' : this.scene.ambient ?? null);
      if (!loc) return g.sfx('error');
      g.sfx('confirm');
      g.scenes.push(new ActionMenuScene(g, loc, LOCATION_TITLE[loc], this.onMenuReport), false);
    } else if (e.action === 'start') {
      g.sfx('confirm');
      g.advanceTutorial(2);
      g.scenes.push(new StatusScene(g));
    } else if (e.action === 'cancel' && !e.repeat && g.tutorial() === 3) {
      g.sfx('confirm');
      g.advanceTutorial(3);
    } else if (e.action === 'belt' && !e.repeat) {
      const i = BELT_TOOLS.indexOf(g.save.data.belt);
      g.setBelt(BELT_TOOLS[(i + 1) % BELT_TOOLS.length]!);
      g.sfx('move');
      this.say(`BELT: ${g.save.data.belt.toUpperCase()}`);
    } else if (e.action === 'queue' && !e.repeat) {
      g.sfx('confirm');
      g.scenes.push(new QueueScene(g), false);
    }
  }

  /** QA: where the peasant stands. */
  where(): { scene: SceneId; x: number; y: number } {
    return { scene: this.sceneId, x: this.x, y: this.y };
  }

  /** QA and debug: stand in a scene at once (no wipe). */
  teleport(id: SceneId, x: number, y: number, face: Face = 'down'): void {
    const sc = SCENES[id];
    this.load(id, x, sc.room ? this.roomFeetMid(id) : y);
    this.face = face;
    this.camQ = this.camTarget() * Q;
    this.view.cam = this.camQ >> 8;
  }

  private enterDoor(o: Obj): void {
    const to = o.door!.to;
    const m = roomMeta(SCENES[to].room!);
    const inX = to === 'cottage' ? m.door.x - 14 : m.door.x + m.door.w + 14;
    this.go(to, inX, this.roomFeetMid(to));
  }

  /* ── the frame ── */

  update(dt: number, now: number): void {
    const g = this.game;
    updateWeather(dt);
    if (this.wipeT >= 0) {
      const before = this.wipeT;
      this.wipeT += dt;
      if (before < WIPE_MS / 2 && this.wipeT >= WIPE_MS / 2 && this.pending) {
        this.load(this.pending.to, this.pending.x, this.pending.y);
        this.camQ = this.camTarget() * Q;
        this.pending = null;
      }
      if (this.wipeT >= WIPE_MS) this.wipeT = -1;
    }

    // Held directions: accelerate toward walking (or running) speed; let go and stop short.
    // Positions, speeds and the camera are kept in 1/256 px (integers): nothing is boxed in the frame loop.
    const inp = g.input;
    let ix = 0;
    let iy = 0;
    const free = this.wipeT < 0 && g.scenes.top === this && !g.sim().dead && now >= this.choreUntil;
    if (free) {
      if (inp.isHeld('left')) ix -= 1;
      if (inp.isHeld('right')) ix += 1;
      if (inp.isHeld('up')) iy -= 1;
      if (inp.isHeld('down')) iy += 1;
    }
    const want = ix !== 0 || iy !== 0;
    if (!want) this.heldSince = now;
    const top = (now - this.heldSince > RUN_AFTER_MS ? RUN : WALK) * Q;
    const diag = ix !== 0 && iy !== 0;
    const tx = diag ? ((ix * top * 181) >> 8) : ix * top;
    let ty = diag ? ((iy * top * 181) >> 8) : iy * top;
    if (this.room) ty = (ty * 140) >> 8;
    const acc = ((ACCEL * Q * dt) / 1000) | 0;
    const stop = ((STOP * Q * dt) / 1000) | 0;
    this.vx = approach(this.vx, tx, ix !== 0 && (ix > 0) === (this.vx > 0) ? acc : this.vx === 0 ? acc : stop);
    this.vy = approach(this.vy, ty, iy !== 0 && (iy > 0) === (this.vy > 0) ? acc : this.vy === 0 ? acc : stop);
    if (want) {
      this.face = ix !== 0 && (iy === 0 || this.face === 'left' || this.face === 'right') ? (ix < 0 ? 'left' : 'right') : iy < 0 ? 'up' : 'down';
      this.stillSince = now;
      if (this.chore && now >= this.choreUntil) this.chore = null;
    }
    const speed = (this.vx < 0 ? -this.vx : this.vx) + (this.vy < 0 ? -this.vy : this.vy);
    this.moving = speed > 4 * Q;
    if (this.moving) {
      const dx = ((this.vx * dt) / 1000) | 0;
      const dy = ((this.vy * dt) / 1000) | 0;
      if (this.room) this.walkRoom(dx, dy);
      else this.walkGround(dx, dy, ix, iy);
      this.stepAcc += ((speed * dt) / 1000) | 0;
      if (this.stepAcc >= 13 * Q) {
        this.stepAcc = 0;
        g.sfx('step');
      }
    }

    // The camera eases after the peasant, a little ahead of where they are going.
    const k = dt >= CAM_TAU * 3 ? 256 : ((dt * 256) / (CAM_TAU + dt)) | 0;
    this.camQ += (((this.camTarget() * Q - this.camQ) * k) / 256) | 0;
    this.view.cam = this.camQ >> 8;

    this.followFortune();
    this.runQueue();
    this.updateActors(now);
    this.watchLog();
    this.checkUnlock();
  }

  private camTarget(): number {
    const lead = ((this.vx * 90) >> 16) | 0;
    return camFor(this.scene, this.x + lead, this.room?.w ?? 384) | 0;
  }

  private walkGround(dx: number, dy: number, ix: number, iy: number): void {
    const sc = this.scene;
    const nx = this.fx + dx;
    if (!this.footBlocked(nx >> 8, this.y)) this.fx = nx;
    else {
      this.vx = 0;
      // Corner assist: blocked sideways but an opening is a few pixels up or down? Ease toward it.
      if (iy === 0 && ix !== 0) for (let d = 1; d <= 7; d++) {
        if (!this.footBlocked(nx >> 8, this.y - d)) { this.fy -= 200; break; }
        if (!this.footBlocked(nx >> 8, this.y + d)) { this.fy += 200; break; }
      }
    }
    const ny = this.fy + dy;
    // Walking up into a door goes in.
    if (this.vy < 0) {
      const x = this.x, y = this.y, nyp = ny >> 8;
      for (let i = 0; i < sc.objs.length; i++) {
        const o = sc.objs[i]!;
        if (o.door && x >= o.x + o.door.x0 && x <= o.x + o.door.x1 && nyp <= o.y + 3 && y > o.y - 2) {
          this.game.sfx('door');
          return this.enterDoor(o);
        }
      }
    }
    if (!this.footBlocked(this.x, ny >> 8)) this.fy = ny;
    else {
      this.vy = 0;
      if (ix === 0 && iy !== 0) for (let d = 1; d <= 7; d++) {
        if (!this.footBlocked(this.x - d, ny >> 8)) { this.fx -= 200; break; }
        if (!this.footBlocked(this.x + d, ny >> 8)) { this.fx += 200; break; }
      }
    }
    // Edges: walk off into the next scene, or stop.
    const x = this.x;
    if (x < 2 || x > SCENE_W - 2) {
      const d: Dir = x < 2 ? 'west' : 'east';
      const to = sc.exits[d];
      if (to) this.go(to, OPPOSITE[d] === 'west' ? 10 : SCENE_W - 10, this.y);
      this.x = x < 2 ? 2 : SCENE_W - 2;
      this.vx = 0;
    }
  }

  private walkRoom(dx: number, dy: number): void {
    const m = this.room!;
    this.fx += dx;
    this.fy += dy;
    const minY = m.floor + 18, maxY = m.h - 6;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;
    const out = this.scene.out!;
    // Out through the door (on the right of the cottage, the left of the church).
    const doorRight = m.door.x > m.w / 2;
    if (doorRight ? this.vx > 0 && this.x > m.door.x + 8 : this.vx < 0 && this.x < m.door.x + m.door.w - 8) {
      this.game.sfx('door');
      this.go(out.to, out.x, out.y);
    }
    if (this.x < 8) this.x = 8;
    if (this.x > m.w - 8) this.x = m.w - 8;
  }

  /** Flight, outlawry, capture: the sim moves the family; the world follows. */
  private followFortune(): void {
    if (this.wipeT >= 0) return;
    const r = this.game.sim().station.residence;
    const want: SceneId | null = r === 'town' ? 'town' : r === 'camp' ? 'camp' : null;
    if (want !== null && this.sceneId !== want) this.go(want, SCENES[want].spawn[0], SCENES[want].spawn[1]);
    else if (want === null && (this.sceneId === 'town' || this.sceneId === 'camp')) this.go('cottage', SCENES.cottage.spawn[0], this.roomFeetMid('cottage'));
  }

  /** Tasks queued with R start, one by one, as each ends. */
  private runQueue(): void {
    const g = this.game;
    const q = g.save.data.queue;
    if (!q.length || g.scenes.top !== this || this.wipeT >= 0) return;
    const s = g.sim();
    if (s.dead || (s.plan && s.block < s.plan.until)) return;
    const next = q[0]!;
    g.setQueue(q.slice(1));
    const r = g.act(next.action, next.param);
    if (!r.ok) {
      this.say(r.message.slice(0, 28));
      g.sfx('error');
      return;
    }
    this.say(`NEXT: ${r.message || next.action.toUpperCase()}`);
    // The peasant goes where the task is done.
    const where = SCENE_OF[g.sim().location];
    if (where !== this.sceneId) {
      const sc = SCENES[where];
      this.go(where, sc.spawn[0], sc.room ? this.roomFeetMid(where) : sc.spawn[1]);
    }
    g.scenes.push(new WorkingScene(g, next.action), false);
  }

  /** DMG mode is earned by keeping a life going. */
  private checkUnlock(): void {
    const g = this.game;
    if (g.save.data.dmgUnlocked || g.sim().block < DMG_UNLOCK_DAYS * 6) return;
    g.save.data = { ...g.save.data, dmgUnlocked: true };
    void g.save.save(g.now());
    this.say('DMG MODE EARNED (SETTINGS)');
  }

  private layersOf(m: Member | undefined, work: boolean): number {
    if (!m) return 0;
    const b = m.body;
    const tier = reserveTier(b.reserve);
    let bits = tier === 'skeletal' ? LAYER_BIT.skeletal : tier === 'gaunt' ? LAYER_BIT.gaunt : tier === 'healthy' ? LAYER_BIT.girth1 : tier === 'stout' ? LAYER_BIT.girth1 | LAYER_BIT.girth2 : 0;
    if (b.illness) bits |= LAYER_BIT.sick;
    if (b.warmth < 30) bits |= LAYER_BIT.cold;
    if (work) bits |= LAYER_BIT.tool;
    return bits;
  }

  /** The work going on here now (the plan in hand, if it belongs in this scene), as an animation. */
  private workHere(now: number): WorkAnim | null {
    if (this.chore && now < this.choreUntil) return this.chore;
    if (now < this.eatUntil) return 'eat';
    if (this.moving || now - this.stillSince < POSE_AFTER_MS) return null;
    const s = this.game.sim();
    const plan = s.plan && s.block >= s.plan.from && s.block < s.plan.until ? s.plan : null;
    if (!plan) return null;
    if (SCENE_OF[s.location] !== this.sceneId && !(plan.action === 'hire' && this.sceneId === 'town')) return null;
    const f = this.fieldUnder();
    const field = f >= 0 && f < 3 ? s.fields[f] ?? null : null;
    return workAnim(plan.action, this.game.save.data.belt, field, ((now / 4000) | 0) % 2 === 1);
  }

  private updateActors(now: number): void {
    const s = this.game.sim();
    const p = this.player;
    const head = s.members[0];
    const work = this.workHere(now);
    if (work === 'sleep' && this.room?.bed) {
      p.anim = this.anims.sleep!;
      p.x = this.room.bed.x + 16;
      p.y = this.room.bed.y + 2;
      p.flip = false;
    } else {
      const speed = (this.vx < 0 ? -this.vx : this.vx) + (this.vy < 0 ? -this.vy : this.vy);
      const move = this.moving ? (speed > (WALK + 6) * Q ? 1 : 0) : 2;
      const dir = this.face === 'left' || this.face === 'right' ? 2 : this.face === 'up' ? 1 : 0;
      p.anim = work ? this.anims[work]! : this.moveAnims[move * 3 + dir]!;
      p.flip = this.face === 'left';
      p.x = this.x;
      p.y = this.y;
    }
    p.layers = this.layersOf(head, work !== null && work !== 'pray' && work !== 'sleep');
    p.visible = !s.dead;

    const day = (s.block / 6) | 0;
    const bod = s.block % 6;
    if (day !== this.infoDay) {
      this.infoDay = day;
      this.info = dayInfo(day);
    }
    const info = this.info!;
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
        : true;
      if (n.vIdx >= 0 && !present(s.village[n.vIdx]!)) n.actor.visible = false;
      const range = n.def.wander ?? 0;
      if (range > 0) {
        // A slow sway along the path: one step of 256 every 64 ms (a 16 s round).
        const t = (now >> 6) + n.phase;
        const nx = n.def.x + ((isin(t) * range) >> 10);
        const c = icos(t);
        const walking = c > 358 || c < -358;
        n.actor.anim = walking ? n.walk : n.idle;
        n.actor.flip = walking && nx < n.lastX;
        n.lastX = nx;
        n.actor.x = nx;
      }
    }
    const asleep = bod === 5 || bod === 0;
    for (let i = 0; i < this.kin.length; i++) {
      const k = this.kin[i]!;
      const t = ((now * 5) >> 9) + k.phase;
      const nx = k.home + ((isin(t) * 26) >> 10);
      const c = icos(t);
      const walking = c > 410 || c < -410;
      k.actor.anim = walking ? k.walk : k.idle;
      k.actor.flip = walking && c < 0;
      k.actor.x = nx;
      k.actor.visible = !(asleep && i === 0 && work === 'sleep'); // the spouse sleeps too
    }
    const wl = s.wealth;
    for (let i = 0; i < this.pens.length; i++) {
      const pe = this.pens[i]!;
      const owned = pe.kind === 'hen' ? wl.hens : pe.kind === 'pig' ? wl.pig : pe.kind === 'cow' ? wl.cow : wl.ox;
      pe.actor.visible = pe.i < owned;
    }

    // Needs that want seeing to, pulsing in the HUD (checked twice a second).
    if (now >= this.needsAt) {
      this.needsAt = now + 500;
      this.syncKin(s);
      const n = this.view.needs;
      n.length = 0;
      if (head) {
        const b = head.body;
        if (b.hunger > 60) n.push('bread');
        if (b.warmth < 35) n.push('hearth');
        if (b.fatigue > 70) n.push('bed');
        if (b.illness) n.push('prayer');
      }
      if (s.wealth.firewood <= 0) n.push('firewood');
      this.view.belt = this.game.save.data.belt;
      this.view.queued = this.game.save.data.queue.length;
      probe('prompt', this.view.prompt);
    }

    if (now > this.messageUntil) this.view.message = '';
    this.updatePrompt(s, work);
  }

  /** The floating prompt: what A does, above the thing it does it to. */
  private updatePrompt(s: SimState, work: WorkAnim | null): void {
    const v = this.view;
    v.prompt = '';
    if (s.dead) {
      v.prompt = 'THE LINE IS ENDED';
      v.promptX = this.x;
      v.promptY = this.y - 34;
      return;
    }
    if (this.moving && this.wipeT >= 0) return;
    if (work === 'sleep') return;
    const headY = this.y - 34;
    const npc = this.nearNpc();
    if (npc) {
      v.prompt = 'A: TALK';
      v.promptX = npc.actor.x;
      v.promptY = npc.actor.y - 34;
      return;
    }
    if (this.room) {
      const spot = this.roomSpot();
      const m = this.room;
      const doorRight = m.door.x > m.w / 2;
      if (doorRight ? this.x > m.door.x - 30 : this.x < m.door.x + m.door.w + 30) {
        v.prompt = doorRight ? 'OUT >' : '< OUT';
        v.promptX = m.door.x + (m.door.w >> 1);
        v.promptY = m.floor - 30;
        return;
      }
      if (this.nearKin()) {
        v.prompt = 'A: TALK';
        v.promptX = this.x;
        v.promptY = headY;
        if (spot < 0) return;
      }
      if (spot >= 0) {
        v.prompt = SPOTS[this.scene.room!][spot]!.verb;
        v.promptX = this.x;
        v.promptY = headY;
      }
      return;
    }
    if (this.nearCow()) {
      v.prompt = 'A: MILK';
      v.promptX = this.x;
      v.promptY = headY;
      return;
    }
    const o = this.target();
    if (o) {
      v.prompt = o.home ? 'UP: HOME' : promptOf(o.verb ?? 'LOOK');
      const id = o.s;
      v.promptX = o.home ? o.x + ((o.door!.x0 + o.door!.x1) >> 1) : o.x + (o.foot ? (o.foot[0] + o.foot[1]) >> 1 : 8);
      v.promptY = o.home ? o.y - 20 : o.y - this.objH(id);
      return;
    }
    const f = this.fieldUnder();
    if (f >= 0) {
      v.prompt = f === 3 ? 'A: WORK' : this.fieldPrompt(s, f);
      v.promptX = this.x;
      v.promptY = headY;
      return;
    }
    if (this.waterAhead()) {
      v.prompt = 'A: WASH';
      v.promptX = this.frontX();
      v.promptY = this.y - 8;
    }
  }

  private objHeights = new Map<string, number>();
  private objH(name: string): number {
    let h = this.objHeights.get(name);
    if (h === undefined) {
      h = spriteH(hasAnim(name) ? anim(name).frames[0]! : spriteId(name));
      this.objHeights.set(name, h);
    }
    return h;
  }

  private fieldPrompt(s: SimState, n: number): string {
    const f = s.fields[n];
    if (!f || f.acres === 0) return 'NOT YOUR STRIP';
    return f.stage === 'unsown' ? 'A: SOW' : f.stage === 'growing' ? 'A: WEED' : f.stage === 'ripe' ? 'A: REAP' : f.stage === 'harvested' ? 'A: THRESH' : 'A: STRIPS';
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

  private hintStep = -1;
  private hintLines: string[] = [];

  private drawHint(): void {
    const step = this.game.tutorial();
    probe('hint', HINT_PROBE[Math.min(step, HINTS.length)]!);
    if (step >= HINTS.length || this.game.scenes.top !== this) return;
    if (step !== this.hintStep) {
      this.hintStep = step;
      this.hintLines = wrap(HINTS[step]!, 28);
    }
    const h = 16 + this.hintLines.length * 11;
    parchment(8, 4, W - 16, h);
    for (let i = 0; i < this.hintLines.length; i++) drawText(this.hintLines[i]!, 18, 12 + i * 11, INK.title);
  }

  draw(now: number): void {
    drawWorld(this.game.sim(), this.view, now, this.game.now);
    this.drawHint();
    if (this.wipeT >= 0) wipe((this.wipeT / WIPE_MS) * 2);
  }
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return v + step > target ? target : v + step;
  return v - step < target ? target : v - step;
}

import { anim, blit, frameAt, spriteId } from '../../render/atlas';
import { darkPanel, rect } from '../../render/draw';
import { H, W, addLight, finishWorld, resetLight } from '../../render/fb';
import { drawTextCentered } from '../../render/font';
import { C } from '../../render/palette';
import { drawSky } from '../../render/sky';
import { TITLE_BLINK_MS } from '../../sim/balance';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import type { Scene } from '../scene';
import { SettingsScene } from './settings';
import { ParchmentLogScene } from './parchmentLog';
import { NameEntryScene } from './onboarding';
import { WorldScene } from './world';

const HORIZON = 132;

/** The title: a cottage under the moon, its window and fire the only warm things in the dark. */
export class TitleScene implements Scene {
  readonly opaque = true;
  private ids = {
    cottage: spriteId('o.cottage.lit'), tree: spriteId('o.tree'), pine: spriteId('o.pine'), well: spriteId('o.well'),
    grass: [0, 1, 2, 3].map((v) => spriteId(`t.grass.${v}`)), path: spriteId('t.path.1'),
  };
  private fire = anim('fire.camp');
  private endedText = '';

  constructor(private game: Game) {}

  enter(): void {
    const s = this.game.sim();
    this.endedText = s.dead && this.game.save.data.onboarded ? `THE ${s.familyName} LINE IS ENDED`.slice(0, 30) : '';
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'start' || e.action === 'confirm') {
      const g = this.game;
      g.sfx('start');
      // A new life (or one after the line has ended) begins by naming the peasant.
      if (!g.save.data.onboarded || g.sim().dead) return g.scenes.replace(new NameEntryScene(g));
      g.scenes.replace(new WorldScene(g));
      // Returning after time away: the Parchment Log tells what happened.
      const seen = g.save.data.seenBlock;
      if (g.sim().block > seen) g.scenes.push(new ParchmentLogScene(g, seen, g.sim().block), false);
    } else if (e.action === 'select') {
      this.game.sfx('confirm');
      this.game.scenes.push(new SettingsScene(this.game));
    }
  }

  draw(now: number): void {
    const k = this.ids;
    resetLight();
    drawSky(5, 'fair', 4, now / 400, 0.2, now, HORIZON);
    for (let y = HORIZON; y < H; y += 16) for (let x = 0; x < W; x += 16) blit(k.grass[((x * 7 + y * 13) >> 4) & 3]!, x, y);
    for (let x = 112; x < 144; x += 16) for (let y = 160; y < H; y += 16) blit(k.path, x, y);
    blit(k.pine, 6, HORIZON - 40);
    blit(k.tree, 30, HORIZON - 30);
    blit(k.tree, 214, HORIZON - 34);
    blit(k.pine, 190, HORIZON - 44);
    blit(k.cottage, 96, HORIZON - 30);
    blit(k.well, 30, HORIZON + 30);
    // A fire by the door, and the window.
    blit(frameAt(this.fire, now), 150, HORIZON + 38);
    addLight(158, HORIZON + 46, 58 + ((now >> 7) % 3), 15, true, 0.7);
    addLight(142, HORIZON + 11, 34, 13, true, 0.7);
    finishWorld('autumn', false, 5, 0, H, 8);

    darkPanel(18, 10, W - 36, 50);
    drawTextCentered("PEASANT'S LIFE", 20, C.gold, W, 0, C.gore0);
    drawTextCentered('ANNO DOMINI 1345', 38, C.blood, W, 0, C.black);
    if (this.endedText) drawTextCentered(this.endedText, 66, C.mist, W, 0, C.black);
    const ended = !!this.endedText || !this.game.save.data.onboarded;
    if (Math.floor(now / TITLE_BLINK_MS) % 2 === 0) drawTextCentered(ended ? 'START: NEW LIFE' : 'PRESS START', 196, C.bone, W, 0, C.black);
    rect(0, H - 12, W, 12, C.black);
    drawTextCentered('SELECT: SETTINGS', H - 10, C.stone);
  }
}

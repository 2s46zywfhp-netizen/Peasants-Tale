import { clear, rect } from '../../render/draw';
import { drawText, drawTextCentered } from '../../render/font';
import { C } from '../../render/palette';
import { SaveError, exportSave, importSave, type TextSpeed } from '../../save/schema';
import type { ActionEvent } from '../../input/input';
import type { Game } from '../game';
import { withActivation } from '../gesture';
import type { Scene } from '../scene';
import { Typewriter } from '../typewriter';
import { ConfirmScene } from './confirm';

const SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast'];
type Item = 'textSpeed' | 'sound' | 'scanlines' | 'dmg' | 'export' | 'import' | 'wipe' | 'back';
const ITEMS: readonly { id: Item; label: string }[] = [
  { id: 'textSpeed', label: 'TEXT SPEED' },
  { id: 'sound', label: 'SOUND' },
  { id: 'scanlines', label: 'SCANLINES' },
  { id: 'dmg', label: 'DMG MODE' },
  { id: 'export', label: 'EXPORT SAVE' },
  { id: 'import', label: 'IMPORT SAVE' },
  { id: 'wipe', label: 'WIPE SAVE' },
  { id: 'back', label: 'BACK' },
];

export class SettingsScene implements Scene {
  readonly opaque = true;
  private cursor = 0;
  private msg = new Typewriter();

  constructor(private game: Game) {}

  private say(text: string): void {
    this.msg.show(text.toUpperCase().slice(0, 18), this.game.now(), this.game.save.data.settings.textSpeed);
  }

  onAction(e: ActionEvent): void {
    const g = this.game;
    const item = ITEMS[this.cursor]!.id;
    switch (e.action) {
      case 'up':
      case 'down':
        this.cursor = (this.cursor + (e.action === 'up' ? -1 : 1) + ITEMS.length) % ITEMS.length;
        g.sfx('move');
        return;
      case 'left':
      case 'right':
        if (!e.repeat) this.change(item, e.action === 'left' ? -1 : 1);
        return;
      case 'confirm':
        this.activate(item);
        return;
      case 'cancel':
      case 'select':
        g.sfx('cancel');
        g.scenes.pop();
        return;
      default:
        return;
    }
  }

  private change(item: Item, dir: 1 | -1): void {
    const s = this.game.save.data.settings;
    if (item === 'textSpeed') {
      const i = (SPEEDS.indexOf(s.textSpeed) + dir + SPEEDS.length) % SPEEDS.length;
      this.game.updateSettings({ textSpeed: SPEEDS[i]! });
      this.say('THE QUICK FOX...');
    } else if (item === 'sound' || item === 'scanlines' || item === 'dmg') {
      this.game.updateSettings({ [item]: !s[item] });
    } else return;
    this.game.sfx('move');
  }

  private activate(item: Item): void {
    const g = this.game;
    switch (item) {
      case 'textSpeed':
        return this.change(item, 1);
      case 'sound':
      case 'scanlines':
      case 'dmg':
        return this.change(item, 1);
      case 'back':
        g.sfx('cancel');
        return g.scenes.pop();
      case 'export':
        g.sfx('confirm');
        return this.exportSave();
      case 'import':
        g.sfx('confirm');
        g.scenes.push(new ConfirmScene(g, ['IMPORT FROM', 'CLIPBOARD?', 'THIS LIFE ENDS.'], () => this.importSave()), false);
        return;
      case 'wipe':
        g.sfx('confirm');
        g.scenes.push(new ConfirmScene(g, ['WIPE SAVE?', 'THE PEASANT', 'WILL BE FORGOT.'], () => this.wipe()), false);
        return;
    }
  }

  private exportSave(): void {
    const json = exportSave(this.game.save.data);
    // Synchronous so the clipboard write stays inside the user's gesture.
    withActivation(() => {
      const fallback = () => {
        window.prompt('Copy your save:', json);
        this.say('SAVE SHOWN');
      };
      if (!navigator.clipboard?.writeText) return fallback();
      navigator.clipboard.writeText(json).then(
        () => this.say('SAVE COPIED'),
        () => fallback(),
      );
    });
  }

  private importSave(): void {
    const g = this.game;
    withActivation(() => {
      const fromPrompt = () => Promise.resolve(window.prompt('Paste your save:') ?? '');
      const read = navigator.clipboard?.readText ? navigator.clipboard.readText().catch(fromPrompt) : fromPrompt();
      void read.then(async (text) => {
        if (!text.trim()) return this.say('NOTHING TO IMPORT');
        try {
          const data = importSave(text);
          await g.save.replace(data, g.now());
          g.applySettings();
          g.sfx('confirm');
          this.say('SAVE LOADED');
        } catch (err) {
          g.sfx('error');
          this.say(err instanceof SaveError ? 'BAD SAVE' : 'IMPORT FAILED');
        }
      });
    });
  }

  private wipe(): void {
    const g = this.game;
    void g.save.wipe(g.newSeed(), g.now()).then(() => this.say('SAVE WIPED'));
  }

  private value(item: Item): string {
    const s = this.game.save.data.settings;
    switch (item) {
      case 'textSpeed':
        return s.textSpeed.toUpperCase();
      case 'sound':
      case 'scanlines':
      case 'dmg':
        return s[item] ? 'ON' : 'OFF';
      default:
        return '';
    }
  }

  draw(ctx: CanvasRenderingContext2D, now: number): void {
    clear(ctx, C.night);
    drawTextCentered(ctx, 'SETTINGS', 6, C.gold);
    rect(ctx, 8, 16, 144, 1, C.slate);
    ITEMS.forEach((it, i) => {
      const y = 22 + i * 12;
      const sel = i === this.cursor;
      if (sel) drawText(ctx, '>', 2, y, C.ember);
      drawText(ctx, it.label, 12, y, sel ? C.bone : C.mist);
      const v = this.value(it.id);
      if (v) drawText(ctx, v, 156 - v.length * 8, y, sel ? C.gold : C.parchment);
    });
    rect(ctx, 8, 121, 144, 1, C.slate);
    drawText(ctx, this.msg.visible(now), 8, 128, C.sea);
  }
}

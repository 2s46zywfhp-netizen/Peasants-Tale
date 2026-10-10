import { TEXT_SPEED_CPS } from '../sim/balance';
import type { TextSpeed } from '../save/schema';

/** Reveals text over time at the player's chosen text speed. */
export class Typewriter {
  private text = '';
  private startedAt = 0;
  private cps: number = TEXT_SPEED_CPS.normal;

  show(text: string, now: number, speed: TextSpeed): void {
    this.text = text;
    this.startedAt = now;
    this.cps = TEXT_SPEED_CPS[speed];
  }
  clear(): void {
    this.text = '';
  }
  visible(now: number): string {
    const n = Math.floor(((now - this.startedAt) / 1000) * this.cps);
    return this.text.slice(0, Math.max(0, n));
  }
  done(now: number): boolean {
    return this.visible(now).length >= this.text.length;
  }
}

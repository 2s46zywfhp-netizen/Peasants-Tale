import type { Season } from '../sim/calendar';
import { THEMES, noteFreq, type Theme } from './themes';

/** Web Audio synthesis only: no sample files. */
export type Sfx = 'move' | 'confirm' | 'cancel' | 'start' | 'error' | 'blip' | 'step' | 'eat' | 'door' | 'bell' | 'sting';

const TONES: Partial<Record<Sfx, { type: OscillatorType; notes: readonly number[]; step: number; gain: number }>> = {
  move: { type: 'square', notes: [660], step: 0.03, gain: 0.05 },
  confirm: { type: 'square', notes: [523, 784], step: 0.05, gain: 0.06 },
  cancel: { type: 'square', notes: [392, 262], step: 0.05, gain: 0.06 },
  start: { type: 'triangle', notes: [196, 262, 330, 392], step: 0.09, gain: 0.12 },
  error: { type: 'sawtooth', notes: [110, 104], step: 0.09, gain: 0.05 },
  blip: { type: 'square', notes: [880], step: 0.022, gain: 0.025 },
};

const LOOKAHEAD_S = 0.25;
const TICK_MS = 50;

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private drone: OscillatorNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextAt = 0;
  private stepAlt = false;
  enabled = true;
  musicOn = true;
  private season: Season = 'spring';
  private theme: Theme = THEMES.spring;

  /** Must be called from a user-activation event (iOS will not start audio otherwise). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? 1 : 0;
        this.master.connect(ctx.destination);
        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = 0.9;
        this.musicGain.connect(this.master);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        let x = 2463534242;
        for (let i = 0; i < len; i++) {
          x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
          d[i] = ((x >>> 0) / 4294967296) * 2 - 1;
        }
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  /** Mute follows the sound setting. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setSeason(s: Season): void {
    if (s === this.season) return;
    this.season = s;
    this.theme = THEMES[s];
    if (this.timer) {
      this.stopMusic();
      this.startMusic();
    }
  }

  private ready(): AudioContext | null {
    const ctx = this.ctx;
    return this.enabled && ctx && ctx.state === 'running' ? ctx : null;
  }

  play(name: Sfx): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const tone = TONES[name];
    if (tone) return this.tone(ctx, tone.type, tone.notes, tone.step, tone.gain, t0);
    switch (name) {
      case 'step':
        this.stepAlt = !this.stepAlt;
        return this.noiseHit(ctx, t0, 0.05, this.stepAlt ? 520 : 420, 'lowpass', 0.07);
      case 'eat':
        for (let i = 0; i < 3; i++) this.noiseHit(ctx, t0 + i * 0.11, 0.05, 1800 - i * 200, 'bandpass', 0.06);
        return;
      case 'door':
        this.sweep(ctx, 'sine', 90, 40, t0, 0.35, 0.18);
        this.sweep(ctx, 'sawtooth', 320, 170, t0 + 0.05, 0.3, 0.02);
        return;
      case 'bell':
        return this.bell(1);
      case 'sting':
        this.sweep(ctx, 'square', 110, 52, t0, 1.1, 0.05);
        this.sweep(ctx, 'square', 116.5, 55, t0, 1.1, 0.04);
        this.noiseHit(ctx, t0, 1.0, 180, 'lowpass', 0.12);
        return;
      default:
        return;
    }
  }

  /** Church bell: inharmonic partials (hum, prime, minor third, fifth, nominal...), struck `n` times. */
  bell(n: number): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const base = 196;
    const partials: readonly [number, number, number][] = [[0.5, 0.06, 4.5], [1, 0.08, 3.2], [1.19, 0.05, 2.6], [1.5, 0.03, 2], [2, 0.04, 1.6], [2.74, 0.02, 1.1], [3.01, 0.015, 0.8]];
    for (let k = 0; k < n; k++) {
      const t = ctx.currentTime + 0.05 + k * 1.7;
      for (const [ratio, gain, dur] of partials) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = base * ratio;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    }
  }

  private tone(ctx: AudioContext, type: OscillatorType, notes: readonly number[], step: number, gain: number, t0: number, out: AudioNode = this.master!): void {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    notes.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + i * step));
    const end = t0 + notes.length * step;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
    osc.connect(amp).connect(out);
    osc.start(t0);
    osc.stop(end + 0.05);
  }

  private sweep(ctx: AudioContext, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, gain: number): void {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseHit(ctx: AudioContext, t0: number, dur: number, freq: number, type: BiquadFilterType, gain: number): void {
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(amp).connect(this.master!);
    src.start(t0, (t0 * 7919) % 0.8);
    src.stop(t0 + dur + 0.02);
  }

  /* ── music ── */

  private startMusic(): void {
    const ctx = this.ready();
    if (!ctx || !this.musicOn || this.timer || !this.musicGain) return;
    const t = this.theme;
    // The drone: root and fifth, low and constant, with a slow swell.
    for (const [mult, type, gain] of [[1, 'triangle', 0.05], [1.5, 'triangle', 0.025], [0.5, 'square', 0.008]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      o.type = type;
      o.frequency.value = t.root * mult;
      g.gain.value = gain;
      lfo.frequency.value = 0.07 + mult * 0.02;
      lfoGain.gain.value = gain * 0.5;
      lfo.connect(lfoGain).connect(g.gain);
      o.connect(g).connect(this.musicGain);
      o.start();
      lfo.start();
      this.drone.push(o, lfo);
    }
    this.step = 0;
    this.nextAt = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  private stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const o of this.drone) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    }
    this.drone = [];
  }

  /** Lookahead scheduler: queue every note that falls within the next LOOKAHEAD_S seconds. */
  private schedule(): void {
    const ctx = this.ready();
    if (!ctx || !this.musicGain) return;
    const t = this.theme;
    const stepS = 60 / t.bpm / 2;
    while (this.nextAt < ctx.currentTime + LOOKAHEAD_S) {
      const i = this.step % t.melody.length;
      const m = t.melody[i]!;
      const b = t.bass[i]!;
      if (m >= 0) this.tone(ctx, 'square', [noteFreq(t, m, 2)], stepS * 1.6, 0.022, this.nextAt, this.musicGain);
      if (b >= 0) this.tone(ctx, 'triangle', [noteFreq(t, b, 1)], stepS * 3.5, 0.06, this.nextAt, this.musicGain);
      this.nextAt += stepS;
      this.step++;
    }
  }
}

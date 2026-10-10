/** Web Audio synthesis only: no sample files. */
export type Sfx = 'move' | 'confirm' | 'cancel' | 'start' | 'error';

const PATCHES: Record<Sfx, { type: OscillatorType; notes: readonly number[]; step: number; gain: number }> = {
  move: { type: 'square', notes: [660], step: 0.03, gain: 0.05 },
  confirm: { type: 'square', notes: [523, 784], step: 0.05, gain: 0.06 },
  cancel: { type: 'square', notes: [392, 262], step: 0.05, gain: 0.06 },
  start: { type: 'triangle', notes: [196, 262, 330, 392], step: 0.09, gain: 0.12 },
  error: { type: 'sawtooth', notes: [110, 104], step: 0.09, gain: 0.05 },
};

export class Audio {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Must be called from a user-activation event (iOS will not start audio otherwise). */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const p = PATCHES[name];
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = p.type;
    p.notes.forEach((f, i) => osc.frequency.setValueAtTime(f, t0 + i * p.step));
    const end = t0 + p.notes.length * p.step;
    amp.gain.setValueAtTime(p.gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(end + 0.05);
  }
}

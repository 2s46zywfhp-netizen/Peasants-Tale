/** mulberry32: the only randomness source allowed in the game. State is a uint32. */
export function mulberry32Next(state: number): { state: number; value: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: s, value };
}

/** Stateful wrapper for code that owns its own stream (e.g. render-side flicker). */
export class Rng {
  constructor(public state: number) {
    this.state = state >>> 0;
  }
  /** Same sequence as mulberry32Next, computed in place (no allocation: used in the render loop). */
  next(): number {
    const s = (this.state + 0x6d2b79f5) >>> 0;
    this.state = s;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

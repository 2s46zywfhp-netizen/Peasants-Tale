/** Sine in 256 steps, scaled to ±1024, for smooth integer motion in the frame loop (no boxed doubles). */
export const SIN256 = Int16Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i / 256) * Math.PI * 2) * 1024));
/** sin and cos of step i (any integer), ±1024. */
export const isin = (i: number): number => SIN256[i & 255]!;
export const icos = (i: number): number => SIN256[(i + 64) & 255]!;

/**
 * Exposes a little game state as data- attributes on <body> for automated browser checks
 * (the screen itself is a canvas). Writes only when a value changes.
 */
const last: Record<string, string> = {};

export function probe(key: string, value: string): void {
  if (last[key] === value) return;
  last[key] = value;
  if (typeof document !== 'undefined') document.body.dataset[key] = value;
}

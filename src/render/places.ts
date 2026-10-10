import type { Location } from '../sim/balance';

export interface Place {
  id: Location;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Placeholder village layout in screen pixels (map area is y 18..117). */
export const PLACES: readonly Place[] = [
  { id: 'home', label: 'COTTAGE', x: 6, y: 24, w: 28, h: 20 },
  { id: 'church', label: 'CHURCH', x: 64, y: 20, w: 30, h: 26 },
  { id: 'tavern', label: 'ALEHOUSE', x: 122, y: 24, w: 32, h: 20 },
  { id: 'strips', label: 'YOUR STRIPS', x: 4, y: 58, w: 44, h: 34 },
  { id: 'green', label: 'VILLAGE GREEN', x: 58, y: 58, w: 42, h: 24 },
  { id: 'demesne', label: "LORD'S DEMESNE", x: 108, y: 54, w: 48, h: 38 },
  { id: 'stream', label: 'STREAM', x: 4, y: 100, w: 70, h: 10 },
  { id: 'woods', label: 'WOODS', x: 96, y: 98, w: 60, h: 18 },
];

export function placeAt(px: number, py: number): Place | null {
  return PLACES.find((p) => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) ?? null;
}

export function placeOf(id: Location): Place {
  return PLACES.find((p) => p.id === id)!;
}

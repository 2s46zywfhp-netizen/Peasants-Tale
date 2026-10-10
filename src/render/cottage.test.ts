import { describe, expect, it } from 'vitest';
import {
  BED_SLEEP, DARKER, DOOR_X, FEET_MAX, FEET_MIN, FIRE_FRAMES, FLOOR_Y, GLASS, ROOM_H, ROOM_W, SPOTS, cameraX, darknessOf, litRoom, paintFire,
  paintGlow, paintRoom, paintWindow,
} from './cottage';

const T = 255;
const onlyPalette = (b: Uint8Array) => b.every((v) => v === T || (v >= 0 && v < 16));

describe('the side-view cottage', () => {
  const room = paintRoom();

  it('paints only palette colours, and every pixel but the window glass', () => {
    expect(room).toHaveLength(ROOM_W * ROOM_H);
    expect(onlyPalette(room)).toBe(true);
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const glass = x >= GLASS.x && x < GLASS.x + GLASS.w && y >= GLASS.y && y < GLASS.y + GLASS.h;
        expect(room[y * ROOM_W + x] === T, `${x},${y}`).toBe(glass);
      }
    }
  });

  it('is wider than the screen, and the camera pans across all of it', () => {
    expect(ROOM_W).toBeGreaterThan(160);
    expect(cameraX(0)).toBe(0);
    expect(cameraX(ROOM_W)).toBe(ROOM_W - 160);
    expect(cameraX(120)).toBe(48);
  });

  it('has a hearth, a table and a bed to act at, left to right, and the door beyond them', () => {
    expect(SPOTS.map((s) => s.label)).toEqual(['A:HEARTH', 'A:TABLE', 'A:BED']);
    for (let i = 1; i < SPOTS.length; i++) expect(SPOTS[i]!.x0).toBeGreaterThanOrEqual(SPOTS[i - 1]!.x1);
    expect(DOOR_X).toBeGreaterThanOrEqual(SPOTS.at(-1)!.x1);
    expect(FEET_MIN).toBeGreaterThan(FLOOR_Y);
    expect(FEET_MAX).toBeLessThan(ROOM_H);
    expect(BED_SLEEP.x).toBeGreaterThanOrEqual(SPOTS[2]!.x0);
  });

  it('darkens at dusk and more at night, but the hearth stays warm', () => {
    const day = litRoom(room, 0);
    const dusk = litRoom(room, 1);
    const night = litRoom(room, 2);
    const darkness = (b: Uint8Array) => b.filter((v) => v === 0 || v === 1).length;
    expect(darkness(dusk)).toBeGreaterThan(darkness(day));
    expect(darkness(night)).toBeGreaterThan(darkness(dusk));
    // Next to the fire, nothing is darker at night than by day.
    const near = (b: Uint8Array) => [...Array(20).keys()].map((k) => b[(70 + k) * ROOM_W + 31]);
    expect(near(night).filter((v) => v === 0 || v === 1).length).toBeLessThanOrEqual(near(day).filter((v) => v === 0 || v === 1).length + 2);
    expect(darknessOf(2)).toBe(0);
    expect(darknessOf(4)).toBe(1);
    expect(darknessOf(5)).toBe(2);
    expect(onlyPalette(night)).toBe(true);
  });

  it('every colour has a darker shade in the palette', () => {
    expect(DARKER).toHaveLength(16);
    for (const d of DARKER) expect(d).toBeGreaterThanOrEqual(0);
  });

  it('the fire flickers: every frame differs, flame colours only, logs at the bottom', () => {
    const frames = Array.from({ length: FIRE_FRAMES }, (_, f) => paintFire(f));
    for (const f of frames) expect(onlyPalette(f)).toBe(true);
    const keys = new Set(frames.map((f) => f.join(',')));
    expect(keys.size).toBe(FIRE_FRAMES);
    const flame = new Set([5, 15, 9, 8, 10]);
    expect(frames[0]!.filter((v) => flame.has(v)).length).toBeGreaterThan(150);
    expect(paintGlow(0).some((v) => v !== T)).toBe(true);
  });

  it('the window shows the season and the hour: snow in winter, stars at night', () => {
    const summerDay = paintWindow(2, 'summer', 'fair');
    const winterDay = paintWindow(2, 'winter', 'fair');
    const winterNight = paintWindow(5, 'winter', 'fair');
    const foggy = paintWindow(2, 'summer', 'fog');
    expect(onlyPalette(summerDay) && onlyPalette(winterNight)).toBe(true);
    const bone = (b: Uint8Array) => b.filter((v) => v === 5).length;
    expect(bone(winterDay)).toBeGreaterThan(bone(summerDay) + 100);
    expect(summerDay.join()).not.toBe(winterDay.join());
    expect(winterNight.join()).not.toBe(winterDay.join());
    expect(foggy.join()).not.toBe(summerDay.join());
  });
});

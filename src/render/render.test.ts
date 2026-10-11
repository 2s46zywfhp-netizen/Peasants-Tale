import { describe, expect, it } from 'vitest';
import { createLife } from '../sim/sim';
import { anim } from './atlas';
import { H, LOCK, NONE, W, addLight, finishWorld, pix, rect, resetLight } from './fb';
import { AMBIENT, DARKER, DMG, DMG_SHADES, HOUR_LUTS, PALETTE, SEASON_LUTS, WARM, c } from './palette';
import { SCENES } from './scenes/maps';
import { loadTestAtlas } from './testAtlas';
import { particleCount, setWeather, snowCover, windFor } from './weather';
import { drawWorld, type WorldView } from './world';

loadTestAtlas();

const fillAll = (v: number) => {
  resetLight();
  rect(0, 0, W, H, v);
};

describe('palette: 32 colours in 8 ramps, looks as lookup tables', () => {
  it('has 32 colours, four shades per ramp, darkest first', () => {
    expect(PALETTE).toHaveLength(32);
    const luma = (h: string) => 0.299 * parseInt(h.slice(1, 3), 16) + 0.587 * parseInt(h.slice(3, 5), 16) + 0.114 * parseInt(h.slice(5, 7), 16);
    for (let r = 0; r < 8; r++) for (let s = 1; s < 4; s++) expect(luma(PALETTE[r * 4 + s]!), `ramp ${r} shade ${s}`).toBeGreaterThan(luma(PALETTE[r * 4 + s - 1]!));
  });
  it('keeps every colour of the old 16', () => {
    for (const h of ['#0b0d14', '#141a2e', '#1f2d4a', '#2e5a6b', '#3f8a8c', '#e8e0c4', '#8a9bb0', '#4a5468', '#8c2a2a', '#d4622a', '#5c1a1a', '#4a3326', '#6b4a32', '#3d5a3a', '#c9b99a', '#f2c14e'])
      expect(PALETTE as readonly string[]).toContain(h);
  });
  it('every table maps into the palette, and the seasons, hours and fire really change things', () => {
    for (const t of [DARKER, WARM, DMG, ...HOUR_LUTS, ...Object.values(SEASON_LUTS)]) for (const v of t) expect(v).toBeLessThan(32);
    const changed = (t: Uint8Array) => t.filter((v, i) => v !== i).length;
    expect(changed(SEASON_LUTS.autumn)).toBeGreaterThan(3);
    expect(changed(SEASON_LUTS.winter)).toBeGreaterThan(3);
    expect(changed(HOUR_LUTS[5]!)).toBeGreaterThan(16);
    expect(changed(WARM)).toBeGreaterThan(8);
    expect(new Set(DMG)).toEqual(new Set(DMG_SHADES));
  });
});

describe('per-pixel lighting', () => {
  it('at night, unlit pixels take the night table and step darker; lamplight leaves true, warm colour', () => {
    fillAll(c('bone', 2));
    addLight(40, 40, 20, 15, true);
    finishWorld('spring', false, 5, 0, H, AMBIENT[5]);
    const lit = pix[40 * W + 40]!, dark = pix[200 * W + 200]!;
    expect(lit).toBe(WARM[c('bone', 2)]);
    expect(dark).not.toBe(c('bone', 2));
    expect(HOUR_LUTS[5]!.includes(dark) || DARKER.includes(dark)).toBe(true);
  });
  it('the edge of a pool of light is ordered-dithered between ramp steps', () => {
    fillAll(c('stone', 3));
    addLight(128, 112, 80, 15, false);
    finishWorld('spring', false, 5, 0, H, 4);
    const row = new Set<number>();
    for (let x = 128; x < 210; x++) row.add(pix[112 * W + x]!);
    expect(row.size).toBeGreaterThanOrEqual(3);
  });
  it('locked pixels (the sky, the moon) are left alone', () => {
    fillAll(c('teal', 3) | LOCK);
    finishWorld('winter', true, 5, 0, H);
    expect(pix[0]).toBe(c('teal', 3) | LOCK);
  });
});

describe('the world drawn at 256x224', () => {
  const view = (id: keyof typeof SCENES): WorldView => ({
    scene: SCENES[id], cam: 40, actors: [{ anim: anim('peasant.walk.side'), x: 120, y: SCENES[id].room ? 160 : 90, flip: false, layers: 1, offset: 0, visible: true, eyes: false }],
    prompt: 'A: CHOP', promptX: 120, promptY: 40, needs: ['bread'], belt: 'axe', queued: 1, message: '',
  });
  const frame = (s: ReturnType<typeof createLife>, id: keyof typeof SCENES) => {
    drawWorld(s, view(id), 1000, () => s.anchorMs);
    return Uint8Array.from(pix);
  };

  it('every scene draws, in palette indices only, with nothing left empty', () => {
    const s = createLife(7, 0);
    for (const id of Object.keys(SCENES) as (keyof typeof SCENES)[]) {
      const f = frame(s, id);
      let bad = 0;
      for (const v of f) if (v === NONE || (v & 31) !== (v & ~LOCK)) bad++;
      expect(bad, id).toBe(0);
    }
  });

  it('night and day, and the seasons, look different', () => {
    const s = createLife(7, 0);
    const day = frame({ ...s, block: 2 }, 'green');
    const night = frame({ ...s, block: 5 }, 'green');
    const winter = frame({ ...s, block: 2 + 6 * 280 }, 'green');
    const diff = (a: Uint8Array, b: Uint8Array) => a.filter((v, i) => v !== b[i]).length / a.length;
    expect(diff(day, night)).toBeGreaterThan(0.4);
    expect(diff(day, winter)).toBeGreaterThan(0.1);
  });

  it('snow cover and wind come from the sim weather, the same every time', () => {
    for (let d = 0; d < 400; d += 37) {
      expect(snowCover(3, d)).toBe(snowCover(3, d));
      expect(snowCover(3, d)).toBeGreaterThanOrEqual(0);
      expect(snowCover(3, d)).toBeLessThanOrEqual(3);
    }
    expect(Math.abs(windFor(3, 10, 'storm'))).toBeGreaterThan(Math.abs(windFor(3, 10, 'fair')) - 0.5);
    setWeather('rain', 'spring', true, 0.4);
    expect(particleCount()).toBeGreaterThan(50);
    setWeather('rain', 'spring', false, 0.4);
    expect(particleCount()).toBe(0);
  });
});

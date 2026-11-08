import { describe, expect, it } from 'vitest';
import { lat2y, lon2x, tilesFor, tileUrl, toGpx, NRCAN_BASE } from './tiles';

describe('tile maths', () => {
  it('matches the standard slippy-map formula', () => {
    expect(lon2x(-180, 3)).toBe(0);
    expect(lon2x(0, 1)).toBe(1);
    expect(lat2y(0, 1)).toBe(1);
    expect(lon2x(-80.99, 10)).toBe(281);
    expect(lat2y(46.49, 10)).toBe(362); // (1 - ln(tan φ + sec φ)/π)/2 × 1024 = 362.3
  });
  it('counts tiles for an area across zooms', () => {
    const b = { north: 46.55, south: 46.45, east: -80.9, west: -81.1 };
    const t = tilesFor(b, 10, 12);
    expect(t.filter((x) => x.z === 10).length).toBeGreaterThanOrEqual(1);
    expect(t.filter((x) => x.z === 12).length).toBeGreaterThan(t.filter((x) => x.z === 10).length);
  });
  it('builds NRCan tile URLs in z/y/x order', () => {
    expect(tileUrl(NRCAN_BASE, { z: 8, x: 70, y: 90 })).toMatch(/tile\/8\/90\/70$/);
  });
  it('writes valid escaped GPX', () => {
    const g = toGpx([{ lat: 46.5, lon: -81, name: 'Spring <north>', type: 'water' }]);
    expect(g).toContain('<wpt lat="46.500000" lon="-81.000000">');
    expect(g).toContain('Spring &lt;north&gt;');
  });
});

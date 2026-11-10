import { describe, expect, it } from 'vitest';
import { countLabel, filterSightings, toFeatureCollection, whenLabel } from '../src/sightings';
import type { Sighting } from '../src/types';

const s = (name: string, group: Sighting['group']): Sighting => ({
  id: name,
  speciesCode: name,
  name,
  group,
  count: 1,
  when: '2026-11-10 07:00',
  place: 'Marsh',
  lat: 50,
  lng: -97,
});

const list = [s('Mallard', 'duck'), s('Canada Goose', 'goose'), s('American Coot', 'coot')];

describe('filterSightings', () => {
  it('filters by group chip', () => {
    expect(filterSightings(list, 'all', '').length).toBe(3);
    expect(filterSightings(list, 'goose', '').map((x) => x.name)).toEqual(['Canada Goose']);
  });
  it('searches case-insensitively', () => {
    expect(filterSightings(list, 'all', '  MALL ').map((x) => x.name)).toEqual(['Mallard']);
    expect(filterSightings(list, 'coot', 'mallard')).toEqual([]);
  });
});

describe('toFeatureCollection', () => {
  it('puts coordinates in lng,lat order with group colours', () => {
    const fc = toFeatureCollection([s('Mallard', 'duck')]);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-97, 50]);
    expect(fc.features[0]?.properties?.colour).toBe('#1e6fd9');
  });
});

describe('labels', () => {
  const now = new Date(2026, 10, 10, 12, 0);
  it('count', () => {
    expect(countLabel(null)).toBe('Seen (not counted)');
    expect(countLabel(1)).toBe('1 bird');
    expect(countLabel(40)).toBe('40 birds');
  });
  it('when', () => {
    expect(whenLabel('2026-11-10 07:00', now)).toBe('Today, 07:00');
    expect(whenLabel('2026-11-09', now)).toBe('Yesterday');
    expect(whenLabel('2026-11-06 18:30', now)).toBe('4 days ago');
    expect(whenLabel('garbage', now)).toBe('garbage');
  });
});

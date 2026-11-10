import type { Group, GroupFilter, Sighting } from './types';

export const GROUP_COLOURS: Record<Group, string> = {
  duck: '#1e6fd9', // blue
  goose: '#8a8f98', // grey
  coot: '#111111', // black
};

/** Keeps sightings that match the group chip and the search text. */
export function filterSightings(list: Sighting[], group: GroupFilter, search: string): Sighting[] {
  const q = search.trim().toLowerCase();
  return list.filter((s) => (group === 'all' || s.group === group) && (!q || s.name.toLowerCase().includes(q)));
}

/** GeoJSON for the map's dot layer. */
export function toFeatureCollection(list: Sighting[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: list.map((s) => ({
      type: 'Feature',
      id: s.id,
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: { id: s.id, colour: GROUP_COLOURS[s.group] },
    })),
  };
}

/** "how many" line for the tap card. eBird uses no count for "X" (present, not counted). */
export function countLabel(count: number | null): string {
  if (count === null) return 'Seen (not counted)';
  return count === 1 ? '1 bird' : `${count} birds`;
}

/** "Today, 08:15" / "Yesterday" / "3 days ago" from an eBird local date-time. */
export function whenLabel(when: string, now: Date): string {
  const [datePart, timePart] = when.split(' ');
  const [y, m, d] = (datePart ?? '').split('-').map(Number);
  if (!y || !m || !d) return when;
  const seen = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - seen.getTime()) / 86_400_000);
  const time = timePart ? `, ${timePart}` : '';
  if (days <= 0) return `Today${time}`;
  if (days === 1) return `Yesterday${time}`;
  return `${days} days ago`;
}

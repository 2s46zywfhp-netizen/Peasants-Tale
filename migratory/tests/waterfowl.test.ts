import { describe, expect, it } from 'vitest';
import {
  buildWaterfowlIndex,
  classify,
  parseQuery,
  toSightings,
  type EbirdObs,
  type TaxonRow,
} from '../supabase/functions/_shared/waterfowl';

const row = (comName: string, sciName: string, familySciName: string, category = 'species'): TaxonRow => ({
  speciesCode: comName.toLowerCase().replace(/\W/g, ''),
  comName,
  sciName,
  familySciName,
  category,
});

describe('classify', () => {
  it('sorts Anatidae into ducks and geese, swans with geese', () => {
    expect(classify(row('Mallard', 'Anas platyrhynchos', 'Anatidae'))).toBe('duck');
    expect(classify(row('Black-bellied Whistling-Duck', 'Dendrocygna autumnalis', 'Anatidae'))).toBe('duck');
    expect(classify(row('Canada Goose', 'Branta canadensis', 'Anatidae'))).toBe('goose');
    expect(classify(row('Snow Goose', 'Anser caerulescens', 'Anatidae'))).toBe('goose');
    expect(classify(row('Tundra Swan', 'Cygnus columbianus', 'Anatidae'))).toBe('goose');
  });

  it('keeps coots but not other rails', () => {
    expect(classify(row('American Coot', 'Fulica americana', 'Rallidae'))).toBe('coot');
    expect(classify(row('Virginia Rail', 'Rallus limicola', 'Rallidae'))).toBeNull();
    expect(classify(row('Common Gallinule', 'Gallinula galeata', 'Rallidae'))).toBeNull();
  });

  it('ignores everything else', () => {
    expect(classify(row('American Robin', 'Turdus migratorius', 'Turdidae'))).toBeNull();
  });
});

describe('buildWaterfowlIndex', () => {
  it('only uses species-level rows', () => {
    const idx = buildWaterfowlIndex([
      row('Mallard', 'Anas platyrhynchos', 'Anatidae'),
      row('Mallard x American Black Duck', 'Anas platyrhynchos x rubripes', 'Anatidae', 'hybrid'),
    ]);
    expect([...idx.keys()]).toEqual(['mallard']);
  });
});

describe('toSightings', () => {
  const index = buildWaterfowlIndex([row('Mallard', 'Anas platyrhynchos', 'Anatidae')]);
  const obs = (over: Partial<EbirdObs>): EbirdObs => ({
    speciesCode: 'mallard',
    comName: 'Mallard',
    sciName: 'Anas platyrhynchos',
    locName: 'Pond',
    obsDt: '2026-11-09 08:15',
    lat: 50,
    lng: -97,
    subId: 'S1',
    ...over,
  });

  it('drops non-waterfowl and duplicates, keeps missing counts as null', () => {
    const out = toSightings(
      [obs({ howMany: 12 }), obs({ howMany: 12 }), obs({ subId: 'S2' }), obs({ speciesCode: 'amerob' })],
      index,
    );
    expect(out.map((s) => [s.id, s.count])).toEqual([
      ['S1:mallard', 12],
      ['S2:mallard', null],
    ]);
    expect(out[0]?.group).toBe('duck');
  });
});

describe('parseQuery', () => {
  it('requires lat/lng and clamps radius and days', () => {
    expect(parseQuery(new URLSearchParams(''))).toBeNull();
    expect(parseQuery(new URLSearchParams('lat=0'))).toBeNull();
    expect(parseQuery(new URLSearchParams('lat=91&lng=0'))).toBeNull();
    expect(parseQuery(new URLSearchParams('lat=0&lng=0'))).toEqual({ lat: 0, lng: 0, dist: 50, back: 7 });
    expect(parseQuery(new URLSearchParams('lat=49.9&lng=-97.1&dist=500&back=90'))).toEqual({
      lat: 49.9,
      lng: -97.1,
      dist: 50,
      back: 30,
    });
  });
});

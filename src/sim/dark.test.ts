import { describe, expect, it } from 'vitest';
import { FAE } from './balance';
import { dayInfo } from './calendar';
import { dailyDark, faeSpare, nightTerrors, offering, offeringShort, roadAtNight } from './dark';
import { createLife } from './sim';
import { peasant, type SimState } from './state';

const count = (s: SimState) => s.log.filter((e) => e.type === 'dark').length;

describe('the dark layer', () => {
  it('bread on the barrow spares a blighted crop, and something is taken back later', () => {
    const s = createLife(1, 0);
    expect(faeSpare(s, 0.5, 'north')).toBe(0.5); // nothing given, nothing spared
    offering(s);
    expect(s.dark.faeFavour).toBe(1);
    expect(faeSpare(s, 1.2, 'north')).toBe(1.2); // a good year needs no help
    expect(faeSpare(s, 0.5, 'north')).toBe(1);
    expect(s.dark.faeDebt).toBe(1);
    const n = count(s);
    for (let i = 0; i < 2000 && s.dark.faeDebt > 0; i++) dailyDark(s);
    expect(s.dark.faeDebt).toBe(0);
    expect(count(s)).toBeGreaterThan(n);
  });

  it('there must be something to leave', () => {
    const s = createLife(2, 0);
    s.wealth.bread = 0;
    s.wealth.ale = 0;
    expect(offeringShort(s)).toBe('NOTHING TO LEAVE');
    s.wealth.bread = FAE.offeringBread;
    expect(offeringShort(s)).toBeNull();
  });

  it('nightmares and visitors come far more often to the hungry, sick and faithless', () => {
    const trial = (hungry: boolean) => {
      const s = createLife(3, 0);
      for (let i = 0; i < 3000; i++) {
        const b = peasant(s).body;
        b.hunger = hungry ? 90 : 5;
        b.illness = hungry ? { kind: 'fever', daysLeft: 3 } : null;
        s.soul.privatePiety = hungry ? 0 : 80;
        nightTerrors(s);
      }
      return count(s);
    };
    expect(trial(true)).toBeGreaterThan(trial(false) * 4);
  });

  it('the black dog is met on the roads at night, never at home', () => {
    const s = createLife(4, 0);
    const info = dayInfo(30);
    s.location = 'home';
    for (let i = 0; i < 3000; i++) roadAtNight(s, info);
    expect(count(s)).toBe(0);
    s.location = 'woods';
    for (let i = 0; i < 3000; i++) roadAtNight(s, info);
    expect(count(s)).toBeGreaterThan(10);
    expect(s.tags.some((t) => t.id === 'omen')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { HUNGER_STARVING, ILLNESS, OVERWORK_FATIGUE, RESERVE_TIERS } from './balance';
import { dailyHealth, illnessChance, injuryChance, pickIllness, reserveTier, tickBody, warmthTarget, type Surroundings } from './body';
import { newBody } from './state';

const env = (o: Partial<Surroundings> = {}): Surroundings => ({ activity: 'rest', tempC: 12, atHome: true, fireLit: false, night: false, ...o });
const quiet = { illness: 1, kind: 0, severity: 0, infection: 1 };

describe('hunger and reserve', () => {
  it('hunger rises faster when working and when cold', () => {
    const rest = newBody(); tickBody(rest, env());
    const work = newBody(); tickBody(work, env({ activity: 'work', atHome: false }));
    const cold = newBody(); cold.warmth = 0; tickBody(cold, env({ activity: 'work', atHome: false, tempC: -10 }));
    expect(work.hunger - 10).toBeGreaterThan(rest.hunger - 10);
    expect(cold.hunger).toBeGreaterThan(work.hunger);
  });
  it('burns reserve only at or above the starving threshold, more the hungrier', () => {
    const b = newBody(); b.hunger = HUNGER_STARVING - 20; const r0 = b.reserve;
    tickBody(b, env({ activity: 'sleep' }));
    expect(b.reserve).toBeGreaterThanOrEqual(r0);
    const starving = newBody(); starving.hunger = 100; tickBody(starving, env());
    const peckish = newBody(); peckish.hunger = HUNGER_STARVING; tickBody(peckish, env());
    expect(starving.reserve).toBeLessThan(peckish.reserve);
    expect(peckish.reserve).toBeLessThan(r0);
  });
  it('rebuilds slowly when fed, faster when wasted, never past the ceiling', () => {
    const fed = newBody(); fed.hunger = 0; const r0 = fed.reserve; tickBody(fed, env({ activity: 'sleep' }));
    const wasted = newBody(); wasted.hunger = 0; wasted.reserve = 10; tickBody(wasted, env({ activity: 'sleep' }));
    expect(fed.reserve - r0).toBeGreaterThan(0);
    expect(wasted.reserve - 10).toBeGreaterThan(fed.reserve - r0);
    const fat = newBody(); fat.reserve = 85; fat.hunger = 0; tickBody(fat, env({ activity: 'sleep' }));
    expect(fat.reserve).toBe(85);
  });
  it('names the visible tiers', () => {
    expect([90, 60, 40, 20, 5].map(reserveTier)).toEqual(['stout', 'healthy', 'thin', 'gaunt', 'skeletal']);
    expect(reserveTier(RESERVE_TIERS.thin)).toBe('thin');
  });
});

describe('fatigue, warmth, filth', () => {
  it('sleep restores fatigue, best at night; work tires', () => {
    const day = newBody(); day.fatigue = 80; tickBody(day, env({ activity: 'sleep' }));
    const night = newBody(); night.fatigue = 80; tickBody(night, env({ activity: 'sleep', night: true }));
    const work = newBody(); tickBody(work, env({ activity: 'work' }));
    expect(night.fatigue).toBeLessThan(day.fatigue);
    expect(day.fatigue).toBeLessThan(80);
    expect(work.fatigue).toBeGreaterThan(newBody().fatigue);
  });
  it('overwork raises injury chance', () => {
    const b = newBody();
    b.fatigue = OVERWORK_FATIGUE; expect(injuryChance(b, 'work')).toBe(0);
    b.fatigue = 90; const c90 = injuryChance(b, 'heavy');
    b.fatigue = 100; expect(injuryChance(b, 'heavy')).toBeGreaterThan(c90);
    expect(injuryChance(b, 'rest')).toBe(0);
  });
  it('warmth comes from season temperature, clothing, shelter and fire', () => {
    const out = warmthTarget(env({ atHome: false, tempC: 2 }));
    const home = warmthTarget(env({ tempC: 2 }));
    const fire = warmthTarget(env({ tempC: 2, fireLit: true }));
    const summer = warmthTarget(env({ atHome: false, tempC: 18 }));
    expect(home).toBeGreaterThan(out);
    expect(fire).toBeGreaterThan(home);
    expect(summer).toBeGreaterThan(out);
  });
  it('filth rises every block, faster at work', () => {
    const r = newBody(); tickBody(r, env());
    const w = newBody(); tickBody(w, env({ activity: 'work' }));
    expect(r.filth).toBeGreaterThan(newBody().filth);
    expect(w.filth).toBeGreaterThan(r.filth);
  });
});

describe('illness and death', () => {
  it('disease odds are weighted by reserve, fatigue, warmth and filth', () => {
    const base = illnessChance(newBody());
    for (const [k, v] of [['reserve', 5], ['fatigue', 100], ['warmth', 0], ['filth', 100]] as const) {
      const b = newBody(); b[k] = v;
      expect(illnessChance(b)).toBeGreaterThan(base);
    }
  });
  it('picks ague in a wet winter and flux in a filthy summer more often', () => {
    const b = newBody(); b.warmth = 10;
    const winter = Array.from({ length: 100 }, (_, i) => pickIllness(b, 'winter', true, i / 100));
    const f = newBody(); f.filth = 100;
    const summer = Array.from({ length: 100 }, (_, i) => pickIllness(f, 'summer', false, i / 100));
    const count = (a: string[], k: string) => a.filter((x) => x === k).length;
    expect(count(winter, 'ague')).toBeGreaterThan(count(summer, 'ague'));
    expect(count(summer, 'flux')).toBeGreaterThan(count(winter, 'flux'));
  });
  it('an illness drains health for its course, then the sick recover over days', () => {
    const b = newBody();
    b.illness = { kind: 'fever', daysLeft: 3 };
    dailyHealth(b, 'spring', false, quiet);
    expect(b.health).toBe(100 - ILLNESS.fever.drain);
    dailyHealth(b, 'spring', false, quiet);
    const out = dailyHealth(b, 'spring', false, quiet);
    expect(out.recovered).toBe('fever');
    expect(b.illness).toBeNull();
    dailyHealth(b, 'spring', false, quiet);
    expect(b.health).toBeGreaterThan(100 - 3 * ILLNESS.fever.drain);
  });
  it('injuries may fester into infection', () => {
    const b = newBody(); b.injuredDays = 3;
    const out = dailyHealth(b, 'spring', false, { ...quiet, infection: 0 });
    expect(out.fellIll).toBe('infectedInjury');
  });
  it('death is possible: a wasted body with fever dies', () => {
    const b = newBody(); b.reserve = 5; b.hunger = 100; b.health = 20;
    b.illness = { kind: 'fever', daysLeft: 10 };
    let died = false;
    for (let d = 0; d < 10 && !died; d++) died = dailyHealth(b, 'winter', true, quiet).died;
    expect(died).toBe(true);
  });
});

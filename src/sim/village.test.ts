import { describe, expect, it } from 'vitest';
import { FAVOUR, GOSSIP } from './balance';
import { dayInfo } from './calendar';
import { createLife } from './sim';
import { hasTag, type SimState } from './state';
import { accuse, askFavour, dailyVillage, deed, hearGossip, helpNeighbour, idx, meanOpinion, present, ROSTER, villager } from './village';

const monday = dayInfo(4);

function days(s: SimState, n: number, from = 10): void {
  for (let d = from; d < from + n; d++) {
    s.block = d * 6;
    dailyVillage(s, dayInfo(d));
  }
}

describe('village social graph', () => {
  it('has fifteen named villagers with roles, opinions of the family and of each other', () => {
    const s = createLife(1, 0);
    expect(s.village).toHaveLength(15);
    expect(new Set(s.village.map((v) => v.role))).toEqual(new Set(['priest', 'reeve', 'steward', 'miller', 'brewster', 'smith', 'neighbour', 'shepherd', 'beggar']));
    for (const v of s.village) {
      expect(v.ties).toHaveLength(15);
      expect(v.opinion).toBeGreaterThanOrEqual(-100);
      expect(v.opinion).toBeLessThanOrEqual(100);
    }
    expect(ROSTER.map((r) => r.id)).toEqual(s.village.map((v) => v.id));
  });

  it('a deed is felt by its witness at once and spreads through friends as gossip over days', () => {
    const s = createLife(2, 0);
    for (const v of s.village) v.ties = v.ties.map(() => 50); // everyone friends: gossip flows freely
    const before = s.village.map((v) => v.opinion);
    deed(s, -20, 'WAT stole a goose.', [idx('miller')]);
    const miller = villager(s, 'miller')!;
    expect(miller.opinion).toBeLessThan(before[idx('miller')]!);
    expect(miller.memory.at(-1)!.text).toContain('goose');
    const knowers = () => s.rumours[0]!.knownBy.toString(2).split('1').length - 1;
    expect(knowers()).toBe(1);
    days(s, 6);
    expect(knowers()).toBeGreaterThan(5);
    const worse = s.village.filter((v, i) => i !== idx('miller') && v.opinion < before[i]! - 5).length;
    expect(worse).toBeGreaterThan(3);
  });

  it('gossip does not pass between people who dislike each other', () => {
    const s = createLife(3, 0);
    for (const v of s.village) v.ties = v.ties.map(() => -50);
    deed(s, -20, 'WAT stole a goose.', [idx('miller')]);
    days(s, 10);
    expect(s.rumours[0]!.knownBy).toBe(1 << idx('miller'));
  });

  it('villagers do things to each other, and the family hears of it', () => {
    const s = createLife(4, 0);
    days(s, 120);
    expect(s.rumours.some((r) => r.about >= 0) || s.log.some((e) => e.text.startsWith('Gossip'))).toBe(true);
    let heard: string | null = null;
    for (let i = 0; i < 40 && !heard; i++) heard = hearGossip(s);
    if (s.rumours.some((r) => r.about >= 0)) expect(heard).not.toBeNull();
    expect(GOSSIP.lifeDays).toBeGreaterThan(0);
  });

  it('standing with the village follows what the villagers think', () => {
    const s = createLife(5, 0);
    for (const v of s.village) v.opinion = 80;
    days(s, 60);
    expect(meanOpinion(s)).toBeGreaterThan(40);
    expect(s.standing.village).toBeGreaterThan(65);
  });
});

describe('favours ledger', () => {
  it('help given is owed back, up to a cap, and can be called in', () => {
    const s = createLife(6, 0);
    const smith = villager(s, 'smith')!;
    for (let i = 0; i < 5; i++) helpNeighbour(s, 'smith');
    expect(smith.owes).toBe(FAVOUR.cap);
    const bread = s.wealth.bread;
    // No field work is waiting on this Monday in April? Either labour or bread is given.
    const grainBefore = s.fields.map((f) => f.sowLabour + f.careLabour).reduce((a, b) => a + b, 0);
    askFavour(s, 'smith', monday);
    const grainAfter = s.fields.map((f) => f.sowLabour + f.careLabour).reduce((a, b) => a + b, 0);
    expect(s.wealth.bread > bread || grainAfter > grainBefore).toBe(true);
    expect(smith.owes).toBe(FAVOUR.cap - 1);
  });

  it('a stranger owed nothing refuses; a friend helps but then you owe them, and they call it in', () => {
    const s = createLife(7, 0);
    const emma = villager(s, 'emma')!;
    emma.opinion = 0;
    emma.owes = 0;
    expect(askFavour(s, 'emma', monday)).toContain('refused');
    emma.opinion = 60;
    askFavour(s, 'emma', monday);
    askFavour(s, 'emma', monday);
    expect(emma.owes).toBe(-2);
    const grain = s.wealth.grain;
    days(s, 60);
    expect(emma.owes).toBeGreaterThan(-2);
    expect(s.wealth.grain).toBeLessThan(grain);
  });
});

describe('accusations', () => {
  it('a bad harvest and low standing bring a witchcraft accusation; without oath-helpers it sticks', () => {
    const s = createLife(8, 0);
    s.lastHarvest = 0.4;
    for (const v of s.village) v.opinion = -60;
    s.standing.village = 5;
    let d = 10;
    while (!hasTag(s, 'witch') && d < 4000) {
      s.block = d * 6;
      s.standing.village = 5;
      dailyVillage(s, dayInfo(d++));
    }
    expect(hasTag(s, 'witch')).toBe(true);
    expect(s.log.some((e) => e.type === 'dark' && e.text.includes('blight'))).toBe(true);
  });

  it('four friends who swear for you clear the name', () => {
    const s = createLife(9, 0);
    s.lastHarvest = 0.4;
    s.village.forEach((v, i) => (v.opinion = i < 6 ? 60 : -80));
    let d = 10;
    while (!s.log.some((e) => e.text.includes('swear for you')) && d < 6000) {
      s.block = d * 6;
      s.standing.village = 5;
      s.village.forEach((v, i) => (v.opinion = i < 6 ? 60 : -80));
      dailyVillage(s, dayInfo(d++));
    }
    expect(s.log.some((e) => e.text.includes('Cleared'))).toBe(true);
    expect(hasTag(s, 'witch')).toBe(false);
  });

  it('accusing a disliked rival drives them out; accusing a well-liked one backfires', () => {
    const s = createLife(10, 0);
    const i = idx('thomas');
    s.village.forEach((v) => (v.ties[i] = -50));
    accuse(s, 'thomas');
    expect(present(s.village[i]!)).toBe(false);
    const j = idx('matilda');
    s.village.forEach((v) => (v.ties[j] = 60));
    const priest = s.standing.priest;
    accuse(s, 'matilda');
    expect(present(s.village[j]!)).toBe(true);
    expect(s.village[j]!.opinion).toBeLessThanOrEqual(-60);
    expect(s.standing.priest).toBeLessThan(priest);
  });
});

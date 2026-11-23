// lib/achievementProgress.js: how far along an achievement the person is, and the order the Battle Pass lists them in.
import { MILES_PER_KM, STRENUOUS_TIERS, hikeFacts, listOrder, progressFor } from '../lib/achievementProgress';

describe('hikeFacts', () => {
  it('counts the hikes, adds up the distance in miles, and counts the Strenuous and Very Strenuous ones', () => {
    const f = hikeFacts([
      { distanceKm: 10, difficultyTier: 'Easy' },
      { distanceKm: 5, difficultyTier: 'Strenuous' },
      { distanceKm: 1.5, difficultyTier: 'Very Strenuous' },
      { distanceKm: 0, difficultyTier: 'Moderate' },
    ]);
    expect(f.count).toBe(4);
    expect(f.miles).toBeCloseTo(16.5 * MILES_PER_KM, 6);
    expect(f.strenuous).toBe(2);
    expect(STRENUOUS_TIERS).toEqual(['Strenuous', 'Very Strenuous']);
  });

  it('ignores a distance that is not a usable number, and anything that is not a hike', () => {
    const f = hikeFacts([{ distanceKm: 'far' }, { distanceKm: NaN }, { distanceKm: -3 }, { distanceKm: Infinity }, null, 'x', 7, { distanceKm: 2 }]);
    expect(f.count).toBe(5);
    expect(f.miles).toBeCloseTo(2 * MILES_PER_KM, 6);
  });

  it('copes with no hikes, or no list', () => {
    for (const hikes of [[], undefined, null, 'x', {}]) expect(hikeFacts(hikes)).toEqual({ count: 0, miles: 0, strenuous: 0 });
  });
});

describe('progressFor', () => {
  const facts = { finishedWorkouts: 7, bestCalories: 640, streak: 3, level: 12, xp: 4321, hikeCount: 4, hikeMiles: 12.349, strenuousHikes: 1 };

  it.each([
    ['workout_count', 7],
    ['streak', 3],
    ['level', 12],
    ['xp', 4321],
    ['calories_burned', 640],
    ['hike_count', 4],
    ['hike_miles', 12.3],
    ['strenuous_hikes', 1],
  ])('reads %s from its own fact', (type, current) => {
    expect(progressFor({ type, target: 50 }, facts)).toEqual({ current, target: 50 });
  });

  it('cuts miles down to a tenth rather than rounding up, so a hike is never counted as further than it was', () => {
    expect(progressFor({ type: 'hike_miles', target: 13 }, { hikeMiles: 12.99 })).toEqual({ current: 12.9, target: 13 });
  });

  it('is null for what the phone cannot count (virtual races and journeys), and for a kind it does not know', () => {
    expect(progressFor({ type: 'race_finishes', target: 5 }, facts)).toBeNull();
    expect(progressFor({ type: 'journey_finishes', target: 5 }, facts)).toBeNull();
    expect(progressFor({ type: 'steps', target: 5 }, facts)).toBeNull();
    expect(progressFor(undefined, facts)).toBeNull();
  });

  it('is zero progress for a fact that is missing or not a usable number', () => {
    expect(progressFor({ type: 'level', target: 10 }, undefined)).toEqual({ current: 0, target: 10 });
    expect(progressFor({ type: 'level', target: 10 }, { level: 'high' })).toEqual({ current: 0, target: 10 });
    expect(progressFor({ type: 'xp', target: 10 }, { xp: -5 })).toEqual({ current: 0, target: 10 });
    expect(progressFor({ type: 'xp', target: 10 }, { xp: NaN })).toEqual({ current: 0, target: 10 });
  });
});

describe('listOrder', () => {
  const ach = (id, unlockedAt) => ({ id, unlockedAt });
  const p = (current, target) => ({ current, target });

  it('puts what is earned first, the newest first', () => {
    const list = [ach('a'), ach('b', '2026-09-01T00:00:00Z'), ach('c'), ach('d', '2026-10-01T00:00:00Z')];
    expect(listOrder(list, {}).slice(0, 2).map((x) => x.id)).toEqual(['d', 'b']);
  });

  it('then lists what is not earned, the closest to earned first (by the share of the target)', () => {
    const list = [ach('far'), ach('near'), ach('half')];
    const progress = { far: p(1, 100), near: p(9, 10), half: p(5, 10) };
    expect(listOrder(list, progress).map((x) => x.id)).toEqual(['near', 'half', 'far']);
  });

  it('puts what shows no progress last, in the order the list had them', () => {
    const list = [ach('race1'), ach('near'), ach('race2'), ach('none')];
    const progress = { near: p(1, 2), race1: null, race2: undefined, none: p(0, 10) };
    expect(listOrder(list, progress).map((x) => x.id)).toEqual(['near', 'none', 'race1', 'race2']);
  });

  it('keeps the list\'s order for ties', () => {
    const list = [ach('a'), ach('b'), ach('c')];
    const progress = { a: p(1, 4), b: p(1, 4), c: p(1, 4) };
    expect(listOrder(list, progress).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('counts a target reached as the full share, and one of no target as no progress', () => {
    const list = [ach('zero'), ach('over'), ach('half')];
    const progress = { zero: p(5, 0), over: p(30, 10), half: p(5, 10) };
    expect(listOrder(list, progress).map((x) => x.id)).toEqual(['over', 'half', 'zero']);
  });

  it('keeps every achievement, once, and does not change the list it is given', () => {
    const list = [ach('a'), ach('b', '2026-09-01T00:00:00Z'), ach('c')];
    const copy = list.slice();
    const out = listOrder(list, { c: p(1, 2) });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((x) => x.id)).size).toBe(3);
    expect(list).toEqual(copy);
  });

  it('copes with no progress at all', () => {
    expect(listOrder([ach('a'), ach('b')], undefined).map((x) => x.id)).toEqual(['a', 'b']);
    expect(listOrder([], {})).toEqual([]);
  });
});

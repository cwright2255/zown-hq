import { ACHIEVEMENTS, BADGES, FACT_FOR_TYPE, evaluateUnlocks } from '../functions/src/unlockRules';

const NONE = {
  finishedWorkouts: 0, bestCalories: 0, streak: 0, level: 1, xp: 0,
  hikeCount: 0, hikeMiles: 0, strenuousHikes: 0, raceFinishes: 0, journeyFinishes: 0,
};
const earn = (facts, have = {}) => evaluateUnlocks({
  facts: { ...NONE, ...facts },
  unlockedAchievements: have.achievements || [],
  unlockedBadges: have.badges || [],
});

// The ids of one ladder's rungs up to a target, in the list's order: what a person with that much of the fact has earned from the ladder.
const upTo = (type, n) => ACHIEVEMENTS.filter((a) => a.type === type && a.target <= n).map((a) => a.id);

describe('what the lists hold', () => {
  it('has the 300 achievements and the six earnable badges, each once', () => {
    expect(ACHIEVEMENTS).toHaveLength(300);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(300);
    expect(BADGES.map((b) => b.id)).toEqual(['badge-1', 'badge-11', 'badge-12', 'badge-13', 'badge-14', 'badge-15']);
  });

  it('has ten ladders, each kind of progress read from a fact the server gathers', () => {
    const types = [...new Set(ACHIEVEMENTS.map((a) => a.type))];
    expect(types).toHaveLength(10);
    types.forEach((type) => expect(FACT_FOR_TYPE[type]).toBeDefined());
    ACHIEVEMENTS.forEach((a) => expect(Number.isInteger(a.target) && a.target > 0).toBe(true));
  });

  it('climbs: each ladder asks for more at each rung', () => {
    [...new Set(ACHIEVEMENTS.map((a) => a.type))].forEach((type) => {
      const targets = ACHIEVEMENTS.filter((a) => a.type === type).map((a) => a.target);
      targets.forEach((t, i) => i > 0 && expect(t).toBeGreaterThan(targets[i - 1]));
    });
  });

  it('gives nothing to a person with no progress', () => {
    expect(earn({})).toEqual({ achievements: [], badges: [] });
  });
});

describe('achievements', () => {
  const withFact = ACHIEVEMENTS.filter((a) => FACT_FOR_TYPE[a.type]);

  it.each(withFact.map((a) => [a.id, a]))('%s is earned at its target and not one short of it', (id, a) => {
    const fact = FACT_FOR_TYPE[a.type];
    expect(earn({ [fact]: a.target - 1 }).achievements).not.toContain(id);
    expect(earn({ [fact]: a.target }).achievements).toContain(id);
    expect(earn({ [fact]: a.target + 1000 }).achievements).toContain(id);
  });

  it('asks for the right kind of progress: each fact earns the rungs of its own ladder up to it, and no other', () => {
    expect(earn({ finishedWorkouts: 10 }).achievements).toEqual(upTo('workout_count', 10));
    expect(earn({ finishedWorkouts: 10 }).achievements).toEqual(expect.arrayContaining(['first-workout', 'workouts-10']));
    expect(earn({ streak: 7 }).achievements).toEqual(upTo('streak', 7));
    expect(earn({ streak: 7 }).achievements).toContain('workout-streak-7');
    expect(earn({ streak: 30 }).achievements).toEqual(expect.arrayContaining(['workout-streak-7', 'workout-streak-30']));
    expect(earn({ bestCalories: 1000 }).achievements).toEqual(upTo('calories_burned', 1000));
    expect(earn({ bestCalories: 1000 }).achievements).toContain('calories-1000');
    expect(earn({ level: 10 }).achievements).toEqual(upTo('level', 10));
    expect(earn({ level: 10 }).achievements).toEqual(expect.arrayContaining(['level-5', 'level-10']));
    expect(earn({ xp: 5000 }).achievements).toEqual(upTo('xp', 5000));
    expect(earn({ xp: 5000 }).achievements).toEqual(expect.arrayContaining(['xp-1000', 'xp-5000']));
  });

  it('asks for the right kind of progress for hikes, races and journeys too', () => {
    expect(earn({ hikeCount: 5 }).achievements).toEqual(upTo('hike_count', 5));
    expect(earn({ hikeMiles: 10 }).achievements).toEqual(upTo('hike_miles', 10));
    expect(earn({ hikeMiles: 9.99 }).achievements).toEqual(upTo('hike_miles', 9));
    expect(earn({ strenuousHikes: 3 }).achievements).toEqual(upTo('strenuous_hikes', 3));
    expect(earn({ raceFinishes: 5 }).achievements).toEqual(upTo('race_finishes', 5));
    expect(earn({ journeyFinishes: 2 }).achievements).toEqual(upTo('journey_finishes', 2));
    expect(earn({ hikeCount: 1 }).achievements).toEqual(['hikes-1']);
    expect(earn({ raceFinishes: 1 }).achievements).toEqual(['races-1']);
  });

  it('is not earned by another kind of progress', () => {
    expect(earn({ streak: 99, level: 99, xp: 999999, bestCalories: 99999 }).achievements).not.toContain('first-workout');
    expect(earn({ finishedWorkouts: 99, level: 99 }).achievements).not.toContain('workout-streak-7');
    expect(earn({ finishedWorkouts: 99, streak: 99, xp: 99999 }).achievements).not.toContain('level-5');
    expect(earn({ finishedWorkouts: 99, streak: 99, level: 99 }).achievements).not.toContain('xp-1000');
    expect(earn({ finishedWorkouts: 99, streak: 99, level: 99, xp: 99999 }).achievements).not.toContain('calories-1000');
    expect(earn({ hikeCount: 500, hikeMiles: 9999, strenuousHikes: 500 }).achievements.filter((id) => /^(workouts|first|level|xp|races|journeys)/.test(id))).toEqual([]);
  });

  it('earns all 300 for a person with enough of everything, and none of them is out of reach', () => {
    const everything = {
      finishedWorkouts: 99999, bestCalories: 99999, streak: 400, level: 100, xp: 99999999,
      hikeCount: 9999, hikeMiles: 99999, strenuousHikes: 9999, raceFinishes: 9999, journeyFinishes: 9999,
    };
    const { achievements } = earn(everything);
    expect(achievements).toEqual(ACHIEVEMENTS.map((a) => a.id));
    expect(achievements).toHaveLength(300);
  });

  it('does not earn the four the app never fed anything (weight lost, nutrition days, social, morning workouts): they are not in the list', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    ['weight-loss-5', 'nutrition-streak-7', 'social-butterfly', 'early-bird'].forEach((id) => expect(ids).not.toContain(id));
    const { achievements } = earn({ weightLost: 99, nutritionLogged: 99, socialInteractions: 99, morningWorkouts: 99 });
    expect(achievements).toEqual([]);
  });

  it('does not give one again that is already unlocked, and gives the rest', () => {
    const r = earn({ finishedWorkouts: 50 }, { achievements: ['first-workout', 'workouts-10'] });
    expect(r.achievements).toEqual(upTo('workout_count', 50).filter((id) => id !== 'first-workout' && id !== 'workouts-10'));
    expect(r.achievements).toContain('workouts-50');
    expect(r.achievements).not.toContain('workouts-10');
  });

  it('gives nothing new when everything it has earned is unlocked', () => {
    const r = earn({ finishedWorkouts: 10 }, { achievements: upTo('workout_count', 10) });
    expect(r.achievements).toEqual([]);
  });

  it('gives one more rung when the fact reaches the next target', () => {
    const have = { achievements: upTo('workout_count', 10) };
    const next = ACHIEVEMENTS.filter((a) => a.type === 'workout_count').find((a) => a.target > 10);
    expect(earn({ finishedWorkouts: next.target - 1 }, have).achievements).toEqual([]);
    expect(earn({ finishedWorkouts: next.target }, have).achievements).toEqual([next.id]);
  });

  it('keeps the order of the list', () => {
    const ids = earn({ finishedWorkouts: 100, streak: 30, level: 10, xp: 5000, bestCalories: 1000 }).achievements;
    expect(ids).toEqual(ACHIEVEMENTS.map((a) => a.id).filter((id) => ids.includes(id)));
  });
});

describe('badges', () => {
  it('earns the first workout badge with the first finished workout', () => {
    expect(earn({ finishedWorkouts: 0 }).badges).toEqual([]);
    expect(earn({ finishedWorkouts: 1 }).badges).toEqual(['badge-1']);
  });

  it('earns First Trail with a first hike', () => {
    expect(earn({ hikeCount: 0 }).badges).toEqual([]);
    expect(earn({ hikeCount: 1 }).badges).toEqual(['badge-11']);
  });

  it('earns Strenuous Summit only from a hike rated Strenuous or harder', () => {
    expect(earn({ hikeCount: 3, strenuousHikes: 0 }).badges).toEqual(['badge-11']);
    expect(earn({ hikeCount: 1, strenuousHikes: 1 }).badges).toEqual(['badge-11', 'badge-12']);
  });

  it('earns Trail Blazer at 10 miles, not 9.99', () => {
    expect(earn({ hikeMiles: 9.99 }).badges).toEqual([]);
    expect(earn({ hikeMiles: 10 }).badges).toEqual(['badge-13']);
  });

  it('earns Race Day and Trailblazer from a race and a journey finished', () => {
    expect(earn({ raceFinishes: 1 }).badges).toEqual(['badge-14']);
    expect(earn({ journeyFinishes: 1 }).badges).toEqual(['badge-15']);
    expect(earn({ raceFinishes: 1, journeyFinishes: 1 }).badges).toEqual(['badge-14', 'badge-15']);
  });

  it('is never earned by level, streak or xp (nothing in the app ever earned the other badges that way)', () => {
    expect(earn({ level: 100, streak: 365, xp: 5000000 }).badges).toEqual([]);
  });

  it('does not give one again that is already unlocked', () => {
    const r = earn({ finishedWorkouts: 5, hikeCount: 2, raceFinishes: 1 }, { badges: ['badge-1', 'badge-14'] });
    expect(r.badges).toEqual(['badge-11']);
  });
});

describe('facts that are missing or wrong', () => {
  it('earns nothing from a fact that is missing, not a number, or not finite', () => {
    const r = evaluateUnlocks({ facts: { finishedWorkouts: '100', level: NaN, xp: Infinity, streak: null, hikeCount: undefined, bestCalories: true } });
    expect(r).toEqual({ achievements: [], badges: [] });
  });

  it('copes with nothing at all', () => {
    expect(evaluateUnlocks()).toEqual({ achievements: [], badges: [] });
    expect(evaluateUnlocks({})).toEqual({ achievements: [], badges: [] });
    expect(evaluateUnlocks({ facts: null })).toEqual({ achievements: [], badges: [] });
  });
});

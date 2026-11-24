// lib/achievementCatalogue.js: the 300 achievements, built from ten ladders. The server's list (functions/src/unlockRules.js) is checked against
// this one in unlockRulesParity.test.js; these look at the list itself.
import {
  ACHIEVEMENT_CATALOGUE, ACHIEVEMENT_COUNT, ACHIEVEMENT_TYPES, LADDERS, LADDER_TOTAL, metalFor, newCatalogue, xpRewardFor,
} from '../lib/achievementCatalogue';
import { FRAME_IDS, METAL_IDS } from '../lib/badgeFrames';
import { ACHIEVEMENT_TITLES } from '../lib/badgeTitles';
import { SPORT_ICONS, getSportIcon } from '../lib/sportIcons';

const ladderOf = (ladder) => ACHIEVEMENT_CATALOGUE.filter((a) => a.condition.type === ladder.type);
const CATEGORIES = ['workout', 'streak', 'level', 'xp', 'hiking', 'racing'];

describe('the list', () => {
  it('has 300 achievements', () => {
    expect(ACHIEVEMENT_COUNT).toBe(300);
    expect(ACHIEVEMENT_CATALOGUE).toHaveLength(300);
    expect(LADDER_TOTAL).toBe(300);
  });

  it('is ten ladders, each of a kind the server can count', () => {
    expect(LADDERS).toHaveLength(10);
    expect(new Set(ACHIEVEMENT_TYPES).size).toBe(10);
    expect([...ACHIEVEMENT_TYPES].sort()).toEqual([
      'calories_burned', 'hike_count', 'hike_miles', 'journey_finishes', 'level', 'race_finishes', 'streak', 'strenuous_hikes', 'workout_count', 'xp',
    ]);
    expect(LADDERS.reduce((n, l) => n + l.targets.length, 0)).toBe(300);
  });

  it('gives every achievement a different id, name and description', () => {
    for (const key of ['id', 'name', 'description']) expect(new Set(ACHIEVEMENT_CATALOGUE.map((a) => a[key])).size).toBe(300);
  });

  it('gives every achievement what the screens show: a name, a description, a category, an XP reward and what it asks for', () => {
    ACHIEVEMENT_CATALOGUE.forEach((a) => {
      expect(a.name.trim().length).toBeGreaterThan(3);
      expect(a.description.trim().length).toBeGreaterThan(8);
      expect(CATEGORIES).toContain(a.category);
      expect(Number.isInteger(a.xpReward)).toBe(true);
      expect(a.xpReward).toBeGreaterThanOrEqual(40);
      expect(a.xpReward).toBeLessThanOrEqual(2000);
      expect(ACHIEVEMENT_TYPES).toContain(a.condition.type);
      expect(Number.isInteger(a.condition.target)).toBe(true);
      expect(a.condition.target).toBeGreaterThan(0);
      expect(a.unlockedAt).toBeUndefined();
    });
  });

  it('says in its description the number it asks for (the first workout says "first")', () => {
    ACHIEVEMENT_CATALOGUE.filter((a) => a.id !== 'first-workout').forEach((a) => {
      expect(a.description.replace(/,/g, '')).toMatch(new RegExp(`\\b${a.condition.target}\\b`));
    });
  });
});

describe('the ladders', () => {
  it('climb: each rung asks for more than the one before, and none is asked twice', () => {
    LADDERS.forEach((ladder) => {
      const targets = ladderOf(ladder).map((a) => a.condition.target);
      expect(targets).toEqual([...ladder.targets]);
      targets.forEach((t, i) => i > 0 && expect(t).toBeGreaterThan(targets[i - 1]));
    });
  });

  it('keep to what the app can really count: a streak never past the 400 days the ledger keeps, a level never past 100', () => {
    const streak = ladderOf(LADDERS.find((l) => l.type === 'streak'));
    const level = ladderOf(LADDERS.find((l) => l.type === 'level'));
    expect(Math.max(...streak.map((a) => a.condition.target))).toBe(400);
    expect(Math.max(...level.map((a) => a.condition.target))).toBe(100);
    expect(Math.min(...level.map((a) => a.condition.target))).toBeGreaterThanOrEqual(2);
  });

  it('are in order in the list, one ladder after another', () => {
    const order = ACHIEVEMENT_CATALOGUE.map((a) => a.condition.type);
    const runs = order.filter((t, i) => i === 0 || t !== order[i - 1]);
    expect(runs).toEqual(LADDERS.map((l) => l.type));
  });

  it('give an id from the ladder\'s own name and the target, the very first workout being first-workout', () => {
    LADDERS.forEach((ladder) => {
      ladderOf(ladder).forEach((a, i) => {
        const expected = i === 0 && ladder.firstId ? ladder.firstId : `${ladder.idPrefix}-${a.condition.target}`;
        expect(a.id).toBe(expected);
      });
    });
    expect(ACHIEVEMENT_CATALOGUE[0].id).toBe('first-workout');
    expect(ACHIEVEMENT_CATALOGUE.find((a) => a.id === 'hike-miles-100').condition).toEqual({ type: 'hike_miles', target: 100 });
  });
});

describe('what a person had earned before', () => {
  // The eleven achievements the app had before keep the ids, descriptions, targets and rewards they had. (An unlock is the id and the time,
  // so what was earned stays earned; the names are new, see badgeTitles.test.js.)
  const OLD = [
    ['first-workout', 'Complete your first workout', 'workout_count', 1, 50],
    ['workout-streak-7', 'Maintain a 7-day workout streak', 'streak', 7, 200],
    ['workout-streak-30', 'Maintain a 30-day workout streak', 'streak', 30, 500],
    ['calories-1000', 'Burn 1000 calories in a single workout', 'calories_burned', 1000, 150],
    ['workouts-10', 'Complete 10 workouts', 'workout_count', 10, 300],
    ['workouts-50', 'Complete 50 workouts', 'workout_count', 50, 750],
    ['workouts-100', 'Complete 100 workouts', 'workout_count', 100, 1500],
    ['level-5', 'Reach level 5', 'level', 5, 250],
    ['level-10', 'Reach level 10', 'level', 10, 500],
    ['xp-1000', 'Earn 1000 XP', 'xp', 1000, 100],
    ['xp-5000', 'Earn 5000 XP', 'xp', 5000, 300],
  ];

  it.each(OLD)('keeps %s, with the description, target and reward it had', (id, description, type, target, xpReward) => {
    const a = ACHIEVEMENT_CATALOGUE.find((x) => x.id === id);
    expect(a).toBeDefined();
    expect(a.description).toBe(description);
    expect(a.condition).toEqual({ type, target });
    expect(a.xpReward).toBe(xpReward);
  });

  it('has all eleven, so what a person has already earned stays earned', () => {
    const ids = new Set(ACHIEVEMENT_CATALOGUE.map((a) => a.id));
    expect(OLD).toHaveLength(11);
    OLD.forEach(([id]) => expect(ids.has(id)).toBe(true));
  });
});

describe('the badges', () => {
  it('are a ring frame, a metal and a sports icon that all exist', () => {
    ACHIEVEMENT_CATALOGUE.forEach((a) => {
      expect(FRAME_IDS).toContain(a.badge.frame);
      expect(METAL_IDS).toContain(a.badge.metal);
      expect(getSportIcon(a.badge.icon)).toBeTruthy();
    });
  });

  it('are all different: no two achievements have the same frame, metal and icon', () => {
    expect(new Set(ACHIEVEMENT_CATALOGUE.map((a) => `${a.badge.frame}|${a.badge.metal}|${a.badge.icon}`)).size).toBe(300);
  });

  it('use every one of the icons, the last 16 achievements sharing an icon (with another frame or metal)', () => {
    const used = ACHIEVEMENT_CATALOGUE.map((a) => a.badge.icon);
    expect(new Set(used).size).toBe(SPORT_ICONS.length);
    expect(300 - new Set(used).size).toBe(16);
  });

  it('use every frame and every metal', () => {
    expect(new Set(ACHIEVEMENT_CATALOGUE.map((a) => a.badge.frame))).toEqual(new Set(FRAME_IDS));
    expect(new Set(ACHIEVEMENT_CATALOGUE.map((a) => a.badge.metal))).toEqual(new Set(METAL_IDS));
  });

  it('go from bronze to silver to gold up each ladder, so the metal says how far along it is', () => {
    const rank = { bronze: 0, silver: 1, gold: 2 };
    LADDERS.forEach((ladder) => {
      const metals = ladderOf(ladder).map((a) => a.badge.metal);
      metals.forEach((m, i) => i > 0 && expect(rank[m]).toBeGreaterThanOrEqual(rank[metals[i - 1]]));
      expect(metals[0]).toBe('bronze');
      expect(metals[metals.length - 1]).toBe('gold');
      expect(new Set(metals).size).toBe(3);
    });
  });

  it('draw a ladder\'s neighbouring rungs in different frames', () => {
    LADDERS.forEach((ladder) => {
      const frames = ladderOf(ladder).map((a) => a.badge.frame);
      frames.forEach((f, i) => i > 0 && expect(f).not.toBe(frames[i - 1]));
    });
  });

  it('are named from the hand-written titles, one for each achievement', () => {
    ACHIEVEMENT_CATALOGUE.forEach((a) => expect(a.name).toBe(ACHIEVEMENT_TITLES[a.id]));
    expect(ACHIEVEMENT_CATALOGUE.find((a) => a.id === 'workouts-70').name).toBe('Seventy and Climbing');
    expect(ACHIEVEMENT_CATALOGUE.find((a) => a.id === 'hikes-3').name).toBe("Third Trail's a Charm");
  });
});

describe('metalFor', () => {
  it('makes the first 40% of a ladder bronze, the next 35% silver and the last 25% gold', () => {
    const metals = Array.from({ length: 100 }, (_, i) => metalFor(i, 100));
    expect(metals.filter((m) => m === 'bronze')).toHaveLength(40);
    expect(metals.filter((m) => m === 'silver')).toHaveLength(35);
    expect(metals.filter((m) => m === 'gold')).toHaveLength(25);
  });

  it('puts a ladder of one rung in bronze, and the two ends of any ladder at bronze and gold', () => {
    expect(metalFor(0, 1)).toBe('bronze');
    expect(metalFor(0, 8)).toBe('bronze');
    expect(metalFor(7, 8)).toBe('gold');
  });
});

describe('xpRewardFor', () => {
  it('grows from 40 for the first rung to 2000 for the last, in tens', () => {
    expect(xpRewardFor(0, 30)).toBe(40);
    expect(xpRewardFor(29, 30)).toBe(2000);
    for (let i = 0; i < 30; i += 1) {
      expect(xpRewardFor(i, 30) % 10).toBe(0);
      if (i > 0) expect(xpRewardFor(i, 30)).toBeGreaterThanOrEqual(xpRewardFor(i - 1, 30));
    }
  });

  it('gives a ladder of one rung the first rung\'s reward', () => {
    expect(xpRewardFor(0, 1)).toBe(40);
  });
});

describe('newCatalogue', () => {
  it('gives a copy every time: changing one never changes the list or another copy', () => {
    const a = newCatalogue();
    const b = newCatalogue();
    expect(a).toEqual(ACHIEVEMENT_CATALOGUE);
    expect(a).not.toBe(ACHIEVEMENT_CATALOGUE);
    a[0].name = 'Changed';
    a[0].condition.target = 99;
    a[0].badge.metal = 'gold';
    expect(b[0].name).toBe('Squat Goals');
    expect(ACHIEVEMENT_CATALOGUE[0].condition.target).toBe(1);
    expect(ACHIEVEMENT_CATALOGUE[0].badge.metal).toBe('bronze');
  });
});

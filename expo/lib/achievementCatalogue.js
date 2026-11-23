// lib/achievementCatalogue.js
//
// The 300 achievements, built from ten ladders. Each ladder is one thing the app really counts (workouts finished, days of streak, the
// most calories in one workout, level, total XP, hikes, hike miles, strenuous hikes, races and journeys finished) with the targets a person
// climbs through, from the first rung to the one almost nobody reaches. The server decides every unlock from the same ten facts
// (functions/src/unlockRules.js lists the same ids, kinds and targets, and __tests__/unlockRulesParity.test.js fails when the two differ).
//
// Each achievement also has its badge: a ring frame (lib/badgeFrames.js), a metal (bronze for the early rungs of its ladder, silver in the
// middle, gold for the hardest) and a sports icon (lib/sportIcons.js) chosen to suit what the ladder counts. Pure functions and data,
// no React, no Firebase.
import { FRAME_IDS } from './badgeFrames';
import { SPORT_ICONS } from './sportIcons';

export const ACHIEVEMENT_COUNT = 300;

// Eleven of the achievements the app had before keep their ids, names and descriptions, so what a person has already earned stays earned.
const KEPT = {
  'first-workout': { name: 'First Steps', description: 'Complete your first workout', xpReward: 50 },
  'workout-streak-7': { name: 'Week Warrior', description: 'Maintain a 7-day workout streak', xpReward: 200 },
  'workout-streak-30': { name: 'Monthly Master', description: 'Maintain a 30-day workout streak', xpReward: 500 },
  'calories-1000': { name: 'Calorie Crusher', description: 'Burn 1000 calories in a single workout', xpReward: 150 },
  'workouts-10': { name: 'Dedicated Athlete', description: 'Complete 10 workouts', xpReward: 300 },
  'workouts-50': { name: 'Fitness Enthusiast', description: 'Complete 50 workouts', xpReward: 750 },
  'workouts-100': { name: 'Fitness Legend', description: 'Complete 100 workouts', xpReward: 1500 },
  'level-5': { name: 'Rising Star', description: 'Reach level 5', xpReward: 250 },
  'level-10': { name: 'Elite Athlete', description: 'Reach level 10', xpReward: 500 },
  'xp-1000': { name: 'XP Collector', description: 'Earn 1000 XP', xpReward: 100 },
  'xp-5000': { name: 'XP Master', description: 'Earn 5000 XP', xpReward: 300 },
};

const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

// `groups` are the kinds of sports icon that suit the ladder, in the order they are taken (see assignIcons).
export const LADDERS = [
  {
    key: 'workouts', idPrefix: 'workouts', firstId: 'first-workout', type: 'workout_count', category: 'workout',
    groups: ['run', 'lift', 'gym', 'track', 'gymnastics', 'combat', 'ball', 'racquet', 'team', 'dance', 'mind', 'target', 'water', 'winter', 'swim', 'cycle'],
    targets: [1, 3, 5, 7, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3500, 4000, 4500, 5000, 6000, 7500],
    describe: (n) => `Finish ${plural(n, 'workout', 'workouts')}`,
  },
  {
    key: 'streak', idPrefix: 'workout-streak', type: 'streak', category: 'streak',
    groups: ['run', 'cycle', 'swim', 'gym', 'walk', 'mind', 'dance'],
    targets: [2, 3, 4, 5, 6, 7, 9, 10, 12, 14, 15, 18, 20, 21, 25, 28, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100, 120, 150, 180, 200, 250, 300, 330, 365, 400],
    describe: (n) => `Keep a ${n}-day workout streak`,
  },
  {
    key: 'calories', idPrefix: 'calories', type: 'calories_burned', category: 'workout',
    groups: ['combat', 'lift', 'gym', 'cycle', 'track', 'run'],
    targets: [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1750, 2000, 2250, 2500, 3000],
    describe: (n) => `Burn ${n.toLocaleString('en-US')} calories in a single workout`,
  },
  {
    key: 'level', idPrefix: 'level', type: 'level', category: 'level',
    groups: ['team', 'ball', 'gymnastics', 'racquet', 'target', 'dance'],
    targets: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 24, 25, 28, 30, 32, 35, 38, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 88, 90, 92, 95, 97, 99, 100],
    describe: (n) => `Reach level ${n}`,
  },
  {
    key: 'xp', idPrefix: 'xp', type: 'xp', category: 'xp',
    groups: ['target', 'lift', 'water', 'winter', 'ball', 'racquet', 'gymnastics'],
    targets: [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 70000, 80000, 90000, 100000, 125000, 150000, 175000, 200000, 225000, 250000, 275000, 300000, 325000, 350000, 400000, 450000, 500000, 550000, 600000],
    describe: (n) => `Earn ${n.toLocaleString('en-US')} XP`,
  },
  {
    key: 'hikes', idPrefix: 'hikes', type: 'hike_count', category: 'hiking',
    groups: ['walk', 'climb', 'winter', 'horse', 'air'],
    targets: [1, 2, 3, 4, 5, 7, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100, 125, 150, 175, 200, 250, 300, 365],
    describe: (n) => `Record ${plural(n, 'hike', 'hikes')}`,
  },
  {
    key: 'hike-miles', idPrefix: 'hike-miles', type: 'hike_miles', category: 'hiking',
    groups: ['walk', 'winter', 'run', 'climb', 'board', 'track'],
    targets: [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000],
    describe: (n) => `Hike ${plural(n, 'mile', 'miles')} in total`,
  },
  {
    key: 'strenuous', idPrefix: 'strenuous-hikes', type: 'strenuous_hikes', category: 'hiking',
    groups: ['climb', 'walk', 'winter', 'lift', 'combat'],
    targets: [1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150],
    describe: (n) => `Finish ${plural(n, 'strenuous hike', 'strenuous hikes')}`,
  },
  {
    key: 'races', idPrefix: 'races', type: 'race_finishes', category: 'racing',
    groups: ['run', 'track', 'cycle', 'swim'],
    targets: [1, 2, 3, 5, 10, 15, 25, 50],
    describe: (n) => `Finish ${plural(n, 'virtual race', 'virtual races')}`,
  },
  {
    key: 'journeys', idPrefix: 'journeys', type: 'journey_finishes', category: 'racing',
    groups: ['run', 'cycle', 'water', 'walk'],
    targets: [1, 2, 3, 5, 10, 15, 25, 50],
    describe: (n) => `Finish ${plural(n, 'journey', 'journeys')}`,
  },
];

const LADDER_COUNT = LADDERS.reduce((sum, l) => sum + l.targets.length, 0);

// ---- names -----------------------------------------------------------------------------------------------------------------------
// A name is a word for how far along the ladder it is, then the sport on its icon: "Rookie Sprint", "Relentless Pole Vault", "Mythic Judo".
const WORDS = {
  bronze: ['Rookie', 'Fresh', 'Eager', 'Plucky', 'Spirited', 'Keen', 'Ready', 'Humble', 'Scrappy', 'Nimble', 'Brisk', 'Lively', 'Hopeful', 'Bold', 'Steady', 'Willing', 'Gritty', 'Upbeat', 'Hardy', 'Sprightly', 'Earnest', 'Daring', 'Zesty', 'Peppy', 'Dashing', 'Game', 'Swift', 'Eager-Eyed', 'Bright', 'Ambitious'],
  silver: ['Seasoned', 'Driven', 'Relentless', 'Sharp', 'Tireless', 'Focused', 'Fearless', 'Resolute', 'Polished', 'Disciplined', 'Unshaken', 'Tenacious', 'Determined', 'Poised', 'Rugged', 'Dependable', 'Fierce', 'Battle-Tested', 'Veteran', 'Committed', 'Dauntless', 'Steely', 'Crafty', 'Stalwart', 'Sturdy', 'Unyielding', 'Vigilant', 'Strong-Willed', 'Dynamic', 'Spirited-Up'],
  gold: ['Elite', 'Legendary', 'Unstoppable', 'Peerless', 'Iron', 'Titan', 'Mythic', 'Supreme', 'Champion', 'Heroic', 'Apex', 'Immortal', 'Grand', 'Prime', 'Sovereign', 'Invincible', 'Ultimate', 'Golden', 'Royal', 'Unbreakable', 'Masterful', 'Radiant', 'Colossal', 'Flawless', 'Majestic', 'Transcendent', 'Boundless', 'Glorious', 'Fabled', 'Eternal'],
};

/** Which metal a rung is: the first 40% of its ladder is bronze, the next 35% silver, the last 25% gold. */
export function metalFor(index, count) {
  const f = count <= 1 ? 0 : index / (count - 1);
  if (f < 0.4) return 'bronze';
  if (f < 0.75) return 'silver';
  return 'gold';
}

/** The XP a rung is worth: from a little for the first rung to a lot for the last, a rounded curve of its place on the ladder. */
export function xpRewardFor(index, count) {
  const f = count <= 1 ? 0 : index / (count - 1);
  return Math.round((40 + 1960 * f ** 1.6) / 10) * 10;
}

// ---- icons -----------------------------------------------------------------------------------------------------------------------
// Each ladder takes its icons from the kinds of sport that suit it, round and round its list of kinds, and never one another ladder
// has already used while there is one left. The ladders with the fewest suitable icons choose first, and the biggest ladder last; the
// 284 icons are enough for all but the last 16 achievements, which share an icon with an earlier one (they differ in frame and metal).
const ICON_ORDER = ['races', 'journeys', 'strenuous', 'hike-miles', 'hikes', 'calories', 'streak', 'level', 'xp', 'workouts'];

function assignIcons() {
  const used = new Map(); // icon id -> times used
  const byGroup = {};
  SPORT_ICONS.forEach((icon) => {
    (byGroup[icon.group] = byGroup[icon.group] || []).push(icon.id);
  });
  const result = {};
  ICON_ORDER.forEach((key) => {
    const ladder = LADDERS.find((l) => l.key === key);
    const inLadder = new Set();
    result[key] = ladder.targets.map((_, i) => {
      const tryGroups = [...ladder.groups.slice(i % ladder.groups.length), ...ladder.groups.slice(0, i % ladder.groups.length)];
      let pick = null;
      for (let g = 0; g < tryGroups.length && !pick; g += 1) {
        pick = (byGroup[tryGroups[g]] || []).find((id) => !used.has(id));
      }
      if (!pick) pick = SPORT_ICONS.find((icon) => !used.has(icon.id))?.id;
      if (!pick) {
        // Every icon is in use: take the least used one that this ladder has not used yet.
        const least = [...SPORT_ICONS].map((icon) => icon.id).filter((id) => !inLadder.has(id)).sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0));
        pick = least[0];
      }
      used.set(pick, (used.get(pick) || 0) + 1);
      inLadder.add(pick);
      return pick;
    });
  });
  return result;
}

// ---- the list --------------------------------------------------------------------------------------------------------------------
const idFor = (ladder, target) => (ladder.firstId && target === ladder.targets[0] ? ladder.firstId : `${ladder.idPrefix}-${target}`);

function build() {
  const icons = assignIcons();
  const taken = new Set();
  const iconName = Object.fromEntries(SPORT_ICONS.map((icon) => [icon.id, icon.name]));
  const list = [];
  LADDERS.forEach((ladder, ladderIndex) => {
    ladder.targets.forEach((target, i) => {
      const id = idFor(ladder, target);
      const metal = metalFor(i, ladder.targets.length);
      const icon = icons[ladder.key][i];
      const kept = KEPT[id];
      // A name nobody else has: the next word in the metal's list that makes "<word> <sport>" new.
      let name = kept ? kept.name : null;
      if (!name) {
        const words = WORDS[metal];
        for (let w = 0; w < words.length * 3 && !name; w += 1) {
          const word = words[(i + ladderIndex * 7 + w) % words.length];
          const candidate = w < words.length ? `${word} ${iconName[icon]}` : `${word} ${iconName[icon]} ${ladder.key === 'workouts' ? 'Club' : 'Run'}`;
          if (!taken.has(candidate)) name = candidate;
        }
      }
      taken.add(name);
      list.push({
        id,
        name,
        description: kept ? kept.description : ladder.describe(target),
        category: ladder.category,
        xpReward: kept ? kept.xpReward : xpRewardFor(i, ladder.targets.length),
        condition: { type: ladder.type, target },
        badge: { frame: FRAME_IDS[(i + ladderIndex * 3) % FRAME_IDS.length], metal, icon },
        unlockedAt: undefined,
      });
    });
  });
  return list;
}

export const ACHIEVEMENT_CATALOGUE = build();

/** The kinds of progress the catalogue asks for, each with a fact the server counts: the ten ladders' types. */
export const ACHIEVEMENT_TYPES = LADDERS.map((l) => l.type);

/** A fresh copy of the catalogue, for a store to start from. */
export const newCatalogue = () => ACHIEVEMENT_CATALOGUE.map((a) => ({ ...a, condition: { ...a.condition }, badge: { ...a.badge } }));

export const LADDER_TOTAL = LADDER_COUNT;

// The achievements and badges are decided on the server (functions/src/unlockRules.js), and the phone shows them from its own catalogs
// (store/achievementStore.js, store/badgeStore.js) and its own Battle Pass screen (app/battlepass.jsx). These check the two sides agree: the
// same achievements with the same kind of progress and target, badges the phone has, and as many Battle Pass tiers as the server will claim.
const fs = require('fs');
const path = require('path');

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { useAchievementStore } from '../store/achievementStore';
import { useBadgeStore } from '../store/badgeStore';
import { ACHIEVEMENTS, BADGES, FACT_FOR_TYPE } from '../functions/src/unlockRules';
import { BATTLE_PASS_TIERS } from '../functions/src/unlocks';
import { TIER_REWARDS } from '../lib/battlePassTiers';
import { ACHIEVEMENT_CATALOGUE, ACHIEVEMENT_TYPES } from '../lib/achievementCatalogue';

describe('achievements', () => {
  const phone = useAchievementStore.getState().achievements;

  it('are the same list on the phone and on the server, in the same order, with the same kind and target', () => {
    expect(phone.map((a) => ({ id: a.id, type: a.condition.type, target: a.condition.target }))).toEqual(ACHIEVEMENTS);
  });

  it('are given a fact on the server for every kind of progress the list asks for', () => {
    const types = [...new Set(ACHIEVEMENT_CATALOGUE.map((a) => a.condition.type))];
    expect(types.sort()).toEqual([...ACHIEVEMENT_TYPES].sort());
    types.forEach((type) => expect(FACT_FOR_TYPE[type]).toBeDefined());
    // and nothing in the server's map is a kind the app never asks for
    expect(Object.keys(FACT_FOR_TYPE).sort()).toEqual(types.sort());
  });

  it('are all earnable: every kind reads a fact the server gathers', () => {
    const gathered = ['finishedWorkouts', 'bestCalories', 'streak', 'level', 'xp', 'hikeCount', 'hikeMiles', 'strenuousHikes', 'raceFinishes', 'journeyFinishes'];
    ACHIEVEMENTS.forEach((a) => expect(gathered).toContain(FACT_FOR_TYPE[a.type]));
  });

  it('are 300 on both sides, with no id used twice', () => {
    expect(phone).toHaveLength(300);
    expect(ACHIEVEMENTS).toHaveLength(300);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(300);
  });
});

describe('badges', () => {
  it('the server earns only badges the phone has in its catalog', () => {
    const store = useBadgeStore.getState();
    store.initializeDefaultBadges();
    const known = useBadgeStore.getState().badges.map((b) => b.id);
    BADGES.forEach((b) => expect(known).toContain(b.id));
  });
});

describe('the Battle Pass', () => {
  it('has as many tiers on the screen as the server will let a person claim', () => {
    expect(TIER_REWARDS.map((r) => r.t)).toEqual(Array.from({ length: BATTLE_PASS_TIERS }, (_, i) => i + 1));
  });

  it('is drawn from that list by the screen, not from a copy of it', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'battlepass.jsx'), 'utf8');
    expect(source).toContain("from '@/lib/battlePassTiers'");
    expect(source).not.toContain('const TIER_REWARDS = [');
  });
});

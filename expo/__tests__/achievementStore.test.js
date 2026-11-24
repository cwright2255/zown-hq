// store/achievementStore.js: the achievement catalog, showing what the server says is unlocked. The server decides (functions/src/unlocks.js);
// nothing here does, and nothing here writes.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAchievementStore } from '../store/achievementStore';
import { FRAME_IDS, METAL_IDS } from '../lib/badgeFrames';
import { getSportIcon } from '../lib/sportIcons';

const store = () => useAchievementStore.getState();
const byId = (id) => store().achievements.find((a) => a.id === id);
const CATALOG_SIZE = store().achievements.length;
const UNLOCKED = { 'first-workout': '2026-09-01T00:00:00Z', 'level-5': '2026-10-14T10:00:00Z' };

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  [doc, getDoc, setDoc].forEach((fn) => fn.mockClear());
  getDoc.mockResolvedValue({ exists: () => false });
  store().clearServerUnlocks();
});
afterEach(() => warn.mockRestore());

describe('the achievement catalog', () => {
  it('has 300 achievements, none unlocked to begin with', () => {
    expect(CATALOG_SIZE).toBe(300);
    expect(store().unlockedAchievements).toEqual([]);
    expect(store().getUnlockedAchievements()).toEqual([]);
    expect(store().getLockedAchievements()).toHaveLength(300);
  });

  it('gives each one a badge to draw: a ring frame, a metal and a sports icon', () => {
    store().achievements.forEach((a) => {
      expect(FRAME_IDS).toContain(a.badge.frame);
      expect(METAL_IDS).toContain(a.badge.metal);
      expect(getSportIcon(a.badge.icon)).toBeTruthy();
    });
  });

  it('has no way to unlock one on the phone: the server decides, and the store only shows', () => {
    expect(store().checkAchievements).toBeUndefined();
    expect(store().unlockAchievement).toBeUndefined();
    expect(store().updateAchievementProgress).toBeUndefined();
    expect(store()._syncUnlocksToFirestore).toBeUndefined();
  });
});

describe('achievements unlocked on the server', () => {
  it('shows what the server says is unlocked, with the time', () => {
    store().applyServerUnlocks(UNLOCKED);
    expect(store().unlockedAchievements.sort()).toEqual(['first-workout', 'level-5']);
    expect(byId('first-workout').unlockedAt).toBe('2026-09-01T00:00:00Z');
    expect(byId('level-5').unlockedAt).toBe('2026-10-14T10:00:00Z');
    expect(byId('level-10').unlockedAt).toBeUndefined();
    expect(store().getUnlockedAchievements().map((a) => a.id).sort()).toEqual(['first-workout', 'level-5']);
    expect(store().getLockedAchievements()).toHaveLength(CATALOG_SIZE - 2);
  });

  it('keeps the whole catalog', () => {
    store().applyServerUnlocks(UNLOCKED);
    expect(store().achievements).toHaveLength(CATALOG_SIZE);
    expect(byId('workouts-10').condition).toEqual({ type: 'workout_count', target: 10 });
  });

  it('puts what the server says in place of what the phone held, so one the server does not list is locked again', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().applyServerUnlocks({ 'level-5': '2026-10-14T10:00:00Z' });
    expect(store().unlockedAchievements).toEqual(['level-5']);
    expect(byId('first-workout').unlockedAt).toBeUndefined();
  });

  it('unlocks none for a missing, empty or wrong sort of answer', () => {
    [undefined, null, {}, [], ['first-workout'], 'x', 7].forEach((value) => {
      store().applyServerUnlocks(UNLOCKED);
      store().applyServerUnlocks(value);
      expect(store().unlockedAchievements).toEqual([]);
      expect(store().getUnlockedAchievements()).toEqual([]);
    });
  });

  it('ignores an entry with no time', () => {
    store().applyServerUnlocks({ 'first-workout': '', 'level-5': '2026-10-14T10:00:00Z' });
    expect(store().unlockedAchievements).toEqual(['level-5']);
    expect(byId('first-workout').unlockedAt).toBeUndefined();
  });

  it('is cleared when the person signs out, and the catalog stays whole', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().clearServerUnlocks();
    expect(store().unlockedAchievements).toEqual([]);
    expect(store().achievements).toHaveLength(CATALOG_SIZE);
    expect(store().achievements.every((a) => a.unlockedAt === undefined)).toBe(true);
  });

  it('never writes an achievement: nothing on the phone can', () => {
    store().applyServerUnlocks(UNLOCKED);
    store().clearServerUnlocks();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('loadAchievements', () => {
  it('reads the person\'s own achievements document and shows it', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ unlocked: UNLOCKED }) });
    await store().loadAchievements('u1');
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'users', 'u1', 'data', 'achievements');
    expect(store().unlockedAchievements.sort()).toEqual(['first-workout', 'level-5']);
  });

  it('puts what the server says in place of what the phone held', async () => {
    store().applyServerUnlocks(UNLOCKED);
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ unlocked: { 'xp-1000': '2026-10-20T00:00:00Z' } }) });
    await store().loadAchievements('u1');
    expect(store().unlockedAchievements).toEqual(['xp-1000']);
  });

  it('leaves what is shown alone when there is no document, or it cannot be read (and says so for the second)', async () => {
    store().applyServerUnlocks(UNLOCKED);
    await store().loadAchievements('u1');
    expect(store().unlockedAchievements).toHaveLength(2);
    expect(warn).not.toHaveBeenCalled(); // a missing document is not an error
    getDoc.mockRejectedValue(new Error('offline'));
    await store().loadAchievements('u1');
    expect(store().unlockedAchievements).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith('[achievementStore] loadAchievements error:', 'offline');
  });

  it('does nothing without a person', async () => {
    await store().loadAchievements('');
    await store().loadAchievements(undefined);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('what is kept on the phone', () => {
  const { partialize, merge } = useAchievementStore.persist.getOptions();
  const fresh = () => ({ ...useAchievementStore.getState(), achievements: useAchievementStore.getState().achievements.map((a) => ({ ...a, unlockedAt: undefined })), unlockedAchievements: [] });

  it('is only the ids and times of what is unlocked, not the catalog', () => {
    store().applyServerUnlocks(UNLOCKED);
    expect(partialize(store())).toEqual({ unlockedAchievements: expect.any(Array), unlockedAt: UNLOCKED });
    expect(Object.keys(partialize(store())).sort()).toEqual(['unlockedAchievements', 'unlockedAt']);
  });

  it('is read back onto the catalog', () => {
    const merged = merge({ unlockedAchievements: ['level-5'], unlockedAt: { 'level-5': '2026-10-14T10:00:00Z' } }, fresh());
    expect(merged.achievements).toHaveLength(CATALOG_SIZE);
    expect(merged.unlockedAchievements).toEqual(['level-5']);
    expect(merged.achievements.find((a) => a.id === 'level-5').unlockedAt).toBe('2026-10-14T10:00:00Z');
    expect(merged.achievements.find((a) => a.id === 'level-10').unlockedAt).toBeUndefined();
  });

  it('brings the new catalog to a phone that saved the old list of fifteen, keeping its unlock times', () => {
    const old = {
      achievements: [
        { id: 'first-workout', name: 'First Steps', icon: '🏃', unlockedAt: '2026-09-01T00:00:00Z' },
        { id: 'level-5', name: 'Rising Star', icon: '⭐', unlockedAt: '2026-10-14T10:00:00Z' },
        { id: 'workouts-10', name: 'Getting Serious', icon: '💪' },
      ],
      unlockedAchievements: ['first-workout', 'level-5'],
    };
    const merged = merge(old, fresh());
    expect(merged.achievements).toHaveLength(CATALOG_SIZE);
    expect(merged.achievements.every((a) => a.badge && a.badge.frame)).toBe(true);
    expect(merged.unlockedAchievements.sort()).toEqual(['first-workout', 'level-5']);
    expect(merged.achievements.find((a) => a.id === 'first-workout').unlockedAt).toBe('2026-09-01T00:00:00Z');
    // what is shown is the catalog's own entry, not the stored one: no emoji icon, and the badge to draw
    expect(merged.achievements.find((a) => a.id === 'level-5').icon).toBeUndefined();
    expect(merged.achievements.find((a) => a.id === 'level-5').badge).toEqual(store().achievements.find((a) => a.id === 'level-5').badge);
  });

  it('drops an unlock whose id is no longer in the catalog', () => {
    const merged = merge({ unlockedAchievements: ['level-5', 'marathon-man'], unlockedAt: { 'marathon-man': '2026-01-01T00:00:00Z' } }, fresh());
    expect(merged.unlockedAchievements).toEqual(['level-5']);
    expect(merged.achievements.find((a) => a.id === 'marathon-man')).toBeUndefined();
  });

  it('copes with nothing saved, or something that is not an object', () => {
    for (const saved of [undefined, null, 'x', 7, [], {}]) {
      const merged = merge(saved, fresh());
      expect(merged.achievements).toHaveLength(CATALOG_SIZE);
      expect(merged.unlockedAchievements).toEqual([]);
    }
  });
});

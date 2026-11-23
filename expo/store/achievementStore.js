import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { newCatalogue } from '../lib/achievementCatalogue';

const defaultAchievements = newCatalogue();


// Which achievements are unlocked is decided on the server (functions/src/unlockRules.js, run by functions/src/unlocks.js after every
// workout and XP claim) and written to users/{uid}/data/achievements, which the phone can read and never write. This store holds the
// catalog (lib/achievementCatalogue.js: the 300 achievements, their targets and badges, the same for everyone) and shows what the server
// has unlocked: services/progressSync.js hands it each change, and loadAchievements fetches it once. Nothing here decides an unlock or
// writes one.
export const useAchievementStore = create(
  persist(
    (set, get) => ({
      achievements: defaultAchievements,
      unlockedAchievements: [],

      // `unlocked` is the `unlocked` map of the server's document, { achievementId: time it was unlocked }. What the server says
      // replaces what the phone held, so one person's unlocks are never left on screen for another.
      applyServerUnlocks: (unlocked) => {
        const map = unlocked && typeof unlocked === 'object' && !Array.isArray(unlocked) ? unlocked : {};
        set((state) => ({
          unlockedAchievements: Object.keys(map).filter((id) => map[id]),
          achievements: state.achievements.map((a) => ({ ...a, unlockedAt: map[a.id] || undefined })),
        }));
      },

      // Back to nothing unlocked, when the person signs out.
      clearServerUnlocks: () => get().applyServerUnlocks({}),

      loadAchievements: async (uid) => {
        if (!uid) return;
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'achievements'));
          if (snap.exists()) get().applyServerUnlocks(snap.data().unlocked);
        } catch (e) {
          console.warn('[achievementStore] loadAchievements error:', e?.message);
        }
      },

      getUnlockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter((achievement) =>
        unlockedAchievements.includes(achievement.id)
        );
      },

      getLockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter((achievement) =>
        !unlockedAchievements.includes(achievement.id)
        );
      },

      initializeAchievements: () => {
        const { achievements } = get();
        if (achievements.length === 0) {
          set({ achievements: newCatalogue() });
        }
      }
    }),
    {
      name: 'zown-achievement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only what has been unlocked is kept on the phone, as ids and times. The catalog itself is not stored: a phone that saved the old list
      // would otherwise keep showing it after an update, and what is saved is read back onto the catalog below.
      partialize: (state) => ({
        unlockedAchievements: state.unlockedAchievements,
        unlockedAt: Object.fromEntries(state.achievements.filter((a) => a.unlockedAt).map((a) => [a.id, a.unlockedAt])),
      }),
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === 'object' ? persisted : {};
        const times = { ...(saved.unlockedAt && typeof saved.unlockedAt === 'object' ? saved.unlockedAt : {}) };
        // A phone that stored the whole list before has its unlock times in it.
        if (Array.isArray(saved.achievements)) {
          saved.achievements.forEach((a) => {
            if (a && a.id && a.unlockedAt && !times[a.id]) times[a.id] = a.unlockedAt;
          });
        }
        const known = new Set(current.achievements.map((a) => a.id));
        const ids = Array.isArray(saved.unlockedAchievements) ? saved.unlockedAchievements.filter((id) => known.has(id)) : [];
        return {
          ...current,
          unlockedAchievements: ids,
          achievements: current.achievements.map((a) => ({ ...a, unlockedAt: times[a.id] || undefined })),
        };
      },
    }
  )
);

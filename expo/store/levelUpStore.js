// store/levelUpStore.js
//
// The level-up pop-up that is waiting to be shown, if there is one. store/expStore.js announces a level when XP the person has just
// earned takes them into it; components/LevelUpHost.jsx (mounted once, in app/_layout.jsx) shows it, and the person's tap on
// "Keep going" clears it. It is kept in memory only: a pop-up that was never seen is not brought back after the app is closed, and a
// level that is only loaded from the server (a new phone, an update) is never announced at all (lib/levelUp.js says why).
import { create } from 'zustand';
import { levelsGained, mergeLevelUp } from '../lib/levelUp';

export const useLevelUpStore = create((set) => ({
  /** { from, to, kind, totalXp } or null. */
  pending: null,
  announce: (info) => set((state) => ({ pending: mergeLevelUp(state.pending, info) })),
  dismiss: () => set({ pending: null }),
}));

/** Called by the XP store when XP just earned took the person from level `from` to level `to`. Does nothing when that is not a gain. */
export function announceLevelUp(info) {
  if (!info || levelsGained(info.from, info.to) === 0) return;
  useLevelUpStore.getState().announce(info);
}

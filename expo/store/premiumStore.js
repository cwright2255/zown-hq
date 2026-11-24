import { create } from 'zustand';
import { callProxy } from '../services/callProxy';
import { premiumPassActive } from '../lib/premiumRewards';

// The Premium side of the Battle Pass, as the server holds it: whether the person has the Premium Pass, which Premium rewards they have
// claimed (with the single-use codes they were given), and the bonus AI messages and free body scans they have left. Both documents are
// written only by the server (users/{uid}/data/premiumPass and users/{uid}/data/premiumRewards, functions/src/premiumPass.js); the phone
// follows them (services/progressSync.js hands each change to applyServerPass and applyServerRewards) and asks the server to claim.
//
// Nothing is kept on the phone beyond the Firestore SDK's own offline copy: the server's word is the only one there is.
const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

const EMPTY = { pass: null, claims: {}, aiMessages: 0, scanCredits: 0 };

export const usePremiumStore = create((set, get) => ({
  ...EMPTY,
  // The tier whose claim is on its way to the server, or null. A second tap on the same tier while it is waits for the first.
  claiming: null,

  // The premiumPass document (null when the person has none).
  applyServerPass: (data) => {
    if (!data || typeof data !== 'object') return set({ pass: null });
    return set({ pass: { active: data.active === true, expiresAt: data.expiresAt == null ? null : data.expiresAt } });
  },

  // The premiumRewards document (null when nothing has been claimed). `claims` is kept by tier number, as text.
  applyServerRewards: (data) => {
    if (!data || typeof data !== 'object') return set({ claims: {}, aiMessages: 0, scanCredits: 0 });
    const claims = {};
    if (data.claims && typeof data.claims === 'object') {
      Object.entries(data.claims).forEach(([tier, claim]) => {
        if (/^\d+$/.test(tier) && claim && typeof claim === 'object') claims[tier] = claim;
      });
    }
    return set({ claims, aiMessages: count(data.aiMessages), scanCredits: count(data.scanCredits) });
  },

  // Back to nothing, when the person signs out.
  clearServerRewards: () => set({ ...EMPTY, claiming: null }),

  // Whether the person has the Premium Pass right now.
  hasPass: (now = new Date()) => premiumPassActive(get().pass, now),

  // Asks the server to claim the reward on a tier. Resolves to what came of it:
  //   'claimed'    it is claimed now (the reward is in what the phone follows)
  //   'already'    it was claimed before
  //   'locked'     the person's level has not reached the tier yet
  //   'needs-pass' the person does not have the Premium Pass
  //   'has-plan'   a week or a month of Legend that cannot be given, because the person's plan must not be replaced; it stays to claim later
  //   'busy'       this tier's claim is already on its way
  //   'failed'     the server could not be reached or turned the request away; nothing is changed
  claimReward: async (tier) => {
    if (get().claiming === tier) return 'busy';
    set({ claiming: tier });
    try {
      const result = await callProxy('claimPremiumReward', { tier });
      const status = result && result.status;
      if (['claimed', 'already', 'locked', 'needs-pass', 'has-plan'].includes(status)) return status;
      return 'failed';
    } catch (e) {
      console.warn('[premiumStore] claimReward error:', e?.message);
      return 'failed';
    } finally {
      if (get().claiming === tier) set({ claiming: null });
    }
  },
}));

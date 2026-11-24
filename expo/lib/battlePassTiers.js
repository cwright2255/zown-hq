// lib/battlePassTiers.js
//
// The 100 tiers of the Battle Pass, one for each level (LEVEL_CAP is 100): a tier can be claimed once the person's level has reached its
// number, and the server (functions/src/unlocks.js BATTLE_PASS_TIERS) lets exactly these 100 be claimed. Each tier shows a badge (a ring
// frame, a metal and a sports icon, as on the achievements): bronze for tiers 1 to 33, silver for 34 to 66, gold for 67 to 100, and
// every tenth tier is a star. The first twenty tiers keep the rewards they have always had; from the twenty-first each badge has a name
// that is a pun on its sport (lib/badgeTitles.js). Pure functions and data, no React, no Firebase.
import { FRAME_IDS } from './badgeFrames';
import { TIER_TITLES } from './badgeTitles';
import { SPORT_ICONS } from './sportIcons';

export const TIER_COUNT = 100;

// The first twenty tiers' rewards are the ones the pass has always had; only their pictures are new (the badge).
const FIRST_TWENTY = [
  'Profile Badge', '100 Bonus XP', 'Dark Gold Theme', 'HIIT Elite', 'Power Smoothie', '200 Bonus XP', 'Avatar Frame', 'Beach 10K Route',
  '300 Bonus XP', 'Titan Core', 'Fire Streak Badge', 'Meal Prep Pack', '500 Bonus XP', '20% Gear Discount', 'Pro Running Plan', '750 Bonus XP',
  'Neon Theme', '1000 Bonus XP', 'Champion Badge', 'OWN THE DAY Title',
];

const ROUND_FRAMES = FRAME_IDS.filter((id) => id !== 'star');

/** Which metal a tier's badge is. */
export const tierMetal = (tier) => (tier <= 33 ? 'bronze' : tier <= 66 ? 'silver' : 'gold');

/** The badge of a tier: every tenth is a star; the rest take the other seven frames in turn. The icons step through the set so no two tiers share one. */
export function tierBadge(tier) {
  const icon = SPORT_ICONS[(tier * 37) % SPORT_ICONS.length];
  return { frame: tier % 10 === 0 ? 'star' : ROUND_FRAMES[(tier - 1) % ROUND_FRAMES.length], metal: tierMetal(tier), icon: icon.id, iconName: icon.name };
}

function tierName(tier) {
  if (tier <= FIRST_TWENTY.length) return FIRST_TWENTY[tier - 1];
  const name = TIER_TITLES[tier];
  if (!name) throw new Error(`lib/badgeTitles.js has no name for Battle Pass tier ${tier}`);
  return name;
}

/** All 100 tiers, in order: { t, name, badge: { frame, metal, icon } }. */
export const TIER_REWARDS = Array.from({ length: TIER_COUNT }, (_, i) => {
  const t = i + 1;
  const { iconName, ...badge } = tierBadge(t);
  return { t, name: tierName(t), badge };
});

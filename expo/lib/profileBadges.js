// lib/profileBadges.js
//
// Which badges the strip on the Profile tab draws. There are 300 achievements and every one is a drawn badge, so the strip cannot hold them
// all: it shows the ones the person has earned first, then the next ones still to earn, and stops at LIMIT. Achievements (View All) lists
// the rest. Pure function, no React.

export const PROFILE_BADGE_LIMIT = 20;

/** [{ achievement, earned }], the earned achievements and then the locked ones, in the order given, no more than `limit` in all. */
export function profileBadges(unlocked, locked, limit = PROFILE_BADGE_LIMIT) {
  const earned = (Array.isArray(unlocked) ? unlocked : []).map((achievement) => ({ achievement, earned: true }));
  const toEarn = (Array.isArray(locked) ? locked : []).map((achievement) => ({ achievement, earned: false }));
  return [...earned, ...toEarn].slice(0, Math.max(0, limit));
}

// lib/achievementProgress.js
//
// How far along the person is toward an achievement, from what the phone holds. Pure functions, no React, no Firebase. The server decides
// whether it is unlocked (functions/src/unlockRules.js); this is only for the progress shown on the Battle Pass and on an achievement's screen.
// Virtual races and journeys finished are counted by the server alone (their records are not kept on the phone), so they show no progress.

export const MILES_PER_KM = 0.621371;
// Hikes the app rates Strenuous or harder (lib/hikeDifficulty.js); the server counts the same two.
export const STRENUOUS_TIERS = ['Strenuous', 'Very Strenuous'];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** { count, miles, strenuous } from the hikes the person has recorded. */
export function hikeFacts(hikes) {
  const list = Array.isArray(hikes) ? hikes.filter((h) => h && typeof h === 'object') : [];
  return {
    count: list.length,
    miles: list.reduce((sum, h) => sum + num(h.distanceKm), 0) * MILES_PER_KM,
    strenuous: list.filter((h) => STRENUOUS_TIERS.includes(h.difficultyTier)).length,
  };
}

/**
 * { current, target } for an achievement's condition, or null when the phone cannot count it.
 * `facts` is { finishedWorkouts, bestCalories, streak, level, xp, hikeCount, hikeMiles, strenuousHikes }.
 */
export function progressFor(condition, facts) {
  const { type, target } = condition || {};
  const f = facts || {};
  switch (type) {
    case 'workout_count': return { current: num(f.finishedWorkouts), target };
    case 'streak': return { current: num(f.streak), target };
    case 'level': return { current: num(f.level), target };
    case 'xp': return { current: num(f.xp), target };
    case 'calories_burned': return { current: num(f.bestCalories), target };
    case 'hike_count': return { current: num(f.hikeCount), target };
    case 'hike_miles': return { current: Math.floor(num(f.hikeMiles) * 10) / 10, target };
    case 'strenuous_hikes': return { current: num(f.strenuousHikes), target };
    default: return null;
  }
}

/**
 * The achievements in the order the Battle Pass lists them: the ones earned first, the newest first; then the ones not earned, the
 * closest to earned first (by the share of the target reached), with those that show no progress last, in catalogue order.
 * @param {object[]} achievements
 * @param {Object<string, {current: number, target: number}|null>} progress by achievement id
 */
export function listOrder(achievements, progress) {
  const earned = achievements.filter((a) => a.unlockedAt).sort((a, b) => String(b.unlockedAt).localeCompare(String(a.unlockedAt)));
  const share = (a) => {
    const p = progress && progress[a.id];
    return p && p.target > 0 ? Math.min(1, p.current / p.target) : -1;
  };
  const locked = achievements
    .map((a, i) => ({ a, i, f: share(a) }))
    .filter(({ a }) => !a.unlockedAt)
    .sort((x, y) => y.f - x.f || x.i - y.i)
    .map(({ a }) => a);
  return [...earned, ...locked];
}

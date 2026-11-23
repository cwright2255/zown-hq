// lib/achievementDetail.js
//
// What the achievement screen (app/achievement/[id].jsx) says about one achievement, and how the Battle Pass opens it. Pure functions,
// no React, no Firebase.
//
// Only what the app really holds is shown: the name, the description, when the server unlocked it, the XP it gives, its category and,
// for one that is still locked, how far along the person is. The progress is worked out on the Battle Pass screen, which already has
// the workouts, the streak and the XP it counts, so it is handed over in the link and not worked out a second time here.

import { formatXp } from './levelUp';

/** The link the Battle Pass opens for an achievement, with its progress (a { current, target } or null) when there is some to show. */
export function achievementHref(achievement, progress) {
  const params = { id: String(achievement.id) };
  const p = readProgress(progress);
  if (p) {
    params.current = String(p.current);
    params.target = String(p.target);
  }
  return { pathname: '/achievement/[id]', params };
}

// A link's values come back as text (or a list of text when a name is repeated); only a target above zero and a count of zero or more
// make progress, anything else is no progress at all.
const first = (value) => (Array.isArray(value) ? value[0] : value);

/** { current, target } from numbers or from a link's text, or null when it is not a real count toward a real target. */
export function readProgress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const rawCurrent = first(raw.current);
  const rawTarget = first(raw.target);
  if (rawCurrent === undefined || rawCurrent === null || rawCurrent === '' || rawTarget === undefined || rawTarget === null || rawTarget === '') return null;
  const current = Number(rawCurrent);
  const target = Number(rawTarget);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0 || current < 0) return null;
  return { current, target };
}

/** The date an achievement was unlocked as the phone shows dates (10/27/2026), from the server's time; null when it is not a date. */
export function formatEarnedDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US');
}

const capitalise = (text) => {
  const t = String(text || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
};

/**
 * Everything the screen writes for an achievement. `progress` is { current, target } (or what a link gave); it is only used for an
 * achievement that is not earned yet.
 */
export function achievementFacts(achievement, progress) {
  const earned = Boolean(achievement.unlockedAt);
  const name = String(achievement.name || '').trim() || 'Achievement';
  const date = earned ? formatEarnedDate(achievement.unlockedAt) : null;
  const p = earned ? null : readProgress(progress);
  const shown = p ? Math.min(p.current, p.target) : 0;
  return {
    earned,
    name,
    title: name.toUpperCase(),
    description: String(achievement.description || '').trim(),
    earnedLabel: earned ? (date ? `Earned ${date}` : 'Earned') : 'Not earned yet',
    rewardValue: `+${formatXp(achievement.xpReward)} XP`,
    rewardLabel: earned ? 'XP earned' : 'XP reward',
    category: capitalise(achievement.category),
    progress: p ? { current: shown, target: p.target, fraction: shown / p.target, remaining: Math.max(0, Math.ceil(p.target - shown)) } : null,
    badgeLabel: `${name} badge, ${earned ? 'earned' : 'locked'}`,
  };
}

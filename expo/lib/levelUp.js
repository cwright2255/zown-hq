// lib/levelUp.js
//
// The level-up celebration (components/LevelUpCelebration.jsx): the pop-up that comes up when XP a person has just earned, from a run, a
// workout, a meal and so on, takes them into a new level. This file is everything about it that is not a picture: what it says, how far
// through the new level the person already is, and the paths the confetti follows. Pure functions, no React, no Firebase.
//
// What counts as a level-up: only XP earned on this phone a moment ago. store/expStore.js tells store/levelUpStore.js when a claim it
// files takes the person over a level. A level that is only loaded (signing in on a new phone, the server's record arriving after an
// update) is never announced, so nobody is shown a celebration for a level they reached long ago.

import { LEVEL_CAP, levelMultiplier, xpRequiredForLevel } from './xpRules';

/** How long the pop-up waits after the XP is awarded, so the screen that earned it (a workout's finish, a run's summary) settles first. */
export const LEVEL_UP_DELAY_MS = 700;

/** How many levels a move from `from` to `to` crosses (0 when it does not go up, or either is not a number). */
export function levelsGained(from, to) {
  const a = Math.floor(Number(from));
  const b = Math.floor(Number(to));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return b - a;
}

const finiteOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback);

/**
 * One pop-up for awards that come close together (a workout, then an achievement it unlocks): it keeps the level the person started
 * from, moves the end up, and keeps the first award's kind. Returns `current` unchanged when `next` is not a gain.
 * A pop-up is { from, to, kind, totalXp }.
 */
export function mergeLevelUp(current, next) {
  if (!next || levelsGained(next.from, next.to) === 0) return current || null;
  if (!current) return { from: next.from, to: next.to, kind: next.kind || null, totalXp: finiteOr(next.totalXp, 0) };
  return {
    from: Math.min(current.from, next.from),
    to: Math.max(current.to, next.to),
    kind: current.kind || next.kind || null,
    totalXp: Math.max(finiteOr(current.totalXp, 0), finiteOr(next.totalXp, 0)),
  };
}

/** The XP as the pop-up writes it: whole numbers with commas (12,340). */
export const formatXp = (xp) => Math.max(0, Math.round(Number(xp) || 0)).toLocaleString('en-US');

/**
 * What the pop-up shows about the level just reached, from the person's total XP now:
 * the level, whether it is the top one, the XP multiplier it gives (the same one xpRules uses for awards), the XP still needed for
 * the next level, and how far through this level the person already is (0 to 1; 1 at the top).
 */
export function levelUpFacts(level, totalXp) {
  const lvl = Math.min(LEVEL_CAP, Math.max(1, Math.floor(Number(level)) || 1));
  const total = Math.max(0, Number(totalXp) || 0);
  const isMax = lvl >= LEVEL_CAP;
  const floor = xpRequiredForLevel(lvl);
  const ceiling = isMax ? floor : xpRequiredForLevel(lvl + 1);
  const span = Math.max(1, ceiling - floor);
  return {
    level: lvl,
    isMax,
    multiplier: Math.round(levelMultiplier(lvl) * 100) / 100,
    xpToNext: isMax ? 0 : Math.max(0, Math.ceil(ceiling - total)),
    progress: isMax ? 1 : Math.min(1, Math.max(0, (total - floor) / span)),
  };
}

/** The big line under the badge. */
export function levelUpHeadline(from, to) {
  const gained = levelsGained(from, to);
  if (to >= LEVEL_CAP) return `You reached Level ${LEVEL_CAP}, the top level`;
  if (gained > 1) return `You jumped ${gained} levels, to Level ${to}`;
  return `You reached Level ${to}`;
}

// What earned it, by the kind of XP claim (lib/xpRules.js KINDS). A kind with no line here gets none.
const SOURCE_LABEL = {
  workout: 'Workout complete',
  run: 'Run complete',
  hike: 'Hike complete',
  meal: 'Meal logged',
  plan: 'Mission complete',
  advice: 'Mission complete',
  formcheck: 'Form check complete',
  journey: 'Journey complete',
  race: 'Race complete',
  hydration: 'Hydration goal',
  steps: 'Steps counted',
};
export const sourceLabel = (kind) => SOURCE_LABEL[kind] || null;

// ---- the confetti ------------------------------------------------------------------------------------------------------------
// Every piece leaves the badge, flies up and out, and falls. Positions are fractions of the screen (width for sideways, height for
// up and down) so the same pieces fit any phone. The same seed always gives the same pieces, so the burst can be tested.

export const CONFETTI_COUNT = 40;
export const CONFETTI_COLOR_COUNT = 5;
/** Where in a piece's flight (0 to 1) it reaches the top of its arc. */
export const APEX = 0.3;
/** The moments of a flight at which a piece's position is written down; the animation joins them with straight lines. */
export const ARC_STEPS = [0, 0.06, 0.12, 0.18, 0.24, APEX, 0.44, 0.58, 0.72, 0.86, 1];

// A small seeded random-number generator (mulberry32): the same seed, the same run of numbers.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The pieces of one burst. Each: { id, dx (sideways, fraction of width, negative is left), up (how high the arc goes, fraction of
 * height), fall (how far below the start it ends, fraction of height), delayMs, durationMs, turns (whole spins, negative is the other
 * way), size (px), colorIndex, shape (0 square, 1 dot, 2 strip) }.
 */
export function confettiPieces(count = CONFETTI_COUNT, seed = 20261123, colorCount = CONFETTI_COLOR_COUNT) {
  const rand = seeded(seed);
  const pieces = [];
  for (let i = 0; i < count; i += 1) {
    const side = rand() < 0.5 ? -1 : 1;
    pieces.push({
      id: i,
      dx: side * (0.08 + rand() * 0.5),
      up: 0.08 + rand() * 0.22,
      fall: 0.35 + rand() * 0.4,
      delayMs: Math.round(rand() * 200),
      durationMs: Math.round(1900 + rand() * 1100),
      turns: (rand() < 0.5 ? -1 : 1) * (1 + Math.floor(rand() * 4)),
      size: 6 + Math.round(rand() * 6),
      colorIndex: Math.floor(rand() * colorCount),
      shape: Math.floor(rand() * 3),
    });
  }
  return pieces;
}

/**
 * Where a piece is at each of ARC_STEPS, as fractions: { input, x, y }. Sideways slows down as it goes (x); up speeds off then eases
 * to the top of the arc, and down speeds up as it falls (y, negative is up).
 */
export function arcKeyframes(piece) {
  const input = ARC_STEPS;
  const x = input.map((p) => piece.dx * (1 - (1 - p) * (1 - p)));
  const y = input.map((p) => {
    if (p <= APEX) {
      const k = 1 - p / APEX; // 1 at the start, 0 at the top
      return -piece.up * (1 - k * k);
    }
    const k = (p - APEX) / (1 - APEX); // 0 at the top, 1 at the end
    return -piece.up + (piece.fall + piece.up) * k * k;
  });
  return { input, x, y };
}

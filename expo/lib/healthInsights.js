// lib/healthInsights.js
//
// What the Health screen says about a reading besides the reading itself: how old it is, how it compares with the person's own usual, how
// close the training load is to having enough history, and what changed on the last body scan. Pure functions of what the screen already
// holds (the daily record in healthStore.readingsHistory, the recovery reading, the scans), so every wording is checked in a test and
// nothing is made up: with too little to compare, there is no comparison.
import { readingByDay, trendSeries, shortDay } from './dailyReadings';
import { BASELINE_DAYS, MIN_BASELINE_READINGS } from './readiness';
import { dayKeyOf, localDateKey, parseDateKey, shiftDateKey } from './localDate';
import { monthDay, scanChanges } from './progressInsights';

const DAY_MS = 86400000;

// ---- how old a reading is ----------------------------------------------------------------------------------------------------

/**
 * The calendar day a reading from the recovery source was taken, "YYYY-MM-DD", or null when that is not known.
 * Apple Health gives its latest samples, which are not always from today, and says when each was taken (`restingHeartRateAt`, `hrvAt`).
 * The wearables behind ROOK give today's readings (store/healthStore.js files them under today), so those are today's. An Apple
 * reading with no time on it is not guessed at.
 * @param {object|null} recovery healthStore.rookRecovery
 * @param {'restingHeartRate'|'hrv'} field
 * @param {string} today a day key
 */
export function readingDay(recovery, field, today) {
  if (!recovery || typeof recovery !== 'object') return null;
  const taken = dayKeyOf(recovery[`${field}At`]);
  if (taken) return taken;
  const source = typeof recovery.source === 'string' ? recovery.source.trim() : '';
  return source && !/apple/i.test(source) ? today : null;
}

/** "today", "yesterday", "3 days ago", and from a week on the date ("Oct 13"). Null for a day that is not a day. A day in the future is today. */
export function dayWords(day, today) {
  const from = parseDateKey(day);
  const to = parseDateKey(today);
  if (!from || !to) return null;
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return shortDay(day);
}

// ---- a reading against the person's usual ------------------------------------------------------------------------------------

/**
 * The person's usual for a reading: the average of the BASELINE_DAYS days before `day` in the daily record, the same usual the
 * Readiness card compares with. Null until there are MIN_BASELINE_READINGS readings to average, because an average of two is not a usual.
 * @param {object} history healthStore.readingsHistory
 * @param {'restingHeartRate'|'hrv'} field
 * @param {string} day the day the reading is from; the usual is made from the days before it, so it never includes the reading itself
 */
export function usualFor(history, field, day) {
  const before = shiftDateKey(day, -1);
  if (!before) return null;
  const { average, count } = trendSeries(readingByDay(history, field), before, BASELINE_DAYS);
  return count >= MIN_BASELINE_READINGS && average !== null ? average : null;
}

// Which way is the one to be glad about: a lower resting heart rate, a higher HRV.
const BETTER = { restingHeartRate: 'down', hrv: 'up' };

/**
 * One reading against the usual, in whole numbers as they are shown: { text, tone, usual }. `tone` is 'good', 'worse' or 'same'
 * (the same whole number). Null when there is no reading or no usual.
 */
export function againstUsual(field, value, usual) {
  const reading = Number(value);
  if (!Number.isFinite(reading) || reading <= 0 || usual === null || usual === undefined || !Number.isFinite(usual)) return null;
  const shown = Math.round(reading);
  const usually = Math.round(usual);
  const delta = shown - usually;
  if (delta === 0) return { text: 'About your usual', tone: 'same', usual: usually };
  const up = delta > 0;
  const good = BETTER[field] === 'up' ? up : !up;
  return { text: `${up ? '↑' : '↓'} ${Math.abs(delta)} vs your usual ${usually}`, tone: good ? 'good' : 'worse', usual: usually };
}

// ---- training load -----------------------------------------------------------------------------------------------------------

/**
 * How many different days in the last four weeks the training load needs something logged on before it gives a reading
 * (calculateTrainingLoad in lib/trainingLoad.js returns "not enough history" below this).
 */
export const TRAINING_LOAD_MIN_DAYS = 5;

/** How many of the last 28 days, counting today, have a workout, run or hike in the per-day load (aggregateDailyLoad), counted as calculateTrainingLoad does. */
export function trainingDaysLogged(dailyLoad, now = new Date()) {
  const load = dailyLoad && typeof dailyLoad === 'object' ? dailyLoad : {};
  const today = localDateKey(now);
  let days = 0;
  for (let i = 0; i < 28; i += 1) {
    if (load[shiftDateKey(today, -i)] != null) days += 1;
  }
  return days;
}

// ---- the body scan -----------------------------------------------------------------------------------------------------------

const timeOf = (scan) => {
  const ms = scan && scan.createdAtLocal ? new Date(scan.createdAtLocal).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};

/**
 * What changed in body fat between the scan before and the latest one, as a line for the Body Composition card:
 * { text: "Body fat down 1.2% since Aug 12", tone: 'good' | 'worse' | 'same' }, or null with no earlier scan or no body fat on either.
 */
export function bodyChangeLine(latest, previous, now = new Date()) {
  if (!latest || !previous) return null;
  const fat = scanChanges(latest, previous).find((stat) => stat.key === 'bodyFat');
  if (!fat || fat.delta === null) return null;
  const when = timeOf(previous);
  const since = when === null ? 'your last scan' : monthDay(when, now);
  if (fat.delta === 0) return { text: `No change in body fat since ${since}`, tone: 'same' };
  return { text: `Body fat ${fat.delta > 0 ? 'up' : 'down'} ${Math.abs(fat.delta).toFixed(1)}% since ${since}`, tone: fat.tone };
}

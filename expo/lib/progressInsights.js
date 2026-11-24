// lib/progressInsights.js
//
// What the Progress tab works out from the person's records: how fresh the last weigh-in is, how far they are from the target weight,
// the shape of the weight chart, what changed since the last body scan, the week so far, and the last six months. Pure functions, no
// React, no stores, no Firebase, so every line the screen shows is checked in a test and the components only draw.
//
// Weight is kept in kilograms and shown in pounds, the way the Progress tab always has (Math.round(kg * 2.20462)).
import { sessionsOf } from './activity';
import { dayKeyOf, localDateKey, parseDateKey, shiftDateKey } from './localDate';
import { startOfWeek } from './workoutWeek';

const DAY_MS = 86400000;
export const KG_TO_LB = 2.20462;

const num = (value) => {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

// A time as milliseconds: an ISO string, a Date, a number, or a Firestore Timestamp. Null when it is not a usable time.
function msOf(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const d = typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug 12", or "Aug 12, 2025" when it is not this year, in the person's own time zone. */
export function monthDay(ms, now = new Date()) {
  const d = new Date(ms);
  const text = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? text : `${text}, ${d.getFullYear()}`;
}

// ---- weight ------------------------------------------------------------------------------------------------------------------

/** The weigh-ins that can be charted, oldest first: { id, ms, kg, lbs }. One with no weight or no readable time is left out. */
export function weightEntries(logs) {
  const out = [];
  (Array.isArray(logs) ? logs : []).forEach((log) => {
    if (!log) return;
    const kg = num(log.weightKg);
    const ms = msOf(log.createdAtLocal != null ? log.createdAtLocal : log.createdAt);
    if (kg === null || kg <= 0 || ms === null) return;
    out.push({ id: log.id, ms, kg, lbs: Math.round(kg * KG_TO_LB) });
  });
  return out.sort((a, b) => a.ms - b.ms);
}

/** A weigh-in older than this many days is called out as out of date. */
export const STALE_AFTER_DAYS = 14;

function daysBetweenKeys(fromKey, toKey) {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  if (!a || !b) return 0;
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((utc(b) - utc(a)) / DAY_MS));
}

/**
 * How old the latest weigh-in is, in calendar days of the person's own time: { days, stale, label }, or null with no weigh-ins.
 * The label is "Logged today", "Logged 5 days ago", "Logged 3 weeks ago", and once it is stale it carries the date as well:
 * "Logged Aug 12 · 3 months ago".
 */
export function weightFreshness(entries, now = new Date()) {
  if (!entries || entries.length === 0) return null;
  const last = entries[entries.length - 1];
  const days = daysBetweenKeys(dayKeyOf(last.ms), localDateKey(now));
  let ago;
  if (days === 0) ago = 'today';
  else if (days === 1) ago = 'yesterday';
  else if (days < 14) ago = `${days} days ago`;
  else if (days < 60) ago = `${Math.floor(days / 7)} weeks ago`;
  else ago = `${Math.floor(days / 30)} months ago`;
  const stale = days > STALE_AFTER_DAYS;
  return { days, stale, label: stale ? `Logged ${monthDay(last.ms, now)} · ${ago}` : `Logged ${ago}` };
}

/**
 * How far the person is from the target weight, in pounds: the start (the first weigh-in), now, the target, what is left, and how far
 * along they are (0 to 1). Null with no weigh-ins or no target. Works for losing and for gaining.
 */
export function weightProgress(entries, targetKg) {
  const target = num(targetKg);
  if (!entries || entries.length === 0 || target === null || target <= 0) return null;
  const targetLbs = Math.round(target * KG_TO_LB);
  const startLbs = entries[0].lbs;
  const currentLbs = entries[entries.length - 1].lbs;
  const direction = targetLbs < startLbs ? 'lose' : targetLbs > startLbs ? 'gain' : 'hold';
  const reached = direction === 'lose' ? currentLbs <= targetLbs : direction === 'gain' ? currentLbs >= targetLbs : currentLbs === targetLbs;
  const span = Math.abs(startLbs - targetLbs);
  const moved = direction === 'lose' ? startLbs - currentLbs : direction === 'gain' ? currentLbs - startLbs : 0;
  const progress = reached ? 1 : span > 0 ? clamp(moved / span, 0, 1) : 0;
  return { startLbs, currentLbs, targetLbs, toGoLbs: reached ? 0 : Math.abs(currentLbs - targetLbs), progress, direction, reached };
}

/** The words beside the progress bar. */
export function weightGoalLine(progress) {
  if (!progress) return '';
  return progress.reached ? 'Target reached' : `${progress.toGoLbs} lbs to go`;
}

/** From the first weigh-in to the latest, in pounds (negative is down), or null with fewer than two weigh-ins. */
export function changeFromStart(entries) {
  if (!entries || entries.length < 2) return null;
  return entries[entries.length - 1].lbs - entries[0].lbs;
}

/** From the first weigh-in in the last `days` days to the latest, or null when fewer than two weigh-ins fall in them. */
export function recentChange(entries, now = new Date(), days = 30) {
  if (!entries || entries.length < 2) return null;
  const from = now.getTime() - days * DAY_MS;
  const inside = entries.filter((e) => e.ms >= from);
  if (inside.length < 2) return null;
  return { lbs: inside[inside.length - 1].lbs - inside[0].lbs, days };
}

/** "Down 3 lbs", "Up 2 lbs" or "No change", for a change in pounds. */
export function changeWords(lbs) {
  if (lbs === 0) return 'No change';
  return `${lbs < 0 ? 'Down' : 'Up'} ${Math.abs(lbs)} lbs`;
}

export const WEIGHT_RANGES = [
  { key: '1w', label: '1W', days: 7 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
  { key: 'all', label: 'All', days: null },
];

const rangeOf = (key) => WEIGHT_RANGES.find((r) => r.key === key) || WEIGHT_RANGES[WEIGHT_RANGES.length - 1];

/** The weigh-ins inside a range, counting back from now. */
export function entriesInRange(entries, rangeKey, now = new Date()) {
  const { days } = rangeOf(rangeKey);
  if (days === null) return entries || [];
  const from = now.getTime() - days * DAY_MS;
  return (entries || []).filter((e) => e.ms >= from);
}

/** The range to open on: three months when it holds at least two weigh-ins, otherwise everything. */
export function defaultRange(entries, now = new Date()) {
  return entriesInRange(entries, '3m', now).length >= 2 ? '3m' : 'all';
}

/** Each weigh-in as the average of itself and the ones in the days before it, so the line shows the direction, not the day's noise. */
export function trendSeries(entries, windowDays = 7) {
  return (entries || []).map((e) => {
    const from = e.ms - windowDays * DAY_MS;
    const inside = entries.filter((x) => x.ms >= from && x.ms <= e.ms);
    const mean = inside.reduce((sum, x) => sum + x.lbs, 0) / inside.length;
    return { ms: e.ms, lbs: round1(mean) };
  });
}

/**
 * What the weight chart draws, as fractions (x: 0 left to 1 right, y: 0 top to 1 bottom) so the component only scales them to its size.
 * The time axis runs from the start of the range to now, so a long gap since the last weigh-in shows as a gap. The target is part of
 * the scale, so the line shows how far there is to go. Null with fewer than two weigh-ins in the range.
 */
export function weightChartModel({ entries, rangeKey = 'all', now = new Date(), targetLbs = null }) {
  const inside = entriesInRange(entries, rangeKey, now);
  if (inside.length < 2) return null;
  const { days } = rangeOf(rangeKey);
  const startMs = days === null ? inside[0].ms : now.getTime() - days * DAY_MS;
  const endMs = Math.max(now.getTime(), inside[inside.length - 1].ms);
  const span = endMs - startMs;
  const target = num(targetLbs);
  const trend = trendSeries(entries).filter((t) => t.ms >= inside[0].ms);
  const values = [...inside.map((e) => e.lbs), ...trend.map((t) => t.lbs)];
  if (target !== null) values.push(target);
  // The scale runs between whole pounds, so the numbers printed at its top and bottom are exactly where it starts and ends.
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const x = (ms) => (span > 0 ? clamp((ms - startMs) / span, 0, 1) : 0.5);
  const y = (lbs) => (max > min ? (max - lbs) / (max - min) : 0.5);
  return {
    minLbs: min,
    maxLbs: max,
    startMs,
    endMs,
    points: inside.map((e) => ({ id: e.id, lbs: e.lbs, ms: e.ms, x: x(e.ms), y: y(e.lbs) })),
    trend: trend.map((t) => ({ lbs: t.lbs, ms: t.ms, x: x(t.ms), y: y(t.lbs) })),
    target: target !== null ? { lbs: target, y: y(target) } : null,
  };
}

// ---- body scans --------------------------------------------------------------------------------------------------------------

/** Lean mass in pounds, from the weight and body fat the scan recorded. Null when either is missing. */
export function leanMassLbs(scan) {
  if (!scan) return null;
  const kg = num(scan.weightKg);
  const fat = num(scan.bodyFatPercent);
  if (kg === null || fat === null) return null;
  return Math.round(kg * (1 - fat / 100) * KG_TO_LB);
}

// For each stat: where its value is on the scan, how it is written, and which way is the one to be glad about.
const SCAN_STATS = [
  { key: 'bodyFat', label: 'Body Fat', read: (s) => num(s && s.bodyFatPercent), show: (v) => `${v}%`, unit: '%', better: 'down', digits: 1 },
  { key: 'leanMass', label: 'Lean Mass', read: (s) => leanMassLbs(s), show: (v) => `${v} lbs`, unit: ' lbs', better: 'up', digits: 0 },
  { key: 'bmi', label: 'BMI', read: (s) => num(s && s.bmi), show: (v) => String(v), unit: '', better: 'down', digits: 1 },
];

/**
 * The three stats of the latest scan and what changed since the one before: [{ key, label, value, delta, text, tone }].
 * `value` is what to show ("24.2%", or an em dash with no reading), `text` is "↓ 1.2%", "No change", or empty when there is nothing to
 * compare (no earlier scan, or a reading missing from one). `tone` is 'good', 'worse', 'same' or null.
 */
export function scanChanges(latest, previous) {
  return SCAN_STATS.map((stat) => {
    const now = stat.read(latest);
    const before = previous ? stat.read(previous) : null;
    const value = now === null ? '—' : stat.show(now);
    if (now === null || before === null) return { key: stat.key, label: stat.label, value, delta: null, text: '', tone: null };
    const raw = now - before;
    const delta = stat.digits === 0 ? Math.round(raw) : round1(raw);
    if (Math.abs(delta) < (stat.digits === 0 ? 1 : 0.05)) return { key: stat.key, label: stat.label, value, delta: 0, text: 'No change', tone: 'same' };
    const up = delta > 0;
    const good = stat.better === 'up' ? up : !up;
    return {
      key: stat.key,
      label: stat.label,
      value,
      delta,
      text: `${up ? '↑' : '↓'} ${Math.abs(delta).toFixed(stat.digits)}${stat.unit}`,
      tone: good ? 'good' : 'worse',
    };
  });
}

/** One scan as a line: "24.2% body fat · 174 lbs lean · BMI 35". Whatever the scan does not have is left out. */
export function scanLine(scan) {
  if (!scan) return '';
  const parts = [];
  const fat = num(scan.bodyFatPercent);
  const lean = leanMassLbs(scan);
  const bmi = num(scan.bmi);
  if (fat !== null) parts.push(`${fat}% body fat`);
  if (lean !== null) parts.push(`${lean} lbs lean`);
  if (bmi !== null) parts.push(`BMI ${bmi}`);
  return parts.join(' · ');
}

// ---- the week and the months -------------------------------------------------------------------------------------------------

// Where each kind of record keeps the time it finished: the same places lib/activity.js reads, so the week agrees with the streak.
const WORKOUT_TIME = (w) => w.completedAt || w.date || w.timestamp;
const RUN_TIME = (r) => r.endTime || r.startTime;
const calories = (item, key) => Math.max(0, num(item && item[key]) || 0);

function recordsWithTime(list, timeOf) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const ms = msOf(timeOf(item));
    if (ms !== null) out.push({ item, ms });
  });
  return out;
}

/** The workouts that have a readable finish time, as { item, ms }. Shared with lib/goalTracking.js so a goal and the week agree. */
export const timedWorkouts = (list) => recordsWithTime(list, WORKOUT_TIME);
/** The runs that have a readable time, as { item, ms }. */
export const timedRuns = (list) => recordsWithTime(list, RUN_TIME);

/**
 * The week so far, Monday to now (the week the Workouts tab, the calendar and the run leaderboard use):
 * { workouts, runs, calories }. Calories are those of the workouts and the runs together.
 */
export function weekSummary({ workouts, runs, now = new Date() }) {
  const from = startOfWeek(now).getTime();
  const w = recordsWithTime(workouts, WORKOUT_TIME).filter((r) => r.ms >= from);
  const r = recordsWithTime(runs, RUN_TIME).filter((x) => x.ms >= from);
  return {
    workouts: w.length,
    runs: r.length,
    calories: Math.round(w.reduce((sum, x) => sum + calories(x.item, 'caloriesBurned'), 0) + r.reduce((sum, x) => sum + calories(x.item, 'calories'), 0)),
  };
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday to Sunday of this week, each: { key, letter, active (a workout, run or hike that day), today, future }. */
export function weekStrip({ workouts, runs, hikes, now = new Date() }) {
  const todayKey = localDateKey(now);
  const mondayKey = localDateKey(startOfWeek(now));
  const days = new Set(sessionsOf({ workouts, runs, hikes }).map((s) => s.dayKey));
  return WEEK_LETTERS.map((letter, i) => {
    const key = shiftDateKey(mondayKey, i);
    return { key, letter, active: days.has(key), today: key === todayKey, future: key > todayKey };
  });
}

/**
 * The last `months` calendar months, oldest first, this month last (and still running): { key: '2026-11', label: 'Nov', workouts, runs,
 * sessions (both together), calories, current }.
 */
export function monthlyTotals({ workouts, runs, now = new Date(), months = 6 }) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: MONTHS[d.getMonth()],
      workouts: 0,
      runs: 0,
      sessions: 0,
      calories: 0,
      current: i === 0,
    });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const monthKeyOf = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  recordsWithTime(workouts, WORKOUT_TIME).forEach(({ item, ms }) => {
    const b = byKey.get(monthKeyOf(ms));
    if (b && ms <= now.getTime()) { b.workouts += 1; b.calories += calories(item, 'caloriesBurned'); }
  });
  recordsWithTime(runs, RUN_TIME).forEach(({ item, ms }) => {
    const b = byKey.get(monthKeyOf(ms));
    if (b && ms <= now.getTime()) { b.runs += 1; b.calories += calories(item, 'calories'); }
  });
  buckets.forEach((b) => { b.sessions = b.workouts + b.runs; b.calories = Math.round(b.calories); });
  return buckets;
}

/** The top of a bar chart's scale: the first tidy number (1, 1.5, 2, 3, 4, 5, 6, 8, 10 times a power of ten) that holds the biggest bar. */
export function niceMax(max) {
  const top = Number(max);
  if (!Number.isFinite(top) || top <= 0) return 4;
  const power = 10 ** Math.floor(Math.log10(top));
  const steps = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
  const step = steps.find((k) => k * power >= top - 1e-9);
  return step * power;
}

/** "+3 vs last month", "-2 vs last month" or "Same as last month". */
export function versusLastMonth(current, previous) {
  const d = current - previous;
  return d === 0 ? 'Same as last month' : `${d > 0 ? '+' : ''}${d.toLocaleString('en-US')} vs last month`;
}

/** The month with the most of a measure ('sessions' or 'calories'), or null when no month has any. A tie goes to the latest. */
export function bestMonth(buckets, measure) {
  let best = null;
  (buckets || []).forEach((b) => {
    if (b[measure] > 0 && (best === null || b[measure] >= best[measure])) best = b;
  });
  return best;
}
